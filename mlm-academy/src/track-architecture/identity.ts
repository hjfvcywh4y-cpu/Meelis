import type { AccessContext, AccessRole, EntitlementGrant, UserRight } from './types';

export function userRightFromRole(role: AccessRole, verified: boolean): UserRight {
  if (!verified) return 'NONE';
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'FULL' || role === 'START' || role === 'PILOT') return 'FULL';
  if (role === 'FREE') return 'NONE';
  return 'NONE';
}

export const ANON_ACCESS: AccessContext = {
  userId: null,
  role: 'ANON',
  userRight: 'NONE',
  verified: false,
  registered: false,
  entitlements: [],
};

/**
 * Tilda Members bind never proves payment identity.
 * Client ma_id / email / localStorage / query / frontend group are ignored here.
 */
export function identityFromVerifiedSession(input: {
  userId: string;
  role?: AccessRole;
  verified?: boolean;
  registered?: boolean;
  entitlements?: EntitlementGrant[];
  userRight?: UserRight;
}): AccessContext {
  const verified = input.verified === true;
  const requested = input.role || 'FREE';
  const role: AccessRole = verified ? requested : requested === 'ANON' ? 'ANON' : 'FREE';
  const registered = input.registered === true || Boolean(input.userId);
  return {
    userId: input.userId,
    role,
    userRight: input.userRight || userRightFromRole(role, verified),
    verified,
    registered,
    entitlements: verified ? input.entitlements || [] : [],
  };
}

/** HMAC cookie session of a registered Members account. Not a payment entitlement. */
export function identityFromRegisteredSession(input: { userId: string }): AccessContext {
  return {
    userId: input.userId,
    role: 'FREE',
    userRight: 'NONE',
    verified: false,
    registered: true,
    entitlements: [],
  };
}

export function identityFromUntrustedClient(input: {
  maId?: string;
  email?: string;
  groups?: string[];
  query?: Record<string, string>;
  localStorage?: unknown;
}): AccessContext {
  void input;
  return { ...ANON_ACCESS };
}
