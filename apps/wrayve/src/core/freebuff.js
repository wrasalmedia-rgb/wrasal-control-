/**
 * §13 Freebuff handoff boundary.
 *
 * This is NOT a Freebuff implementation. It is the event boundary between a
 * WRASAL GenerationEvent and whatever preserves the evidence downstream.
 *
 * Nothing in this file may claim certification. Until a real Freebuff service
 * answers, the handoff is recorded as SIMULATED and says so in every field an
 * operator will read.
 */

export const FREEBUFF_MODE = Object.freeze({
  SIMULATED: 'SIMULATED',
  LIVE: 'LIVE',
});

/**
 * Build the payload a real Freebuff service would receive.
 * Pure function over an immutable GenerationEvent.
 */
export function buildFreebuffPayload(generationEvent, { lineage }) {
  return {
    schema: 'wrasal.freebuff.record/v0.1',
    identity_id: generationEvent.identity_id,
    identity_snapshot_id: generationEvent.identity_snapshot_id,
    scene_spec_id: generationEvent.scene_spec_id,
    generation_event_id: generationEvent.id,
    provider: generationEvent.provider,
    provider_job_id: generationEvent.provider_job_id,
    output_reference: generationEvent.output_reference,
    timestamp: generationEvent.completed_at ?? generationEvent.requested_at,
    lineage,
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
    payload,
  };
}
