/**
 * §8 IdentityExecutionAdapter.
 *
 * The only surface through which WRASAL is allowed to reach an external
 * execution provider. Nothing above this boundary knows what HeyGen is; nothing
 * below it is allowed to know what an Identity, a LikenessPolicy or an approval
 * is — it receives an already-authorised ExecutionOrder and nothing more.
 *
 * Contract:
 *   validate(order)  -> { ok: true, contract } | throws ProviderContractError
 *   compile(order)   -> provider-shaped payload (pure, no I/O)
 *   execute(order)   -> { provider_job_id, raw } (I/O)
 *   retrieve(handle) -> raw provider status/result (I/O)
 *   normalize(raw)   -> canonical ProviderResult
 *
 * Every adapter MUST refuse rather than improvise. If an endpoint, field or
 * capability is not available in this environment, the adapter throws
 * ProviderContractError describing the missing contract. It never returns a
 * plausible-looking result.
 */
export class IdentityExecutionAdapter {
  /** @type {string} provider key from vocabulary.PROVIDER */
  static provider = 'ABSTRACT';

  /** Short human label for the console. */
  static label = 'Abstract adapter';

  /**
   * Declared contract this adapter depends on. Surfaced in SETTINGS so an
   * operator can see exactly what the system believes about the provider and
   * whether that belief has been verified in this environment.
   */
  static contract = {
    provider: 'ABSTRACT',
    verification_state: 'UNVERIFIED',
    endpoints: [],
    required_response_fields: [],
  };

  /** Does this adapter contact an external system at all? */
  static isExternal = true;

  /** Does this adapter produce output labelled SIMULATED? */
  static isSimulation = false;

  // eslint-disable-next-line no-unused-vars
  async validate(order) {
    throw new Error('IdentityExecutionAdapter.validate must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  compile(order) {
    throw new Error('IdentityExecutionAdapter.compile must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async execute(order) {
    throw new Error('IdentityExecutionAdapter.execute must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async retrieve(handle) {
    throw new Error('IdentityExecutionAdapter.retrieve must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  normalize(raw) {
    throw new Error('IdentityExecutionAdapter.normalize must be implemented');
  }
}

/**
 * Canonical, provider-neutral result shape.
 * Any field a provider does not return stays UNKNOWN or null — never guessed.
 */
export function emptyProviderResult() {
  return {
    provider_job_id: null,
    provider_model: 'UNKNOWN',
    provider_model_version: 'UNKNOWN',
    provider_timestamp: null,
    generation_parameters: null,
    output_reference: null,
    output_media_type: 'UNKNOWN',
    output_duration_seconds: null,
    execution_status: 'UNKNOWN',
    simulated: false,
    raw_provider_payload: null,
    // WRASAL-0014: what WRASAL actually possesses, as opposed to what it can
    // currently point at. See core/artifact.js.
    artifact: null,
    unresolved_contract_fields: [],
  };
}
