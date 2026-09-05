import { createHmac, createHash } from 'node:crypto';

import { newId, nowIso, type ArchitectureStore } from './store';
import type { ArchitectureFlags } from './types';

export interface PaymentEventInput {
  providerCode: string;
  providerEventId: string;
  idempotencyKey: string;
  signature: string;
  rawBody: string;
  eventType: string;
  productCode?: string;
  userId?: string;
  amountMinor?: number;
  currencyCode?: string;
}

export function verifyPaymentSignature(secret: string, rawBody: string, signature: string): boolean {
  if (!secret || !signature) return false;
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  return digest === signature;
}

export function payloadHash(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Webhook-контур существует, но при PAYMENTS_ENABLED=false ничего не выдаёт.
 * Не подключает боевые ключи.
 */
export function processPaymentEvent(
  store: ArchitectureStore,
  flags: ArchitectureFlags,
  input: PaymentEventInput,
  secrets: { webhookSecret?: string },
): { ok: boolean; reason: string; entitlementId?: string } {
  if (!flags.PAYMENTS_ENABLED) {
    return { ok: false, reason: 'payments_disabled' };
  }
  if (!verifyPaymentSignature(secrets.webhookSecret || '', input.rawBody, input.signature)) {
    return { ok: false, reason: 'signature_invalid' };
  }
  void store;
  void nowIso;
  void newId;
  return { ok: false, reason: 'payments_not_configured' };
}
