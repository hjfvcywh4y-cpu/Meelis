import { createHmac, timingSafeEqual } from 'node:crypto';

export interface RegisteredSession {
  userKey: string;
  sid: string;
  exp: number;
}

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

function macEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseCookieValue(header: string | null | undefined, name: string): string {
  if (!header) return '';
  const parts = String(header).split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('=') || '');
  }
  return '';
}

/** Same HMAC cookie as account-proxy `verifySession`. Sync for architecture HTTP. */
export function verifyRegisteredSession(secret: string | undefined, token: string | undefined): RegisteredSession | null {
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts[0] === 'v2' && parts.length === 5) {
    const sid = decodeURIComponent(parts[1] || '');
    const userKey = decodeURIComponent(parts[2] || '');
    const exp = Number(parts[3]);
    const mac = parts[4];
    if (!sid || !userKey || !exp || !mac) return null;
    if (exp * 1000 < Date.now()) return null;
    const expected = hmacHex(secret, `${sid}.${userKey}.${exp}`);
    if (!macEqual(expected, mac)) return null;
    return { userKey, exp, sid };
  }
  if (parts.length === 4 && parts[0] === 'v1') {
    const userKey = decodeURIComponent(parts[1] || '');
    const exp = Number(parts[2]);
    const mac = parts[3];
    if (!userKey || !exp || !mac) return null;
    if (exp * 1000 < Date.now()) return null;
    const expected = hmacHex(secret, `${userKey}.${exp}`);
    if (!macEqual(expected, mac)) return null;
    return { userKey, exp, sid: '' };
  }
  return null;
}

export function identityUserIdFromSession(session: RegisteredSession): string {
  return session.userKey;
}
