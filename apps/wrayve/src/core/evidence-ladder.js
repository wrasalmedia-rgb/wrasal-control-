/**
 * WRASAL evidence ladder (WRASAL-0014).
 *
 *   UNKNOWN → DOCUMENTED → OBSERVED → EXECUTED → VERIFIED → ARCHIVED
 *
 * Each rung carries a different evidentiary burden. The ladder exists so that
 * the system can state precisely how much it actually knows about any claim,
 * instead of collapsing "the docs say so" and "we watched it happen" into a
 * single boolean.
 *
 * The governing rule, demonstrated experimentally by WRASAL-0013:
 *
 *   Provider documentation is not provider truth.
 *
 * A documented field can establish DOCUMENTED. It can never establish EXECUTED.
 */

export const EVIDENCE_LEVEL = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  DOCUMENTED: 'DOCUMENTED',
  OBSERVED: 'OBSERVED',
  EXECUTED: 'EXECUTED',
  VERIFIED: 'VERIFIED',
  ARCHIVED: 'ARCHIVED',
});

export const EVIDENCE_ORDER = Object.freeze([
  EVIDENCE_LEVEL.UNKNOWN,
  EVIDENCE_LEVEL.DOCUMENTED,
  EVIDENCE_LEVEL.OBSERVED,
  EVIDENCE_LEVEL.EXECUTED,
  EVIDENCE_LEVEL.VERIFIED,
  EVIDENCE_LEVEL.ARCHIVED,
]);

/**
 * The burden each rung requires. These are not decorative: claim() refuses to
 * return a level whose burden is not satisfied by the supplied evidence.
 *
 * DOCUMENTED is the one rung that is NOT on the cumulative chain. Reading a
 * document is a different KIND of evidence from watching the system behave,
 * and it is the weaker kind. A live observation must never be held back
 * because nobody filed the documentation reference — that would rank
 * "the docs say so" above "we saw it happen", which inverts the whole point
 * of the ladder. From OBSERVED upward the burden is strictly cumulative.
 */
export const EVIDENCE_BURDEN = Object.freeze({
  UNKNOWN: {
    rank: 0,
    burden: 'Nothing is known. This is the honest default and is never a failure state.',
    requires: [],
  },
  DOCUMENTED: {
    rank: 1,
    burden: 'A provider or specification document describes the behaviour. Nobody has seen it happen.',
    requires: ['documentation_reference'],
  },
  OBSERVED: {
    rank: 2,
    burden: 'WRASAL made a request and received a real response. The system existed and answered.',
    requires: ['observed_response'],
  },
  EXECUTED: {
    rank: 3,
    burden: 'The provider reported that it carried out the instruction. Acceptance of a request is NOT execution.',
    requires: ['observed_response', 'provider_reported_completion'],
  },
  VERIFIED: {
    rank: 4,
    burden: 'WRASAL independently confirmed the result, not merely the provider\'s report of it. Requires a content hash.',
    requires: ['observed_response', 'provider_reported_completion', 'content_hash'],
  },
  ARCHIVED: {
    rank: 5,
    burden: 'WRASAL durably holds the artefact bytes it hashed. The claim survives the provider withdrawing the reference.',
    requires: ['observed_response', 'provider_reported_completion', 'content_hash', 'durable_possession'],
  },
});

export function rank(level) {
  return EVIDENCE_BURDEN[level]?.rank ?? -1;
}

export function atLeast(level, minimum) {
  return rank(level) >= rank(minimum);
}

/**
 * Highest rung the supplied evidence actually supports.
 *
 * @param {object} evidence
 * @param {string|null} [evidence.documentation_reference]
 * @param {boolean} [evidence.observed_response]
 * @param {boolean} [evidence.provider_reported_completion]
 * @param {string|null} [evidence.content_hash]
 * @param {boolean} [evidence.durable_possession]
 * @returns {{level: string, satisfied: string[], missing_for_next: string[]}}
 */
export function claim(evidence = {}) {
  const have = {
    documentation_reference: Boolean(evidence.documentation_reference),
    observed_response: Boolean(evidence.observed_response),
    provider_reported_completion: Boolean(evidence.provider_reported_completion),
    content_hash: Boolean(evidence.content_hash),
    durable_possession: Boolean(evidence.durable_possession),
  };

  // Take the HIGHEST fully-satisfied rung rather than stopping at the first
  // gap: a higher rung subsumes the evidentiary weight of the ones below it.
  let achieved = EVIDENCE_LEVEL.UNKNOWN;
  for (const level of EVIDENCE_ORDER) {
    const required = EVIDENCE_BURDEN[level].requires;
    if (required.every((key) => have[key]) && rank(level) > rank(achieved)) achieved = level;
  }

  const nextLevel = EVIDENCE_ORDER[rank(achieved) + 1] ?? null;
  const missingForNext = nextLevel
    ? EVIDENCE_BURDEN[nextLevel].requires.filter((key) => !have[key])
    : [];

  return {
    level: achieved,
    satisfied: Object.entries(have).filter(([, value]) => value).map(([key]) => key),
    next_level: nextLevel,
    missing_for_next: missingForNext,
  };
}

/**
 * Guard. Throws if a claimed level exceeds what the evidence supports.
 * Used wherever the system is about to assert something to a downstream
 * consumer (provenance, Freebuff, the console).
 */
export function assertClaimable(claimedLevel, evidence, context = {}) {
  const supported = claim(evidence);
  if (rank(claimedLevel) > rank(supported.level)) {
    const error = new Error(
      `Evidence level ${claimedLevel} claimed but only ${supported.level} is supported`,
    );
    error.code = 'EVIDENCE_OVERCLAIM';
    error.detail = {
      claimed: claimedLevel,
      supported: supported.level,
      missing: EVIDENCE_BURDEN[claimedLevel].requires.filter(
        (key) => !supported.satisfied.includes(key),
      ),
      ...context,
    };
    throw error;
  }
  return supported;
}
