import { assertNoFalsePossessionClaim, REFERENCE_CLASS } from './artifact.js';
import { EVIDENCE_LEVEL, EVIDENCE_BURDEN } from './evidence-ladder.js';

/**
 * §13 Freebuff handoff boundary.
 *
 * This is NOT a Freebuff implementation. It is the event boundary between a
 * WRASAL GenerationEvent and whatever preserves the evidence downstream.
 *
 * Nothing in this file may claim certification. Until a real Freebuff service
 * answers, the handoff is recorded as SIMULATED and says so in every field an
 * operator will read.
 *
 * WRASAL-0014 adds the possession invariant:
 *
 *   An evidence record must never imply durable possession of an artifact
 *   when WRASAL only possesses an expiring provider reference.
 *
 * The payload therefore states, in the record itself, what WRASAL holds and
 * what it merely points at — and refuses to be built if those disagree.
 */

export const FREEBUFF_MODE = Object.freeze({
  SIMULATED: 'SIMULATED',
  LIVE: 'LIVE',
});

/**
 * Build the payload a real Freebuff service would receive.
 * Pure function over an immutable GenerationEvent.
 *
 * @throws if the artefact record would imply possession WRASAL does not have.
 */
export function buildFreebuffPayload(generationEvent, { lineage }) {
  const artifact = generationEvent.artifact ?? {
    reference_class: REFERENCE_CLASS.ARTIFACT_UNAVAILABLE,
    reference: null,
    media_type: null,
    content_hash: null,
    expires_at: null,
    possession: 'NONE',
    durability: 'UNKNOWN',
    wrasal_holds_artifact: false,
    evidence_level: EVIDENCE_LEVEL.UNKNOWN,
    possession_statement: 'No artefact record was attached to this generation event.',
  };

  // THE GUARD. A handoff that would overstate possession is never emitted.
  assertNoFalsePossessionClaim(artifact, {
    generation_event_id: generationEvent.id,
    stage: 'freebuff_payload_build',
  });

  return {
    schema: 'wrasal.freebuff.record/v0.2',
    identity_id: generationEvent.identity_id,
    identity_snapshot_id: generationEvent.identity_snapshot_id,
    scene_spec_id: generationEvent.scene_spec_id,
    generation_event_id: generationEvent.id,
    provider: generationEvent.provider,
    provider_job_id: generationEvent.provider_job_id,
    provider_binding: generationEvent.provider_binding ?? null,
    output_reference: generationEvent.output_reference,
    timestamp: generationEvent.completed_at ?? generationEvent.requested_at,
    lineage,

    /**
     * What WRASAL actually has. Stated explicitly so that no downstream
     * consumer has to infer possession from the presence of a URL.
     */
    artifact_custody: {
      reference_class: artifact.reference_class,
      possession: artifact.possession,
      durability: artifact.durability,
      wrasal_holds_artifact: artifact.wrasal_holds_artifact,
      content_hash: artifact.content_hash,
      expires_at: artifact.expires_at,
      statement: artifact.possession_statement,
    },

    /**
     * How much is actually known, and what it would take to know more.
     */
    evidence: {
      level: artifact.evidence_level,
      burden_met: EVIDENCE_BURDEN[artifact.evidence_level]?.burden ?? null,
      ceiling_for_reference_class: artifact.evidence_ceiling_for_class ?? null,
      missing_for_next_level: artifact.missing_for_next_level ?? [],
      simulated: generationEvent.simulated === true,
    },
  };
}

/**
 * Mock destination. It acknowledges receipt of a payload and nothing else.
 * It explicitly does not certify, notarise or attest.
 */
export function deliverToMockFreebuff(payload, { clock = () => new Date().toISOString() } = {}) {
  return {
    mode: FREEBUFF_MODE.SIMULATED,
    label: 'FREEBUFF HANDOFF: SIMULATED',
    accepted_at: clock(),
    destination: 'mock://freebuff.local/records',
    certified: false,
    certification_statement: 'NOT CERTIFIED. No Freebuff service has received, validated or attested this record. This is a locally-constructed payload only.',
    custody_statement: payload.artifact_custody.wrasal_holds_artifact
      ? 'WRASAL durably holds the artefact bytes referenced by this record.'
      : 'WRASAL DOES NOT HOLD THIS ARTEFACT. This record evidences that a generation occurred; it does not guarantee the artefact remains retrievable.',
    payload,
  };
}
