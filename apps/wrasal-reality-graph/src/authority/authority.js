// Authority layer.
//
// Principle: INTELLIGENCE MAY PARTICIPATE IN REALITY WITHOUT OWNING REALITY.
//
// Every mutation in WRASAL passes through `governed()`. There is no other
// sanctioned write path. A mutation that cannot name its actor, action, source
// and reason cannot run.

import { ACTOR_KIND, AUTHORITY_RANK } from '../domain/vocabulary.js';
import { id } from '../persistence/db.js';

export class AuthorityError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'AuthorityError';
    this.code = 'AUTHORITY_DENIED';
    this.detail = detail;
  }
}

/**
 * The action registry. Each action declares the minimum authority level, and
 * whether it touches authoritative (canonical) state.
 *
 * Actions marked `canonical: true` are closed to AI actors — absolutely, not by
 * policy toggle. This is the Authority Boundary made executable.
 */
export const ACTIONS = Object.freeze({
  create_entity:        { min: 'contributor', canonical: false },
  update_entity:        { min: 'contributor', canonical: false },
  create_relationship:  { min: 'contributor', canonical: false },
  record_memory:        { min: 'contributor', canonical: false },
  record_evidence:      { min: 'contributor', canonical: false },
  assert_claim:         { min: 'contributor', canonical: false },
  link_claim_evidence:  { min: 'contributor', canonical: false },
  record_provenance:    { min: 'contributor', canonical: false },
  create_artifact:      { min: 'contributor', canonical: false },
  create_artifact_version: { min: 'contributor', canonical: false },
  register_media:       { min: 'contributor', canonical: false },
  create_specification: { min: 'contributor', canonical: false },
  create_story:         { min: 'contributor', canonical: false },
  create_world:         { min: 'contributor', canonical: false },
  propose_decision:     { min: 'author',      canonical: false },

  // --- authoritative transitions ---
  accept_decision:      { min: 'steward', canonical: true },
  declare_canonical:    { min: 'steward', canonical: true },
  release:              { min: 'steward', canonical: true },
  archive:              { min: 'author',  canonical: true },
});

/** Capability summary for a given actor — used by the UI and by Ask WRASAL. */
export function capabilitiesOf(actor) {
  const may = [];
  const mayNot = [];
  for (const [action, rule] of Object.entries(ACTIONS)) {
    (permits(actor, action) ? may : mayNot).push(action);
  }
  return { may, may_not: mayNot };
}

export function permits(actor, action) {
  const rule = ACTIONS[action];
  if (!rule) return false;
  if (rule.canonical && actor.kind === ACTOR_KIND.AI) return false;
  return AUTHORITY_RANK[actor.authority_level] >= AUTHORITY_RANK[rule.min];
}

/**
 * Run a mutation under recorded authority.
 *
 * @param {object}   ctx     { db, actor }
 * @param {object}   intent  { action, subject_kind, subject_id?, source, reason,
 *                             previous_state?, describe? }
 * @param {Function} fn      async (tx) => { subject_id, new_state, description }
 */
export async function governed(ctx, intent, fn) {
  const { db, actor } = ctx;
  const { action, subject_kind, source, reason } = intent;

  const rule = ACTIONS[action];
  if (!rule) {
    throw new AuthorityError(`Unknown action "${action}". WRASAL does not perform unregistered mutations.`);
  }
  if (!source || !reason) {
    throw new AuthorityError(`Action "${action}" requires an explicit source and reason.`, { action });
  }
  if (rule.canonical && actor.kind === ACTOR_KIND.AI) {
    throw new AuthorityError(
      `An AI actor may not perform "${action}". Intelligence may participate in reality without owning reality.`,
      { action, actor: actor.id, actor_kind: actor.kind },
    );
  }
  if (AUTHORITY_RANK[actor.authority_level] < AUTHORITY_RANK[rule.min]) {
    throw new AuthorityError(
      `Action "${action}" requires authority level "${rule.min}"; actor holds "${actor.authority_level}".`,
      { action, required: rule.min, held: actor.authority_level },
    );
  }

  return db.transaction(async (tx) => {
    const result = await fn(tx);
    const subjectId = result.subject_id ?? intent.subject_id;

    await tx.query(
      `INSERT INTO authority_events
         (id, actor_id, actor_kind, authority_level, action, subject_kind, subject_id,
          previous_state, new_state, source, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id('auth'), actor.id, actor.kind, actor.authority_level, action,
        subject_kind, subjectId,
        (result.previous_state ?? intent.previous_state)
          ? JSON.stringify(result.previous_state ?? intent.previous_state) : null,
        result.new_state ? JSON.stringify(result.new_state) : null,
        source, reason,
      ],
    );

    await tx.query(
      `INSERT INTO events (id, subject_kind, subject_id, kind, description, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id('evt'), subject_kind, subjectId, action,
       result.description ?? intent.describe ?? `${action} on ${subject_kind} ${subjectId}`,
       actor.id],
    );

    return result;
  });
}

/** Load an actor and refuse to proceed if they are not a recorded user. */
export async function loadActor(db, actorId) {
  const { rows } = await db.query(`SELECT * FROM users WHERE id = $1`, [actorId]);
  if (!rows.length) throw new AuthorityError(`Unknown actor "${actorId}".`);
  return rows[0];
}
