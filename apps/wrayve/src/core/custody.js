/**
 * Custody over time (WRASAL-0015).
 *
 * WRASAL-0014 modelled what WRASAL possesses at the instant a record is
 * written. It did not model what happens afterwards. The sandbox then
 * demonstrated the gap by destroying the first artefact WRASAL ever called
 * ARCHIVED, whose frozen statement still read "WRASAL durably holds the
 * artefact bytes" — a present-tense claim that outlived its own truth.
 *
 * The constitutional rule this module exists to protect:
 *
 *   Past informs. Future cannot rewrite.
 *
 * A later observation never falsifies an earlier record. It is appended
 * beside it. What decays is not the claim but its verifiability, so the
 * immutable historical proposition and the mutable current epistemic state
 * are kept as two separate objects and folded only at read time.
 *
 * THREE CLOCKS, never collapsed:
 *
 *   Event time    — when did the thing happen?
 *   Evidence time — when did WRASAL observe or record it?
 *   Custody time  — when could WRASAL last substantiate possession/integrity?
 */

import { DURABILITY, POSSESSION } from './artifact.js';

/**
 * What a single custody observation found.
 *
 * Only PRESENT_HASH_MISMATCH is a positive finding of corruption. The others
 * are degrees of not-knowing, and not-knowing is never falsehood.
 */
export const CUSTODY_RESULT = Object.freeze({
  /** Bytes re-read, digest recomputed, digest matches. */
  PRESENT_HASH_MATCH: 'PRESENT_HASH_MATCH',
  /** Bytes re-read, digest recomputed, digest DIFFERS. Dispositive. */
  PRESENT_HASH_MISMATCH: 'PRESENT_HASH_MISMATCH',
  /** WRASAL looked in storage it controls and the artefact was not there. */
  ABSENT: 'ABSENT',
  /** The reference could not be examined (unreadable, unresolvable). */
  INACCESSIBLE: 'INACCESSIBLE',
  /** No attempt was made. The honest state for anything WRASAL may not fetch. */
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
});

/**
 * The current epistemic state of an artefact's integrity.
 *
 * INTEGRITY_UNVERIFIED DOES NOT MEAN FALSE. It means WRASAL cannot presently
 * substantiate the claim. Uncertainty may remain uncertainty.
 */
export const CUSTODY_STATE = Object.freeze({
  /** Re-read and matched. The only state in which possession is provable now. */
  INTEGRITY_OK: 'INTEGRITY_OK',
  /** Cannot currently be substantiated. NOT a finding of falsehood. */
  INTEGRITY_UNVERIFIED: 'INTEGRITY_UNVERIFIED',
  /** Positively established corruption. The bytes are not what was recorded. */
  INTEGRITY_FAILED: 'INTEGRITY_FAILED',
});

/** A result maps to exactly one state. ABSENT and INACCESSIBLE are not failure. */
export const RESULT_STATE = Object.freeze({
  PRESENT_HASH_MATCH: CUSTODY_STATE.INTEGRITY_OK,
  PRESENT_HASH_MISMATCH: CUSTODY_STATE.INTEGRITY_FAILED,
  ABSENT: CUSTODY_STATE.INTEGRITY_UNVERIFIED,
  INACCESSIBLE: CUSTODY_STATE.INTEGRITY_UNVERIFIED,
  NOT_ATTEMPTED: CUSTODY_STATE.INTEGRITY_UNVERIFIED,
});

/**
 * What each result does and does not license WRASAL to say. These strings are
 * written for an operator reading the console, and each one names the
 * inference that is NOT available.
 */
export const RESULT_SEMANTICS = Object.freeze({
  PRESENT_HASH_MATCH: {
    establishes: 'The bytes WRASAL holds now are the bytes WRASAL recorded.',
    does_not_establish: 'That the artefact is authentic, or that it depicts what it claims to depict. Integrity is not authenticity.',
  },
  PRESENT_HASH_MISMATCH: {
    establishes: 'The bytes at this reference are NOT the bytes recorded. Something changed.',
    does_not_establish: 'Who or what changed them, or whether the original still exists elsewhere.',
  },
  ABSENT: {
    establishes: 'WRASAL cannot find this artefact in storage it controls.',
    does_not_establish: 'That the artefact ceased to exist. Existence and accessibility are different facts.',
  },
  INACCESSIBLE: {
    establishes: 'The reference could not be examined at this time.',
    does_not_establish: 'That the artefact is gone, or that it is intact.',
  },
  NOT_ATTEMPTED: {
    establishes: 'Nothing. No observation was made.',
    does_not_establish: 'Anything whatsoever. This is the correct state for a reference WRASAL is not permitted to fetch.',
  },
});

/**
 * Fold an immutable artefact record plus its appended observations into the
 * current epistemic state.
 *
 * The historical proposition is reproduced verbatim and never edited. The
 * current state is derived. The two are returned side by side precisely so
 * that a reader can see both what was claimed and what is now knowable.
 *
 * @param {object} artifactRecord  the frozen record from the GenerationEvent
 * @param {object[]} observations  appended CustodyObservations, oldest first
 * @param {object} [clocks]        {event_time, evidence_time}
 */
