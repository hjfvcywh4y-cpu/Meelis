/**
 * Идемпотентный приём webhook оплаты. Тестовый режим.
 * Секрет только из env. Не подключать в Tilda.
 */
const ALLOWED = new Set(['created', 'pending', 'paid', 'failed', 'cancelled', 'refunded', 'expired']);

function timingSafeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return out === 0;
}

export function verifySignature(rawBody, header, secret) {
  if (!secret) return false;
  return timingSafeEqual(header, secret) || timingSafeEqual(header, 'sha256=' + secret);
}

const seen = new Map();

export async function handleWebhook(payload, options = {}) {
  const event = payload || {};
  const status = ALLOWED.has(event.status) ? event.status : null;
  const key = event.idempotencyKey || event.paymentId || '';
  if (!status || !key) return { ok: false, reason: 'invalid_payload' };
  if (!options.signatureValid) return { ok: false, reason: 'invalid_signature' };
  if (seen.has(key)) return { ok: true, duplicate: true, payment: seen.get(key) };
  const row = {
    paymentId: event.paymentId || key,
    orderId: event.orderId || '',
    status,
    idempotencyKey: key,
    email: event.email || '',
  };
  seen.set(key, row);
  return { ok: true, duplicate: false, payment: row, grant: status === 'paid' };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
    const raw = await request.text();
    let payload = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      return Response.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
    }
    const signatureValid = verifySignature(raw, request.headers.get('x-mlma-signature') || '', env.MLMA_WEBHOOK_SECRET);
    const result = await handleWebhook(payload, { signatureValid });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  },
};
