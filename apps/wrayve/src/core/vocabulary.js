/**
 * WRAYVE canonical vocabulary.
 *
 * Every enumerated value the system is allowed to record lives here.
 * Nothing in the application may invent a status string at runtime.
 */

/** Identity lifecycle. */
export const IDENTITY_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  RETIRED: 'RETIRED',
});

/** IdentitySnapshot lifecycle. Snapshots are never mutated, only superseded. */
export const SNAPSHOT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  INACTIVE: 'INACTIVE',
});

/** SceneSpec lifecycle. */
export const SCENE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  READY: 'READY',
  ARCHIVED: 'ARCHIVED',
});

/**
 * §10 Approval / execution state machine.
 * This is the single lifecycle of an ExecutionRequest.
 */
export const LIFECYCLE = Object.freeze({
  DRAFT: 'DRAFT',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  EXECUTING: 'EXECUTING',
  GENERATED: 'GENERATED',
  REVIEWED: 'REVIEWED',
  ARCHIVED: 'ARCHIVED',
  // terminal alternatives
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
});

/** Permitted lifecycle transitions. Anything not listed here is refused. */
export const LIFECYCLE_TRANSITIONS = Object.freeze({
  DRAFT: ['READY_FOR_REVIEW', 'CANCELLED'],
  READY_FOR_REVIEW: ['PENDING_APPROVAL', 'CANCELLED', 'REJECTED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['GENERATED', 'FAILED'],
  GENERATED: ['REVIEWED', 'ARCHIVED'],
  REVIEWED: ['ARCHIVED'],
  ARCHIVED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED: [],
});

export const TERMINAL_LIFECYCLE_STATES = Object.freeze([
  LIFECYCLE.ARCHIVED,
  LIFECYCLE.REJECTED,
  LIFECYCLE.CANCELLED,
  LIFECYCLE.FAILED,
]);

/** Derived view of the approval dimension. Never stored independently. */
export const APPROVAL_STATUS = Object.freeze({
  NOT_REQUESTED: 'NOT_REQUESTED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

/** Derived view of the execution dimension. Never stored independently. */
export const EXECUTION_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  EXECUTING: 'EXECUTING',
  GENERATED: 'GENERATED',
  REVIEWED: 'REVIEWED',
  ARCHIVED: 'ARCHIVED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const AUTHORITY_STATUS = Object.freeze({
  UNCHECKED: 'UNCHECKED',
  AUTHORIZED: 'AUTHORIZED',
  DENIED: 'DENIED',
});

/**
 * Execution mode.
 * REAL       — a live external provider call is attempted.
 * SIMULATION — no external provider is contacted; output is labelled SIMULATED.
 */
export const EXECUTION_MODE = Object.freeze({
  REAL: 'REAL',
  SIMULATION: 'SIMULATION',
});

/*
 * Provider keys deliberately do NOT live here.
 * The core domain treats a provider as an opaque registry key; the names of
 * real providers belong to the adapter layer (src/adapters/providers.js).
 */

/**
 * Contexts a SceneSpec can declare. Each maps to one LikenessPolicy permission.
 * The AuthorityCheck evaluates declared context against the policy — it never
 * infers context from free text.
 */
export const SCENE_CONTEXT = Object.freeze({
  commercial: 'commercial_allowed',
  political: 'political_allowed',
  sexualized: 'sexualized_allowed',
  deceptive_context: 'deceptive_context_allowed',
  identity_alteration: 'identity_alteration_allowed',
  public_distribution: 'public_distribution_allowed',
});

export const SCENE_CONTEXT_KEYS = Object.freeze(Object.keys(SCENE_CONTEXT));

/**
 * ProviderBinding status (WRASAL-0014).
 *
 * The formal join between a Representation Identity (IdentitySnapshot) and a
 * Provider Identity (whatever an external renderer happens to call the subject).
 * DECLARED means an operator asserted it. VERIFIED means WRASAL observed the
 * provider confirm it. Those are not the same claim and are never merged.
 */
export const BINDING_STATUS = Object.freeze({
  DECLARED: 'DECLARED',
  VERIFIED: 'VERIFIED',
  REVOKED: 'REVOKED',
});

/** §21 append-only event vocabulary. */
export const EVENT = Object.freeze({
  IDENTITY_CREATED: 'IDENTITY_CREATED',
  SNAPSHOT_CREATED: 'SNAPSHOT_CREATED',
  SNAPSHOT_SUPERSEDED: 'SNAPSHOT_SUPERSEDED',
  SNAPSHOT_DEACTIVATED: 'SNAPSHOT_DEACTIVATED',
  POLICY_CREATED: 'POLICY_CREATED',
  SCENE_CREATED: 'SCENE_CREATED',
  PROVIDER_BINDING_DECLARED: 'PROVIDER_BINDING_DECLARED',
  PROVIDER_BINDING_VERIFIED: 'PROVIDER_BINDING_VERIFIED',
  PROVIDER_BINDING_REVOKED: 'PROVIDER_BINDING_REVOKED',
  CUSTODY_OBSERVED: 'CUSTODY_OBSERVED',
  EXECUTION_REQUESTED: 'EXECUTION_REQUESTED',
  AUTHORITY_CHECKED: 'AUTHORITY_CHECKED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  EXECUTION_STARTED: 'EXECUTION_STARTED',
  EXECUTION_COMPLETED: 'EXECUTION_COMPLETED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  PROVIDER_CONTRACT_UNAVAILABLE: 'PROVIDER_CONTRACT_UNAVAILABLE',
  MEDIA_GENERATED: 'MEDIA_GENERATED',
  PROVENANCE_RECORDED: 'PROVENANCE_RECORDED',
  REVIEW_RECORDED: 'REVIEW_RECORDED',
  FREEBUFF_HANDOFF_CREATED: 'FREEBUFF_HANDOFF_CREATED',
});

/** Default asset visibility — §23. */
export const VISIBILITY = Object.freeze({
  PRIVATE: 'PRIVATE',
  INTERNAL: 'INTERNAL',
});

/** Used wherever a provider did not return a value. Never guessed. */
export const UNKNOWN = 'UNKNOWN';

/**
 * Derive the approval dimension from the lifecycle state.
 * There is exactly one source of truth: lifecycle_state.
 */
export function deriveApprovalStatus(lifecycleState) {
  switch (lifecycleState) {
    case LIFECYCLE.DRAFT:
    case LIFECYCLE.READY_FOR_REVIEW:
      return APPROVAL_STATUS.NOT_REQUESTED;
    case LIFECYCLE.PENDING_APPROVAL:
      return APPROVAL_STATUS.PENDING;
    case LIFECYCLE.REJECTED:
      return APPROVAL_STATUS.REJECTED;
    case LIFECYCLE.CANCELLED:
      return APPROVAL_STATUS.CANCELLED;
    default:
      return APPROVAL_STATUS.APPROVED;
  }
}

/** Derive the execution dimension from the lifecycle state. */
export function deriveExecutionStatus(lifecycleState) {
  switch (lifecycleState) {
    case LIFECYCLE.EXECUTING:
      return EXECUTION_STATUS.EXECUTING;
    case LIFECYCLE.GENERATED:
      return EXECUTION_STATUS.GENERATED;
    case LIFECYCLE.REVIEWED:
      return EXECUTION_STATUS.REVIEWED;
    case LIFECYCLE.ARCHIVED:
      return EXECUTION_STATUS.ARCHIVED;
    case LIFECYCLE.FAILED:
      return EXECUTION_STATUS.FAILED;
    case LIFECYCLE.CANCELLED:
      return EXECUTION_STATUS.CANCELLED;
    default:
      return EXECUTION_STATUS.NOT_STARTED;
  }
}

export function canTransition(from, to) {
  return (LIFECYCLE_TRANSITIONS[from] ?? []).includes(to);
}