export function foldCustody(artifactRecord, observations = [], clocks = {}) {
  const ordered = [...observations].sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at)));
  const latest = ordered.length ? ordered[ordered.length - 1] : null;

  const currentState = latest
    ? RESULT_STATE[latest.result]
    : CUSTODY_STATE.INTEGRITY_UNVERIFIED;

  // Custody time is the last moment WRASAL could actually SUBSTANTIATE the
  // claim — not merely the last time it looked. A failed look does not
  // refresh it.
  const lastSubstantiated = [...ordered]
    .reverse()
    .find((observation) => observation.result === CUSTODY_RESULT.PRESENT_HASH_MATCH) ?? null;

  return Object.freeze({
    /**
     * IMMUTABLE. What WRASAL recorded at the time. Reproduced, never revised.
     * A later observation cannot reach back and make this untrue; it was a
     * faithful record of what was known then.
     */
    historical_proposition: Object.freeze({
      statement: artifactRecord?.possession_statement ?? null,
      reference_class: artifactRecord?.reference_class ?? null,
      claimed_possession: artifactRecord?.possession ?? null,
      claimed_durability: artifactRecord?.durability ?? null,
      claimed_evidence_level: artifactRecord?.evidence_level ?? null,
      content_hash: artifactRecord?.content_hash ?? null,
      recorded_at: clocks.evidence_time ?? null,
    }),

    /** APPENDED. Every look WRASAL has taken since, in order. */
    observations: Object.freeze(ordered.map((observation) => Object.freeze({ ...observation }))),

    /** DERIVED. What can be known right now. Recomputed on every read. */
    current_epistemic_state: currentState,

    /** The three clocks, kept apart on purpose. */
    clocks: Object.freeze({
      event_time: clocks.event_time ?? null,
      evidence_time: clocks.evidence_time ?? null,
      custody_time: lastSubstantiated?.observed_at ?? null,
    }),

    ever_substantiated: Boolean(lastSubstantiated),
    last_observed_at: latest?.observed_at ?? null,
    last_result: latest?.result ?? CUSTODY_RESULT.NOT_ATTEMPTED,
    observation_count: ordered.length,
    state_note: currentState === CUSTODY_STATE.INTEGRITY_UNVERIFIED
      ? 'INTEGRITY_UNVERIFIED does not mean the artefact is gone or false. It means WRASAL cannot presently substantiate the claim.'
      : null,
  });
}

/**
 * Report the gap between what a record CLAIMS and what WRASAL can currently
 * SUBSTANTIATE.
 *
 * This is the finding WRASAL-0015 exists to surface, and it is deliberately
 * not repaired here: a claim of durability that has never been substantiated
 * is reported as an unsubstantiated claim, not quietly downgraded and not
 * redefined so that the implementation passes.
 */
export function substantiationGap(artifactRecord, folded) {
  const claimsDurability = artifactRecord?.durability === DURABILITY.DURABLE;
  const claimsPossession = artifactRecord?.possession === POSSESSION.BYTES_HELD;
  const substantiated = folded.current_epistemic_state === CUSTODY_STATE.INTEGRITY_OK;

  const gaps = [];
  if (claimsPossession && !substantiated) {
    gaps.push({
      code: 'UNSUBSTANTIATED_POSSESSION_CLAIM',
      claimed: 'BYTES_HELD',
      currently_substantiated: false,
      detail: 'This record asserts WRASAL holds the artefact bytes. That assertion cannot currently be substantiated by observation.',
    });
  }
  if (claimsDurability && !folded.ever_substantiated) {
    gaps.push({
      code: 'UNSUBSTANTIATED_DURABILITY_CLAIM',
      claimed: 'DURABLE',
      currently_substantiated: false,
      detail: 'Durability was inferred from the reference class, never measured. WRASAL has never re-read these bytes and therefore has never substantiated that they persist.',
    });
  }
  if (folded.current_epistemic_state === CUSTODY_STATE.INTEGRITY_FAILED) {
    gaps.push({
      code: 'INTEGRITY_CONTRADICTED',
      claimed: artifactRecord?.content_hash ?? null,
      currently_substantiated: false,
      detail: 'Observation positively established that the bytes at this reference differ from those recorded. This is the one custody result that is dispositive.',
    });
  }
  return gaps;
}

/**
 * Guard. The Steward folds and reports; it must never mutate a historical
 * record. Any code path that would alter a frozen artefact record is a bug,
 * and this turns it into a loud one.
 */
export function assertNoRetroactiveRewrite(before, after, context = {}) {
  const changed = Object.keys(before ?? {}).filter((key) => before[key] !== after?.[key]);
  if (changed.length > 0) {
    const error = new Error(
      `Retroactive rewrite refused: a custody observation attempted to alter the historical record (${changed.join(', ')})`,
    );
    error.code = 'RETROACTIVE_REWRITE';
    error.detail = { changed_fields: changed, ...context };
    throw error;
  }
  return true;
}
