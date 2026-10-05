/**
 * WRAYVE error taxonomy.
 *
 * The important member of this file is ProviderContractError. It exists so the
 * system can stop at the adapter boundary and say "the provider contract is not
 * available / not as declared" instead of inventing provider behaviour.
 */

export class WrayveError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = 'WrayveError';
    this.code = code;
    this.detail = detail;
    this.httpStatus = 400;
  }

  toJSON() {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}

export class ValidationError extends WrayveError {
  constructor(message, detail = null) {
    super('VALIDATION_FAILED', message, detail);
    this.name = 'ValidationError';
    this.httpStatus = 422;
  }
}

export class NotFoundError extends WrayveError {
  constructor(message, detail = null) {
    super('NOT_FOUND', message, detail);
    this.name = 'NotFoundError';
    this.httpStatus = 404;
  }
}

export class StateTransitionError extends WrayveError {
  constructor(message, detail = null) {
    super('ILLEGAL_STATE_TRANSITION', message, detail);
    this.name = 'StateTransitionError';
    this.httpStatus = 409;
  }
}

export class AuthorityError extends WrayveError {
  constructor(message, detail = null) {
    super('AUTHORITY_DENIED', message, detail);
    this.name = 'AuthorityError';
    this.httpStatus = 403;
  }
}

/**
 * Raised when the provider contract required to execute is absent, unverified,
 * or the provider returned something that does not match the declared contract.
 *
 * This error is NEVER substituted with a simulated success. It is recorded as a
 * truthful failure event and surfaced verbatim to the operator.
 */
export class ProviderContractError extends WrayveError {
  constructor(message, detail = null) {
    super('PROVIDER_CONTRACT_UNAVAILABLE', message, detail);
    this.name = 'ProviderContractError';
    this.httpStatus = 502;
  }
}

/** Raised when a provider was reachable but the job itself failed. */
export class ProviderExecutionError extends WrayveError {
  constructor(message, detail = null) {
    super('PROVIDER_EXECUTION_FAILED', message, detail);
    this.name = 'ProviderExecutionError';
    this.httpStatus = 502;
  }
}
