// Domain vocabulary. Single source of truth for the words WRASAL is allowed to
// use about reality. Nothing here knows about HTTP, SQL, or any model vendor.

export const EPISTEMIC_STATUS = Object.freeze({
  USER_SUPPLIED: 'user_supplied',
  OBSERVED: 'observed',
  EXTERNALLY_SUPPORTED: 'externally_supported',
  GENERATED_INTERPRETATION: 'generated_interpretation',
  UNKNOWN: 'unknown',
});

/**
 * Statuses that may be treated as establishing a fact about reality.
 * `generated_interpretation` is deliberately absent: machine output is never
 * self-certifying, and `unknown` asserts nothing.
 */
export const FACTUAL_STATUSES = Object.freeze([
  EPISTEMIC_STATUS.USER_SUPPLIED,
  EPISTEMIC_STATUS.OBSERVED,
  EPISTEMIC_STATUS.EXTERNALLY_SUPPORTED,
]);

export function isFactual(status) {
  return FACTUAL_STATUSES.includes(status);
}

export const CANONICAL_STATUS = Object.freeze({
  CANONICAL: 'canonical',
  PROVISIONAL: 'provisional',
  DISPUTED: 'disputed',
  SUPERSEDED: 'superseded',
  UNKNOWN: 'unknown',
});

export const CLAIM_STATUS = Object.freeze({
  SUPPORTED: 'supported',
  DISPUTED: 'disputed',
  UNRESOLVED: 'unresolved',
  REFUTED: 'refuted',
  UNKNOWN: 'unknown',
});

export const ACTOR_KIND = Object.freeze({
  HUMAN: 'human',
  AI: 'ai',
  SYSTEM: 'system',
});

export const AUTHORITY_LEVEL = Object.freeze({
  OBSERVER: 'observer',
  CONTRIBUTOR: 'contributor',
  AUTHOR: 'author',
  STEWARD: 'steward',
});

export const AUTHORITY_RANK = Object.freeze({
  observer: 0,
  contributor: 1,
  author: 2,
  steward: 3,
});

export const PROVENANCE_RELATIONS = Object.freeze([
  'derived_from',
  'version_of',
  'contains',
  'incorporates',
  'adapts',
  'supersedes',
  'related_to',
  'originates_from',
]);

/**
 * Lineage describes derivation, not ownership. Kept as an explicit constant so
 * that no future feature can quietly reinterpret provenance as a rights claim.
 */
export const PROVENANCE_DISCLAIMER =
  'Lineage relationships describe derivation and context. They do not establish ownership, licence, or rights.';

/** The literal WRASAL answer when the graph cannot support a statement. */
export const UNKNOWN = 'UNKNOWN';
