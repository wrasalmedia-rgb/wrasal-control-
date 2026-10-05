import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * §23 Secrets are read server-side only, from the environment.
 * Nothing in this object is ever serialised to the browser; the settings API
 * reports presence booleans only.
 */
export function loadConfig(env = process.env) {
  const dataDir = env.WRAYVE_DATA_DIR
    ? path.resolve(env.WRAYVE_DATA_DIR)
    : path.join(appRoot, 'data');

  const heygenApiKey = env.HEYGEN_API_KEY?.trim() || null;
  // WRASAL-0013: WRAYVE refuses to choose an API surface on documentation
  // alone. Unset means "unverified", not "use the default".
  const heygenSurface = env.HEYGEN_API_SURFACE?.trim() || null;
  const binding = {
    heygen_avatar_id: env.HEYGEN_AVATAR_ID?.trim() || null,
    heygen_voice_id: env.HEYGEN_VOICE_ID?.trim() || null,
    background_color: env.HEYGEN_BACKGROUND_COLOR?.trim() || null,
  };

  return {
    appRoot,
    dataDir,
    eventLogFile: path.join(dataDir, 'events.jsonl'),
    mediaDir: path.join(dataDir, 'media'),
    port: Number(env.PORT ?? 4173),
    host: env.HOST ?? '0.0.0.0',
    heygenApiKey,
    heygenSurface,
    heygenBinding: binding,
    seed: env.WRAYVE_SEED !== 'false',
  };
}

/** Browser-safe view of configuration. Presence only — never values. */
export function publicConfigView(config) {
  return {
    secrets: [
      {
        name: 'HEYGEN_API_KEY',
        present: Boolean(config.heygenApiKey),
        scope: 'server-side only',
        note: 'Never transmitted to the browser. WRAYVE reports presence, not value.',
      },
      { name: 'HEYGEN_AVATAR_ID', present: Boolean(config.heygenBinding.heygen_avatar_id), scope: 'provider binding' },
      { name: 'HEYGEN_VOICE_ID', present: Boolean(config.heygenBinding.heygen_voice_id), scope: 'provider binding' },
      { name: 'RUNWAY_API_KEY', present: false, scope: 'provider binding', note: 'No Runway contract established.' },
    ],
    heygen_api_surface: {
      selected: config.heygenSurface,
      available: ['v2_legacy', 'v3'],
      note: 'WRASAL-0013: no HeyGen surface has been observed from this environment. An operator must select one explicitly before real execution.',
    },
    data_directory: config.dataDir,
    default_asset_visibility: 'PRIVATE',
  };
}
