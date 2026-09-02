import type { ArchitectureFlags } from './types';
import accessPolicy from '../../spec/track-architecture/access-policy.json';

export const DEFAULT_ARCHITECTURE_FLAGS: ArchitectureFlags = {
  TRACK_REGISTRY_ENABLED: true,
  ROUTE_ENGINE_ENABLED: true,
  PAID_TRACK_NAVIGATION_ENABLED: false,
  PAYMENTS_ENABLED: false,
  ALLOW_DRAFT_RULES: false,
  ADMIN_PREVIEW_ENABLED: true,
  ENTITLEMENT_BYPASS: false,
  REGISTERED_BETA_ACCESS_ENABLED: true,
};

function truthy(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function falsey(value: string | undefined): boolean {
  return value === 'false' || value === '0';
}

/**
 * Production defaults cannot enable payments, paid navigation or entitlement bypass
 * even if the environment is misconfigured.
 */
export function resolveArchitectureFlags(env: NodeJS.Dict<string> = process.env): ArchitectureFlags {
  const production = env.NODE_ENV === 'production';
  const flags: ArchitectureFlags = {
    TRACK_REGISTRY_ENABLED: falsey(env.TRACK_REGISTRY_ENABLED)
      ? false
      : env.TRACK_REGISTRY_ENABLED
        ? truthy(env.TRACK_REGISTRY_ENABLED)
        : DEFAULT_ARCHITECTURE_FLAGS.TRACK_REGISTRY_ENABLED,
    ROUTE_ENGINE_ENABLED: falsey(env.ROUTE_ENGINE_ENABLED)
      ? false
      : env.ROUTE_ENGINE_ENABLED
        ? truthy(env.ROUTE_ENGINE_ENABLED)
        : DEFAULT_ARCHITECTURE_FLAGS.ROUTE_ENGINE_ENABLED,
    PAID_TRACK_NAVIGATION_ENABLED: truthy(env.PAID_TRACK_NAVIGATION_ENABLED),
    PAYMENTS_ENABLED: truthy(env.PAYMENTS_ENABLED),
    ALLOW_DRAFT_RULES: truthy(env.ALLOW_DRAFT_RULES),
    ADMIN_PREVIEW_ENABLED: falsey(env.ADMIN_PREVIEW_ENABLED)
      ? false
      : env.ADMIN_PREVIEW_ENABLED
        ? truthy(env.ADMIN_PREVIEW_ENABLED)
        : DEFAULT_ARCHITECTURE_FLAGS.ADMIN_PREVIEW_ENABLED,
    ENTITLEMENT_BYPASS: truthy(env.ENTITLEMENT_BYPASS),
    REGISTERED_BETA_ACCESS_ENABLED: falsey(env.REGISTERED_BETA_ACCESS_ENABLED)
      ? false
      : env.REGISTERED_BETA_ACCESS_ENABLED
        ? truthy(env.REGISTERED_BETA_ACCESS_ENABLED)
        : DEFAULT_ARCHITECTURE_FLAGS.REGISTERED_BETA_ACCESS_ENABLED,
  };

  if (production) {
    flags.PAID_TRACK_NAVIGATION_ENABLED = false;
    flags.PAYMENTS_ENABLED = false;
    flags.ALLOW_DRAFT_RULES = false;
    flags.ENTITLEMENT_BYPASS = false;
  }

  return flags;
}

export function accessPolicyVersion(): string {
  return String(accessPolicy.version || '1.0');
}

export { accessPolicy };
