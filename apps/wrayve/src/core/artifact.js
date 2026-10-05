import crypto from 'node:crypto';
import { EVIDENCE_LEVEL, claim, rank } from './evidence-ladder.js';

/**
 * Artifact reference model (WRASAL-0014).
 *
 * The invariant this file exists to enforce:
 *
 *   An evidence record must never imply durable possession of an artifact
 *   when WRASAL only possesses an expiring provider reference.
 *
 * WRASAL-0013 found that a provider's documented output URL may be PRESIGNED, i.e. it
 * expires. A provenance chain that stores only that URL decays into
 * "evidence that there was a video" while still looking like "here is the
 * video". This module makes that difference explicit and machine-checkable.
 *
 * Note what this module deliberately does NOT do: it does not fetch, download
 * or archive anything. Modelling the epistemic state correctly comes first.
 */

export const REFERENCE_CLASS = Object.freeze({
  /** A provider-side identifier or URL whose lifetime WRASAL does not know. */
  PROVIDER_REFERENCE: 'PROVIDER_REFERENCE',
  /** A provider URL documented or observed to expire. Possession: none. */
  PRESIGNED_REFERENCE: 'PRESIGNED_REFERENCE',
  /** A reference WRASAL controls that is not known to expire. Bytes not yet hashed. */
  DURABLE_ARTIFACT: 'DURABLE_ARTIFACT',
  /** WRASAL has read the bytes and holds a digest of them. */
  CONTENT_HASH: 'CONTENT_HASH',
  /** WRASAL durably holds the bytes it hashed. */
  ARCHIVED_ARTIFACT: 'ARCHIVED_ARTIFACT',
  /** There is no retrievable artefact. Also the correct state for a failure. */
  ARTIFACT_UNAVAILABLE: 'ARTIFACT_UNAVAILABLE',
});

export const POSSESSION = Object.freeze({
  NONE: 'NONE',
  REFERENCE_ONLY: 'REFERENCE_ONLY',
  BYTES_HELD: 'BYTES_HELD',
});

export const DURABILITY = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  EXPIRING: 'EXPIRING',
  DURABLE: 'DURABLE',
});

/**
 * What each reference class actually entitles the system to say.
 * `max_evidence_level` is a ceiling, not a grant — the evidence still has to
 * satisfy the ladder's burden independently.
 */
export const REFERENCE_SEMANTICS = Object.freeze({
  PROVIDER_REFERENCE: {
    possession: POSSESSION.NONE,
    durability: DURABILITY.UNKNOWN,
    wrasal_holds_artifact: false,
    max_evidence_level: EVIDENCE_LEVEL.EXECUTED,
    statement: 'WRASAL holds a provider-side reference only. Its lifetime is not known to WRASAL and the artefact may become unretrievable without notice.',
  },
  PRESIGNED_REFERENCE: {
    possession: POSSESSION.NONE,
    durability: DURABILITY.EXPIRING,
    wrasal_holds_artifact: false,
    max_evidence_level: EVIDENCE_LEVEL.EXECUTED,
    statement: 'WRASAL holds an expiring provider URL. WRASAL does not possess this artefact. When the URL expires this record evidences that a generation occurred, NOT that the artefact is available.',
  },
  DURABLE_ARTIFACT: {
    possession: POSSESSION.REFERENCE_ONLY,
    durability: DURABILITY.DURABLE,
    wrasal_holds_artifact: false,
    max_evidence_level: EVIDENCE_LEVEL.EXECUTED,
    statement: 'WRASAL holds a reference it controls and that is not known to expire, but has not hashed the bytes.',
  },
  CONTENT_HASH: {
    possession: POSSESSION.REFERENCE_ONLY,
    durability: DURABILITY.UNKNOWN,
    wrasal_holds_artifact: false,
    max_evidence_level: EVIDENCE_LEVEL.VERIFIED,
    statement: 'WRASAL has read and hashed the artefact bytes. The hash proves what the artefact was; it does not guarantee the artefact is still retrievable.',
  },
  ARCHIVED_ARTIFACT: {
    possession: POSSESSION.BYTES_HELD,
    durability: DURABILITY.DURABLE,
    wrasal_holds_artifact: true,
    max_evidence_level: EVIDENCE_LEVEL.ARCHIVED,
    statement: 'WRASAL durably holds the artefact bytes and a digest of them. This claim survives the provider withdrawing its reference.',
  },
  ARTIFACT_UNAVAILABLE: {
    possession: POSSESSION.NONE,
    durability: DURABILITY.UNKNOWN,
    wrasal_holds_artifact: false,
    max_evidence_level: EVIDENCE_LEVEL.OBSERVED,
    statement: 'No retrievable artefact exists for this record.',
  },
});

