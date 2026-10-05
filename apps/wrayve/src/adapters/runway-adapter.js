import { IdentityExecutionAdapter, emptyProviderResult } from './identity-execution-adapter.js';
import { ProviderContractError } from '../core/errors.js';

/**
 * §28 Architectural test adapter.
 *
 * Runway exists here to prove one thing: a second provider can be registered
 * and selected without touching Identity, IdentitySnapshot, LikenessPolicy,
 * SceneSpec, AuthorityCheck, Approval, GenerationEvent or Provenance.
 *
 * No Runway API contract has been verified from this environment, so this
 * adapter does exactly what the discipline requires: it stops at the boundary
 * and reports the missing contract. It does not guess an endpoint shape.
 */
export class RunwayAdapter extends IdentityExecutionAdapter {
  static provider = 'RUNWAY';
  static label = 'Runway (contract not established)';
  static isExternal = true;
  static isSimulation = false;

  static contract = {
    provider: 'RUNWAY',
    contract_id: 'runway/undeclared',
    verification_state: 'NOT_ESTABLISHED',
    verification_note: 'No Runway endpoint, request schema, response schema or credential has been recorded for this environment. WRAYVE refuses to assume one.',
    credentials: [{ name: 'RUNWAY_API_KEY', transport: 'UNKNOWN', storage: 'server-side environment variable only' }],
    endpoints: [],
    required_response_fields: [],
    required_provider_binding: ['UNKNOWN'],
  };

  readiness() {
    return {
      provider: 'RUNWAY',
      ready_for_real_execution: false,
      contract_verification_state: RunwayAdapter.contract.verification_state,
      missing_contract_elements: [
        { contract_element: 'endpoint:generate', status: 'UNDECLARED', detail: 'No verified Runway generation endpoint is recorded.' },
        { contract_element: 'schema:request', status: 'UNDECLARED', detail: 'No verified Runway request schema is recorded.' },
        { contract_element: 'schema:response', status: 'UNDECLARED', detail: 'No verified Runway response schema is recorded.' },
        { contract_element: 'credential:RUNWAY_API_KEY', status: 'ABSENT', detail: 'Not present in the server environment.' },
      ],
    };
  }

  #refuse(stage) {
    throw new ProviderContractError(
      'Runway execution contract has not been established for this environment.',
      {
        provider: 'RUNWAY',
        stage,
        missing_contract_elements: this.readiness().missing_contract_elements,
        remedy: 'Record a verified Runway contract (endpoint, request schema, response schema, credential) before enabling real Runway execution. WRAYVE will not infer it.',
      },
    );
  }

  async validate() { return this.#refuse('validate'); }
  compile() { return this.#refuse('compile'); }
  async execute() { return this.#refuse('execute'); }
  async retrieve() { return this.#refuse('retrieve'); }
  normalize() { return emptyProviderResult(); }
}
