import { EVENT, deriveApprovalStatus, deriveExecutionStatus } from './vocabulary.js';

/**
 * Read model.
 *
 * The event log is the only source of truth. This projection is a disposable
 * rebuild of current state from history — it can always be thrown away and
 * recomputed, which is what makes "never overwrite truth" enforceable.
 */
export function project(records) {
  const state = {
    identities: new Map(),
    snapshots: new Map(),
    policies: new Map(),
    scenes: new Map(),
    requests: new Map(),
    authorityChecks: new Map(), // execution_request_id -> latest check
    generationEvents: new Map(),
    media: new Map(),
    handoffs: new Map(),
    bindings: new Map(),
    custodyObservations: new Map(),
  };

  for (const record of records) {
    const p = record.payload;
    switch (record.type) {
      case EVENT.IDENTITY_CREATED:
        state.identities.set(p.identity.id, { ...p.identity });
        break;

      case EVENT.SNAPSHOT_CREATED:
        state.snapshots.set(p.snapshot.id, { ...p.snapshot });
        break;

      case EVENT.SNAPSHOT_SUPERSEDED: {
        const snapshot = state.snapshots.get(p.snapshot_id);
        if (snapshot) {
          // The snapshot's canonical content is untouched; only its standing changes.
          state.snapshots.set(p.snapshot_id, {
            ...snapshot,
            status: p.status,
            superseded_by: p.superseded_by ?? null,
          });
        }
        break;
      }

      case EVENT.SNAPSHOT_DEACTIVATED: {
        const snapshot = state.snapshots.get(p.snapshot_id);
        if (snapshot) {
          state.snapshots.set(p.snapshot_id, {
            ...snapshot,
            status: p.status,
            deactivation_reason: p.reason ?? null,
          });
        }
        break;
      }

      case EVENT.POLICY_CREATED:
        state.policies.set(p.policy.id, { ...p.policy });
        break;

      case EVENT.SCENE_CREATED:
        state.scenes.set(p.scene.id, { ...p.scene });
        break;

      case EVENT.PROVIDER_BINDING_DECLARED:
        state.bindings.set(p.binding.id, { ...p.binding });
        break;

      case EVENT.PROVIDER_BINDING_VERIFIED: {
        const binding = state.bindings.get(p.binding_id);
        if (binding) {
          state.bindings.set(p.binding_id, {
            ...binding,
            binding_status: p.binding_status,
            verified_at: record.recorded_at,
            evidence_ref: p.evidence_ref ?? null,
          });
        }
        break;
      }

      case EVENT.PROVIDER_BINDING_REVOKED: {
        const binding = state.bindings.get(p.binding_id);
        if (binding) {
          state.bindings.set(p.binding_id, {
            ...binding,
            binding_status: p.binding_status,
            revoked_at: record.recorded_at,
            revocation_reason: p.reason ?? null,
          });
        }
        break;
      }

      case EVENT.CUSTODY_OBSERVED: {
        // Append-only by construction: observations accumulate beside the
        // historical record and never overwrite it or each other.
        const existing = state.custodyObservations.get(p.generation_event_id) ?? [];
        state.custodyObservations.set(p.generation_event_id, [...existing, { ...p.observation }]);
        break;
      }

      case EVENT.EXECUTION_REQUESTED:
        state.requests.set(p.request.id, { ...p.request });
        break;

      case EVENT.AUTHORITY_CHECKED: {
        state.authorityChecks.set(p.execution_request_id, { ...p.check });
        patchRequest(state, p.execution_request_id, {
          authority_status: p.check.decision,
          lifecycle_state: p.lifecycle_state,
        });
        break;
      }

      case EVENT.APPROVAL_GRANTED:
        patchRequest(state, p.execution_request_id, {
          lifecycle_state: p.lifecycle_state,
          approved_by: p.approver,
          approved_at: record.recorded_at,
          approval_note: p.note ?? null,
        });
        break;

      case EVENT.APPROVAL_REJECTED:
        patchRequest(state, p.execution_request_id, {
          lifecycle_state: p.lifecycle_state,
          rejected_by: p.actor,
          rejected_at: record.recorded_at,
          rejection_reason: p.reason ?? null,
        });
        break;

      case EVENT.EXECUTION_STARTED:
        patchRequest(state, p.execution_request_id, {
          lifecycle_state: p.lifecycle_state,
          execution_mode: p.mode,
          provider: p.provider,
          started_at: record.recorded_at,
        });
        break;

      case EVENT.EXECUTION_COMPLETED:
        patchRequest(state, p.execution_request_id, {
          lifecycle_state: p.lifecycle_state,
          generation_event_id: p.generation_event_id,
          completed_at: record.recorded_at,
        });
        break;

      case EVENT.EXECUTION_FAILED:
      case EVENT.PROVIDER_CONTRACT_UNAVAILABLE:
        patchRequest(state, p.execution_request_id, {
          lifecycle_state: p.lifecycle_state,
          failure: p.failure,
          failed_at: record.recorded_at,
          generation_event_id: p.generation_event_id ?? null,
        });
        break;

      case EVENT.MEDIA_GENERATED:
        state.media.set(p.media.id, { ...p.media });
        break;

      case EVENT.PROVENANCE_RECORDED:
        // Generation events are written exactly once and never patched.
        if (!state.generationEvents.has(p.generation_event.id)) {
          state.generationEvents.set(p.generation_event.id, Object.freeze({ ...p.generation_event }));
        }
        break;

      case EVENT.REVIEW_RECORDED:
        patchRequest(state, p.execution_request_id, {
          lifecycle_state: p.lifecycle_state,
          review: {
            reviewer: p.reviewer,
            verdict: p.verdict,
            notes: p.notes ?? null,
            recorded_at: record.recorded_at,
          },
        });
        break;

      case EVENT.FREEBUFF_HANDOFF_CREATED:
        state.handoffs.set(p.handoff.id, { ...p.handoff });
        break;

      default:
        // Unknown historical event types are preserved in the log and ignored
        // by the read model rather than dropped or rewritten.
        break;
    }
  }

  // Attach derived (never separately stored) status dimensions.
  for (const [id, request] of state.requests) {
    state.requests.set(id, {
      ...request,
      approval_status: deriveApprovalStatus(request.lifecycle_state),
      execution_status: deriveExecutionStatus(request.lifecycle_state),
    });
  }

  return state;
}

function patchRequest(state, id, patch) {
  const existing = state.requests.get(id);
  if (!existing) return;
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  state.requests.set(id, next);
}
