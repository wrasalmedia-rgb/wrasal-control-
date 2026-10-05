/**
 * Provider keys.
 *
 * These live in the adapter layer on purpose. The core domain (identity,
 * snapshot, policy, scene, authority, approval, provenance) must never import
 * this file — it treats a provider as an opaque registry key. The architecture
 * test in tests/architecture.test.mjs enforces that.
 */
export const PROVIDER = Object.freeze({
  HEYGEN: 'HEYGEN',
  MOCK: 'MOCK',
  RUNWAY: 'RUNWAY',
});
