import { EventLog } from '../src/core/event-log.js';
import { WrayveService } from '../src/core/service.js';
import { AdapterRegistry } from '../src/adapters/registry.js';
import { MockExecutionAdapter } from '../src/adapters/mock-adapter.js';
import { HeyGenAdapter } from '../src/adapters/heygen-adapter.js';
import { RunwayAdapter } from '../src/adapters/runway-adapter.js';
import { PROVIDER } from '../src/adapters/providers.js';

/** Deterministic clock so recorded timestamps are assertable. */
export function fixedClock(startIso = '2026-01-01T00:00:00.000Z') {
  let tick = 0;
  return () => new Date(Date.parse(startIso) + (tick += 1000)).toISOString();
}

/** In-memory media store stand-in — records writes, touches no disk. */
export function memoryMediaStore() {
  const written = [];
  return {
    written,
    writeSimulatedPlaceholder(input) {
      written.push(input);
      return { reference: `wrasal-local://media/${input.job_id}.svg`, file_name: `${input.job_id}.svg`, visibility: 'PRIVATE', media_type: 'image/svg+xml' };
    },
    resolve: () => null,
  };
}

/**
 * Build a service with whatever providers a test needs.
 * @param {object} options
 * @param {object} [options.heygen] { apiKey, binding, fetchImpl }
 */
export function makeService({ heygen = null, withRunway = false } = {}) {
  const clock = fixedClock();
  const mediaStore = memoryMediaStore();
  const registry = new AdapterRegistry();
  registry.register(PROVIDER.MOCK, new MockExecutionAdapter({ mediaStore }));
  registry.register(PROVIDER.HEYGEN, new HeyGenAdapter({
    apiKey: heygen?.apiKey ?? null,
    binding: heygen?.binding ?? null,
    // Surface must be named explicitly — exactly as an operator must in production.
    surface: heygen?.surface ?? null,
    fetchImpl: heygen?.fetchImpl ?? (() => { throw new Error('network disabled in tests'); }),
  }));
  if (withRunway) registry.register(PROVIDER.RUNWAY, new RunwayAdapter());

  const service = new WrayveService({ eventLog: new EventLog({ clock }), registry, mediaStore, clock });
  return { service, registry, mediaStore, clock };
}

/** Canonical WRAY fixture: identity + active snapshot + default policy. */
export function seedWray(service, { permissions = {} } = {}) {
  const identity = service.createIdentity({ id: 'WRAY-001', canonical_name: 'Wray' });
  const snapshot = service.createSnapshot({
    identity_id: identity.id,
    face_reference: 'wrasal-ref://wray/face/v0.1',
    voice_reference: 'wrasal-ref://wray/voice/v0.1',
    appearance_profile: 'Dark structured silhouette.',
    performance_profile: 'Still, controlled, direct eye contact.',
    canonical_notes: 'First canonical capture.',
  });
  const policy = service.createPolicy({ identity_snapshot_id: snapshot.id, permissions });
  return { identity, snapshot, policy };
}

export function blackRoomScene(service, snapshotId, intended_context = { commercial: true }) {
  return service.createScene({
    identity_snapshot_id: snapshotId,
    title: 'WRAY / BLACK ROOM TEST',
    environment: 'Minimal black studio',
    wardrobe: 'Black structured jacket',
    performance_direction: 'Still, controlled, direct eye contact',
    camera_direction: '85mm portrait, subtle dolly-in',
    dialogue: 'This is not an avatar. This is an identity under authority.',
    voice_direction: 'Low register. Unhurried.',
    duration_seconds: 12,
    intended_context,
  });
}

/** Minimal fetch double. `routes` maps "METHOD /path-prefix" -> response spec. */
export function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    const path = new URL(url).pathname;
    calls.push({ method, url, path, body: options.body ? JSON.parse(options.body) : null, headers: options.headers });
    const key = Object.keys(routes).find((candidate) => {
      const [routeMethod, routePath] = candidate.split(' ');
      return routeMethod === method && path.startsWith(routePath);
    });
    if (!key) return jsonResponse(404, { error: { message: `no fake route for ${method} ${path}` } });
    const spec = routes[key];
    if (typeof spec === 'function') return spec({ method, path, url });
    return jsonResponse(spec.status ?? 200, spec.body ?? {}, spec.headers ?? {});
  };
  impl.calls = calls;
  return impl;
}

export function jsonResponse(status, body, headers = {}) {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower.get(String(name).toLowerCase()) ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
