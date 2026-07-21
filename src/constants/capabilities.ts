import {
  CAPABILITY_CATEGORIES as UPSTREAM_CAPABILITY_CATEGORIES,
  CapabilityImplications as UPSTREAM_CAPABILITY_IMPLICATIONS,
  expandImplications as expandUpstreamImplications,
  hasImpliedCapability as hasUpstreamImpliedCapability,
  SystemCapabilities as UPSTREAM_SYSTEM_CAPABILITIES,
} from '@librechat/data-schemas/capabilities';

const PROVIDER_CAPABILITIES = {
  READ_PROVIDERS: 'read:providers',
  MANAGE_PROVIDERS: 'manage:providers',
} as const;

/**
 * Keep the admin panel compatible with a backend that has provider grants even
 * when its separately published data-schemas package predates those constants.
 */
export const SystemCapabilities = {
  ...UPSTREAM_SYSTEM_CAPABILITIES,
  ...PROVIDER_CAPABILITIES,
} as const;

export const CapabilityImplications = {
  ...UPSTREAM_CAPABILITY_IMPLICATIONS,
  [SystemCapabilities.MANAGE_PROVIDERS]: [SystemCapabilities.READ_PROVIDERS],
};

export function hasImpliedCapability(held: string[], required: string): boolean {
  if (hasUpstreamImpliedCapability(held, required)) return true;
  return (
    required === SystemCapabilities.READ_PROVIDERS &&
    held.includes(SystemCapabilities.MANAGE_PROVIDERS)
  );
}

export function expandImplications(directCapabilities: string[]): string[] {
  const expanded = new Set(expandUpstreamImplications(directCapabilities));
  if (directCapabilities.includes(SystemCapabilities.MANAGE_PROVIDERS)) {
    expanded.add(SystemCapabilities.READ_PROVIDERS);
  }
  return [...expanded];
}

/**
 * Forward-compat shim: the LibreChat backend gates `/api/admin/audit-log` on
 * this capability string, and the LC sibling PR adds it to
 * `SystemCapabilities` in `@librechat/data-schemas@0.0.53`. Until that version
 * is published to npm and the pin here is bumped, referencing
 * `SystemCapabilities.READ_AUDIT_LOG` directly breaks `tsc` against the
 * currently-pinned `^0.0.52`. The value is byte-identical to what the upstream
 * constant will resolve to post-publish; drop this constant in a one-line
 * follow-up once the data-schemas pin moves to `^0.0.53`.
 */
export const READ_AUDIT_LOG_CAPABILITY = 'read:audit_log' as const;

/**
 * Local override of the upstream `CAPABILITY_CATEGORIES` so the System
 * category surfaces `READ_AUDIT_LOG` in the grants editing UI even while the
 * dep is pinned to `data-schemas@0.0.52` (which predates the category entry).
 * Without this, only seeded admins could ever hold the capability — the
 * grants `CapabilityPanel` had no row to toggle.
 *
 * Drops to a no-op once `0.0.53+` is pinned because the upstream array already
 * contains `READ_AUDIT_LOG`; the dedupe pass below keeps it safe to keep
 * shipped until the shim itself is removed.
 */
const upstreamCapabilities = new Set(
  UPSTREAM_CAPABILITY_CATEGORIES.flatMap((category) => category.capabilities),
);

export const CAPABILITY_CATEGORIES: typeof UPSTREAM_CAPABILITY_CATEGORIES =
  UPSTREAM_CAPABILITY_CATEGORIES.map((cat) => {
    if (cat.key !== 'system') return cat;
    const missing = [
      SystemCapabilities.READ_PROVIDERS,
      SystemCapabilities.MANAGE_PROVIDERS,
      READ_AUDIT_LOG_CAPABILITY,
    ].filter((cap) => !upstreamCapabilities.has(cap));
    if (missing.length === 0) return cat;
    return {
      ...cat,
      capabilities: [...cat.capabilities, ...missing],
    } as typeof cat;
  });
