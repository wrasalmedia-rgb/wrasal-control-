import { PROVIDER } from './providers.js';
import { NotFoundError } from '../core/errors.js';
import { MockExecutionAdapter } from './mock-adapter.js';
import { HeyGenAdapter } from './heygen-adapter.js';
import { RunwayAdapter } from './runway-adapter.js';

/**
 * Provider registry.
 *
 * This is the ONLY file that needs to change to add, remove or swap a provider.
 * If a provider change ever forces an edit to the identity model, the
 * abstraction is wrong (§28).
 */
export class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(providerKey, adapter) {
    this.adapters.set(providerKey, adapter);
    return this;
  }

  unregister(providerKey) {
    this.adapters.delete(providerKey);
    return this;
  }

  has(providerKey) {
    return this.adapters.has(providerKey);
  }

  get(providerKey) {
    const adapter = this.adapters.get(providerKey);
    if (!adapter) {
      throw new NotFoundError(`No execution adapter registered for provider ${providerKey}`, {
        registered: this.list(),
      });
    }
    return adapter;
  }

  list() {
    return [...this.adapters.keys()];
  }

  describe() {
    return [...this.adapters.entries()].map(([key, adapter]) => {
      const ctor = adapter.constructor;
      return {
        provider: key,
        label: ctor.label,
        is_external: ctor.isExternal,
        is_simulation: ctor.isSimulation,
        contract: ctor.contract,
        readiness: typeof adapter.readiness === 'function'
          ? adapter.readiness()
          : { provider: key, ready_for_real_execution: true, contract_verification_state: 'NOT_APPLICABLE', missing_contract_elements: [] },
      };
    });
  }
}

/**
 * Default wiring for the running application.
 * @param {object} options
 * @param {object} options.mediaStore
 * @param {object} options.config
 */
export function buildDefaultRegistry({ mediaStore, config }) {
  const registry = new AdapterRegistry();
  registry.register(PROVIDER.MOCK, new MockExecutionAdapter({ mediaStore }));
  registry.register(PROVIDER.HEYGEN, new HeyGenAdapter({
    apiKey: config.heygenApiKey,
    binding: config.heygenBinding,
  }));
  registry.register(PROVIDER.RUNWAY, new RunwayAdapter());
  return registry;
}
