import type { AccessContext, AccessRole, EntitlementGrant } from './types';

export const ANON_ACCESS: AccessContext = {
  userId: null,
  role: 'ANON',
  verified: false,
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
  entitlements?: EntitlementGrant[];
}): AccessContext {
  const verified = input.verified === true;
  const requested = input.role || 'FREE';
  const role: AccessRole = verified ? requested : requested === 'ANON' ? 'ANON' : 'FREE';
  return {
    userId: input.userId,
    role,
    verified,
    entitlements: verified ? input.entitlements || [] : [],
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
