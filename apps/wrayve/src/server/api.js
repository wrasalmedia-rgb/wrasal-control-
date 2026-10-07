import { WrayveService } from '../core/service.js';
import { publicConfigView } from '../core/config.js';
import { EXECUTION_MODE, SCENE_CONTEXT_KEYS } from '../core/vocabulary.js';
import { NotFoundError } from '../core/errors.js';

/**
 * HTTP API surface.
 *
 * Note what is NOT here: there is no route that reaches a provider, and no
 * route that sets an approval or authority field directly. The browser can only
 * ask the service to perform a governed operation.
 */
export function buildRoutes({ service, config }) {
  return [
    route('GET', /^\/api\/state$/, () => fullState(service, config)),

    route('GET', /^\/api\/integrity$/, () => service.integrity()),

    route('POST', /^\/api\/identities$/, (_params, body) => service.createIdentity(body)),

    route('POST', /^\/api\/snapshots$/, (_params, body) => service.createSnapshot(body)),

    route('POST', /^\/api\/snapshots\/([^/]+)\/deactivate$/, ([id], body) =>
      service.deactivateSnapshot({ snapshot_id: id, ...body })),

    route('POST', /^\/api\/policies$/, (_params, body) => service.createPolicy(body)),

    route('POST', /^\/api\/scenes$/, (_params, body) => service.createScene(body)),

    route('POST', /^\/api\/executions$/, (_params, body) => service.requestExecution(body)),

    route('GET', /^\/api\/executions\/([^/]+)\/review$/, ([id]) => service.executionReview(id)),

    route('POST', /^\/api\/executions\/([^/]+)\/authority-check$/, ([id], body) =>
      service.runAuthorityCheck(id, body)),

    route('POST', /^\/api\/executions\/([^/]+)\/approve$/, ([id], body) => service.approve(id, body)),

    route('POST', /^\/api\/executions\/([^/]+)\/reject$/, ([id], body) => service.reject(id, body)),

    route('POST', /^\/api\/executions\/([^/]+)\/execute$/, ([id], body) => service.execute(id, body)),

    route('POST', /^\/api\/executions\/([^/]+)\/record-review$/, ([id], body) => service.recordReview(id, body)),

    route('POST', /^\/api\/executions\/([^/]+)\/archive$/, ([id], body) => service.archive(id, body)),

    route('POST', /^\/api\/provider-bindings$/, (_params, body) => service.declareProviderBinding(body)),

    route('POST', /^\/api\/provider-bindings\/([^/]+)\/verify$/, ([id], body) =>
      service.verifyProviderBinding(id, body)),

    route('POST', /^\/api\/provider-bindings\/([^/]+)\/revoke$/, ([id], body) =>
      service.revokeProviderBinding(id, body)),

    route('GET', /^\/api\/custody$/, () => service.custodyReport()),

    route('GET', /^\/api\/custody\/([^/]+)$/, ([id]) => service.custodyFor(id)),

    route('POST', /^\/api\/custody\/([^/]+)\/observe$/, ([id], body) =>
      service.observeCustody(id, body)),

    route('GET', /^\/api\/provenance\/([^/]+)$/, ([id]) => service.provenanceChain(id)),

    route('POST', /^\/api\/freebuff\/([^/]+)$/, ([id], body) => service.createFreebuffHandoff(id, body)),
  ];
}

function route(method, pattern, handler) {
  return { method, pattern, handler };
}

export function fullState(service, config) {
  const requests = service.listRequests();
  return {
    product: { name: 'WRAYVE', subtitle: 'WRASAL Identity Execution System' },
    identities: service.listIdentities().map((identity) => ({
      ...identity,
      snapshots: service.snapshotsFor(identity.id).map((snapshot) => ({
        ...snapshot,
        policy: service.policyFor(snapshot.id),
        policy_history: service.policyHistoryFor(snapshot.id),
        provider_bindings: service.listProviderBindings()
          .filter((binding) => binding.identity_snapshot_id === snapshot.id),
      })),
      active_snapshot_id: service.activeSnapshotFor(identity.id)?.id ?? null,
    })),
    scenes: service.listScenes(),
    requests,
    generation_events: service.listGenerationEvents(),
    handoffs: service.listHandoffs(),
    provider_bindings: service.listProviderBindings(),
    custody: service.custodyReport(),
    events: service.events({ limit: 400 }),
    integrity: service.integrity(),
    providers: service.registry.describe(),
    vocabulary: {
      providers: service.registry.list(),
      modes: Object.values(EXECUTION_MODE),
      scene_contexts: SCENE_CONTEXT_KEYS,
      default_policy: WrayveService.defaultPolicy(),
    },
    settings: publicConfigView(config),
  };
}

export function notFound(pathname) {
  return new NotFoundError(`no route for ${pathname}`);
}