/**
 * Build an immutable artefact record.
 *
 * @param {object} input
 * @param {string}      input.reference_class  one of REFERENCE_CLASS
 * @param {string|null} input.reference
 * @param {string|null} [input.media_type]
 * @param {string|null} [input.content_hash]
 * @param {string|null} [input.expires_at]
 * @param {object}      [input.evidence]       evidence-ladder inputs
 */
export function buildArtifactRecord({
  reference_class,
  reference = null,
  media_type = null,
  content_hash = null,
  expires_at = null,
  evidence = {},
}) {
  const semantics = REFERENCE_SEMANTICS[reference_class];
  if (!semantics) {
    const error = new Error(`Unknown artifact reference class: ${reference_class}`);
    error.code = 'UNKNOWN_REFERENCE_CLASS';
    throw error;
  }

  // The evidence ladder is evaluated from what is actually true of this
  // artefact, not from what the caller would like to assert.
  const ladderInput = {
    ...evidence,
    content_hash: content_hash ?? evidence.content_hash ?? null,
    durable_possession: semantics.possession === POSSESSION.BYTES_HELD,
  };
  const supported = claim(ladderInput);

  // The class ceiling and the evidence burden are both binding; take the lower.
  const level = rank(supported.level) <= rank(semantics.max_evidence_level)
    ? supported.level
    : semantics.max_evidence_level;

  return Object.freeze({
    reference_class,
    reference,
    media_type,
    content_hash,
    expires_at,
    possession: semantics.possession,
    durability: semantics.durability,
    wrasal_holds_artifact: semantics.wrasal_holds_artifact,
    evidence_level: level,
    evidence_ceiling_for_class: semantics.max_evidence_level,
    missing_for_next_level: supported.missing_for_next,
    possession_statement: semantics.statement,
  });
}

/**
 * THE INVARIANT.
 *
 * Refuses any outbound record that would imply durable possession WRASAL does
 * not have. Called before a Freebuff payload is emitted.
 */
export function assertNoFalsePossessionClaim(artifactRecord, context = {}) {
  const semantics = REFERENCE_SEMANTICS[artifactRecord.reference_class];

  if (artifactRecord.wrasal_holds_artifact && semantics.possession !== POSSESSION.BYTES_HELD) {
    throw possessionError('record claims WRASAL holds the artefact but its reference class does not grant possession', artifactRecord, context);
  }

  if (rank(artifactRecord.evidence_level) > rank(semantics.max_evidence_level)) {
    throw possessionError('record claims an evidence level above the ceiling for its reference class', artifactRecord, context);
  }

  if (artifactRecord.evidence_level === EVIDENCE_LEVEL.ARCHIVED && !artifactRecord.content_hash) {
    throw possessionError('ARCHIVED claimed without a content hash', artifactRecord, context);
  }

  if (artifactRecord.durability === DURABILITY.EXPIRING && artifactRecord.wrasal_holds_artifact) {
    throw possessionError('an expiring reference can never constitute possession', artifactRecord, context);
  }

  return true;
}

function possessionError(message, artifactRecord, context) {
  const error = new Error(`False possession claim refused: ${message}`);
  error.code = 'FALSE_POSSESSION_CLAIM';
  error.detail = { artifact: artifactRecord, ...context };
  return error;
}

/** Hash bytes WRASAL actually holds. Never called on a remote reference. */
export function hashBytes(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}
