import {
  AUTHORITY_STATUS,
  EXECUTION_MODE,
  IDENTITY_STATUS,
  LIFECYCLE,
  SNAPSHOT_STATUS,
  SCENE_CONTEXT,
  SCENE_CONTEXT_KEYS,
} from './vocabulary.js';

/**
 * §11 AuthorityCheck.
 *
 * Pure function. No I/O, no provider knowledge, no UI knowledge.
 * This is the only place that decides whether WRASAL is permitted to cause a
 * representation of an identity to exist. The UI cannot bypass it because the
 * service layer runs it immediately before every execution, again, server-side.
 */

/**
 * @param {object} input
 * @param {object|null} input.identity
 * @param {object|null} input.snapshot
 * @param {object|null} input.policy
 * @param {object|null} input.scene
 * @param {object|null} input.request
 * @param {string}      input.mode     EXECUTION_MODE.REAL | SIMULATION
 * @param {() => string} [input.clock]
 * @returns {{decision: string, reasons: Array, waived: Array, evaluated_at: string, mode: string}}
 */
export function authorityCheck({
  identity,
  snapshot,
  policy,
  scene,
  request = null,
  mode = EXECUTION_MODE.REAL,
  clock = () => new Date().toISOString(),
}) {
  const reasons = [];
  const waived = [];

  const deny = (rule, detail) => reasons.push({ rule, result: 'DENY', detail });
  const allow = (rule, detail) => reasons.push({ rule, result: 'ALLOW', detail });

  // 1. Identity exists and stands.
  if (!identity) {
    deny('IDENTITY_EXISTS', 'no identity record resolved for this request');
  } else if (identity.status !== IDENTITY_STATUS.ACTIVE) {
    deny('IDENTITY_ACTIVE', `identity status is ${identity.status}, expected ACTIVE`);
  } else {
    allow('IDENTITY_EXISTS', `${identity.id} (${identity.canonical_name})`);
  }

  // 2. Snapshot exists and is the active canonical version.
  if (!snapshot) {
    deny('SNAPSHOT_EXISTS', 'no identity snapshot resolved for this request');
  } else if (snapshot.status !== SNAPSHOT_STATUS.ACTIVE) {
    deny('SNAPSHOT_ACTIVE', `snapshot ${snapshot.version} status is ${snapshot.status}, expected ACTIVE`);
  } else {
    allow('SNAPSHOT_ACTIVE', `${snapshot.id} ${snapshot.version}`);
  }

  // 3. A likeness policy must exist for that exact snapshot.
  if (!policy) {
    deny('POLICY_EXISTS', 'no LikenessPolicy bound to this identity snapshot');
  } else if (snapshot && policy.identity_snapshot_id !== snapshot.id) {
    deny('POLICY_BINDING', 'LikenessPolicy is bound to a different identity snapshot');
  } else {
    allow('POLICY_EXISTS', policy.id);
  }

  // 4. Every context the scene declares must be permitted by the policy.
  if (!scene) {
    deny('SCENE_EXISTS', 'no SceneSpec resolved for this request');
  } else {
    allow('SCENE_EXISTS', `${scene.id} — ${scene.title}`);

    const declared = scene.intended_context ?? {};
    for (const contextKey of SCENE_CONTEXT_KEYS) {
      if (declared[contextKey] !== true) continue;
      const permissionKey = SCENE_CONTEXT[contextKey];
      if (!policy) continue; // already denied above
      if (policy[permissionKey] === true) {
        allow(`CONTEXT_${contextKey.toUpperCase()}`, `${permissionKey} = true`);
      } else {
        deny(`CONTEXT_${contextKey.toUpperCase()}`, `${permissionKey} = false — scene declares ${contextKey} context`);
      }
    }
  }

  // 5. Approval.
  const approvalRequired = policy ? policy.approval_required !== false : true;
  const approvalPresent = Boolean(
    request
      && [LIFECYCLE.APPROVED, LIFECYCLE.EXECUTING, LIFECYCLE.GENERATED, LIFECYCLE.REVIEWED, LIFECYCLE.ARCHIVED]
        .includes(request.lifecycle_state),
  );

  if (!approvalRequired) {
    allow('APPROVAL_PRESENT', 'policy does not require approval');
  } else if (approvalPresent) {
    allow('APPROVAL_PRESENT', `approved by ${request.approved_by ?? 'UNKNOWN'}`);
  } else if (mode === EXECUTION_MODE.SIMULATION) {
    // §10: the approval gate — and only the approval gate — may be waived for an
    // explicitly marked SIMULATION. Policy denials are never waived.
    waived.push({
      rule: 'APPROVAL_PRESENT',
      detail: 'approval not granted; waived because execution is explicitly marked SIMULATION',
    });
  } else {
    deny('APPROVAL_PRESENT', 'approval_status != APPROVED and execution is not marked SIMULATION');
  }

  const denials = reasons.filter((reason) => reason.result === 'DENY');

  return {
    decision: denials.length === 0 ? AUTHORITY_STATUS.AUTHORIZED : AUTHORITY_STATUS.DENIED,
    mode,
    reasons,
    waived,
    denial_count: denials.length,
    evaluated_at: clock(),
    inputs: {
      identity_id: identity?.id ?? null,
      identity_snapshot_id: snapshot?.id ?? null,
      likeness_policy_id: policy?.id ?? null,
      scene_spec_id: scene?.id ?? null,
      execution_request_id: request?.id ?? null,
    },
  };
}

/**
 * Human-facing authority summary used by the EXECUTION REVIEW screen (§18).
 * Derived strictly from the stored policy — no editorialising.
 */
export function policySummary(policy, scene) {
  if (!policy) return [];
  const declared = scene?.intended_context ?? {};
  return SCENE_CONTEXT_KEYS.map((contextKey) => {
    const permissionKey = SCENE_CONTEXT[contextKey];
    const permitted = policy[permissionKey] === true;
    return {
      context: contextKey,
      policy_field: permissionKey,
      permitted,
      declared_by_scene: declared[contextKey] === true,
      verdict: permitted ? 'ALLOWED' : 'PROHIBITED',
    };
  });
}
