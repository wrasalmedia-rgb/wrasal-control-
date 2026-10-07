// Reality service. The only sanctioned write surface for the Reality Graph.
// Every function here routes through governed() so that nothing enters reality
// without an authority event behind it.

import { governed } from '../authority/authority.js';
import { id } from '../persistence/db.js';
import { CANONICAL_STATUS, EPISTEMIC_STATUS, CLAIM_STATUS } from './vocabulary.js';

const need = (v, field) => {
  if (v === undefined || v === null || v === '') throw new Error(`Missing required field: ${field}`);
  return v;
};

export async function createWorld(ctx, input) {
  const wid = id('wrl');
  return governed(ctx, {
    action: 'create_world', subject_kind: 'world', subject_id: wid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'establish a world',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO worlds (id, name, summary, status) VALUES ($1,$2,$3,$4)`,
      [wid, need(input.name, 'name'), input.summary ?? null, input.status ?? CANONICAL_STATUS.PROVISIONAL],
    );
    return { subject_id: wid, new_state: { name: input.name }, description: `World "${input.name}" established.` };
  });
}

export async function createEntity(ctx, input) {
  const eid = id('ent');
  return governed(ctx, {
    action: 'create_entity', subject_kind: 'entity', subject_id: eid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'record an entity in reality',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO entities
         (id, name, entity_type_id, world_id, status, summary, summary_epistemic_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [eid, need(input.name, 'name'), need(input.entity_type_id, 'entity_type_id'),
       input.world_id ?? null,
       input.status ?? CANONICAL_STATUS.PROVISIONAL,
       input.summary ?? null,
       input.summary_epistemic_status ?? EPISTEMIC_STATUS.USER_SUPPLIED,
       ctx.actor.id],
    );
    return {
      subject_id: eid,
      new_state: { name: input.name, type: input.entity_type_id, status: input.status ?? 'provisional' },
      description: `Entity "${input.name}" entered the Reality Graph.`,
    };
  });
}

export async function createRelationship(ctx, input) {
  const rid = id('rel');
  return governed(ctx, {
    action: 'create_relationship', subject_kind: 'relationship', subject_id: rid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'connect two entities',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO relationships
         (id, source_entity_id, target_entity_id, predicate, epistemic_status, status, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [rid, need(input.source_entity_id, 'source_entity_id'), need(input.target_entity_id, 'target_entity_id'),
       need(input.predicate, 'predicate'),
       input.epistemic_status ?? EPISTEMIC_STATUS.USER_SUPPLIED,
       input.status ?? CANONICAL_STATUS.PROVISIONAL,
       input.note ?? null, ctx.actor.id],
    );
    return {
      subject_id: rid,
      new_state: { predicate: input.predicate, from: input.source_entity_id, to: input.target_entity_id },
      description: `Relationship ${input.predicate} recorded.`,
    };
  });
}

export async function recordMemory(ctx, input) {
  const mid = id('mem');
  return governed(ctx, {
    action: 'record_memory', subject_kind: 'memory', subject_id: mid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'attach memory to an entity',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO memories (id, entity_id, body, occurred_at, epistemic_status, confidence, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [mid, need(input.entity_id, 'entity_id'), need(input.body, 'body'),
       input.occurred_at ?? null,
       input.epistemic_status ?? EPISTEMIC_STATUS.USER_SUPPLIED,
       input.confidence ?? null, ctx.actor.id],
    );
    return { subject_id: mid, new_state: { entity_id: input.entity_id }, description: 'Memory recorded.' };
  });
}

export async function recordEvidence(ctx, input) {
  const evid = id('evd');
  return governed(ctx, {
    action: 'record_evidence', subject_kind: 'evidence', subject_id: evid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'record an evidentiary source',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO evidence
         (id, entity_id, title, source, source_kind, observed_result, epistemic_status, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [evid, input.entity_id ?? null, need(input.title, 'title'), need(input.source, 'source'),
       need(input.source_kind, 'source_kind'), need(input.observed_result, 'observed_result'),
       input.epistemic_status ?? EPISTEMIC_STATUS.EXTERNALLY_SUPPORTED, ctx.actor.id],
    );
    return { subject_id: evid, new_state: { title: input.title }, description: `Evidence "${input.title}" recorded.` };
  });
}

export async function assertClaim(ctx, input) {
  const cid = id('clm');
  return governed(ctx, {
    action: 'assert_claim', subject_kind: 'claim', subject_id: cid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'assert a claim about an entity',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO claims (id, entity_id, statement, status, epistemic_status, asserted_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [cid, need(input.entity_id, 'entity_id'), need(input.statement, 'statement'),
       input.status ?? CLAIM_STATUS.UNRESOLVED,
       input.epistemic_status ?? EPISTEMIC_STATUS.USER_SUPPLIED, ctx.actor.id],
    );
    return { subject_id: cid, new_state: { statement: input.statement, status: input.status ?? 'unresolved' },
             description: 'Claim asserted.' };
  });
}

export async function linkClaimEvidence(ctx, input) {
  return governed(ctx, {
    action: 'link_claim_evidence', subject_kind: 'claim', subject_id: input.claim_id,
    source: input.source ?? 'operator input', reason: input.reason ?? 'link evidence to a claim',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO claim_evidence (claim_id, evidence_id, stance, linked_by) VALUES ($1,$2,$3,$4)`,
      [need(input.claim_id, 'claim_id'), need(input.evidence_id, 'evidence_id'),
       input.stance ?? 'supports', ctx.actor.id],
    );
    // Claim status is recomputed from links, never asserted by a model.
    const { rows } = await tx.query(
      `SELECT stance, count(*)::int AS n FROM claim_evidence WHERE claim_id = $1 GROUP BY stance`,
      [input.claim_id],
    );
    const supports = rows.find((r) => r.stance === 'supports')?.n ?? 0;
    const contradicts = rows.find((r) => r.stance === 'contradicts')?.n ?? 0;
    let status = CLAIM_STATUS.UNRESOLVED;
    if (supports > 0 && contradicts > 0) status = CLAIM_STATUS.DISPUTED;
    else if (supports > 0) status = CLAIM_STATUS.SUPPORTED;
    else if (contradicts > 0) status = CLAIM_STATUS.REFUTED;
    await tx.query(`UPDATE claims SET status = $1 WHERE id = $2`, [status, input.claim_id]);
    return { subject_id: input.claim_id, new_state: { status, supports, contradicts },
             description: `Claim re-evaluated from evidence links: ${status}.` };
  });
}

export async function recordProvenance(ctx, input) {
  const pid = id('prv');
  return governed(ctx, {
    action: 'record_provenance', subject_kind: input.subject_kind, subject_id: input.subject_id,
    source: input.source_statement ?? 'operator input', reason: input.reason ?? 'record lineage',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO provenance_records
         (id, subject_kind, subject_id, origin, creator, source, relation, related_kind, related_id, note, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [pid, need(input.subject_kind, 'subject_kind'), need(input.subject_id, 'subject_id'),
       need(input.origin, 'origin'), input.creator ?? null, input.source ?? null,
       need(input.relation, 'relation'), input.related_kind ?? null, input.related_id ?? null,
       input.note ?? null, ctx.actor.id],
    );
    return { subject_id: input.subject_id, new_state: { provenance_id: pid, relation: input.relation },
             description: `Provenance recorded: ${input.relation}.` };
  });
}

export async function createArtifact(ctx, input) {
  const aid = id('art');
  return governed(ctx, {
    action: 'create_artifact', subject_kind: 'artifact', subject_id: aid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'create an artifact',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO artifacts (id, entity_id, world_id, name, kind, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [aid, input.entity_id ?? null, input.world_id ?? null, need(input.name, 'name'),
       need(input.kind, 'kind'), input.status ?? CANONICAL_STATUS.PROVISIONAL, ctx.actor.id],
    );
    return { subject_id: aid, new_state: { name: input.name, kind: input.kind },
             description: `Artifact "${input.name}" created.` };
  });
}

export async function createArtifactVersion(ctx, input) {
  const vid = id('ver');
  return governed(ctx, {
    action: 'create_artifact_version', subject_kind: 'artifact_version', subject_id: vid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'version an artifact',
  }, async (tx) => {
    const { rows } = await tx.query(
      `SELECT coalesce(max(version_number), 0) AS n FROM artifact_versions WHERE artifact_id = $1`,
      [need(input.artifact_id, 'artifact_id')],
    );
    const next = Number(rows[0].n) + 1;
    await tx.query(
      `INSERT INTO artifact_versions
         (id, artifact_id, version_number, body, change_summary, epistemic_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [vid, input.artifact_id, next, input.body ?? null, need(input.change_summary, 'change_summary'),
       input.epistemic_status ?? EPISTEMIC_STATUS.USER_SUPPLIED, ctx.actor.id],
    );
    if (next > 1) {
      const prev = await tx.query(
        `SELECT id FROM artifact_versions WHERE artifact_id = $1 AND version_number = $2`,
        [input.artifact_id, next - 1],
      );
      await tx.query(
        `INSERT INTO provenance_records
           (id, subject_kind, subject_id, origin, relation, related_kind, related_id, note, recorded_by)
         VALUES ($1,'artifact_version',$2,$3,'derived_from','artifact_version',$4,$5,$6)`,
        [id('prv'), vid, `version ${next} of artifact ${input.artifact_id}`,
         prev.rows[0].id, input.change_summary, ctx.actor.id],
      );
    }
    return { subject_id: vid, new_state: { artifact_id: input.artifact_id, version_number: next },
             description: `Version ${next} created: ${input.change_summary}` };
  });
}

export async function registerMedia(ctx, input) {
  const mid = id('med');
  return governed(ctx, {
    action: 'register_media', subject_kind: 'media_asset', subject_id: mid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'register a media asset',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO media_assets (id, artifact_version_id, uri, media_type, generation_context, epistemic_status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [mid, input.artifact_version_id ?? null, need(input.uri, 'uri'), need(input.media_type, 'media_type'),
       input.generation_context ? JSON.stringify(input.generation_context) : null,
       input.epistemic_status ?? EPISTEMIC_STATUS.OBSERVED],
    );
    return { subject_id: mid, new_state: { uri: input.uri }, description: 'Media asset registered.' };
  });
}

export async function createSpecification(ctx, input) {
  const sid = id('spc');
  return governed(ctx, {
    action: 'create_specification', subject_kind: 'specification', subject_id: sid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'specify a creative object',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO specifications (id, entity_id, artifact_id, title, body, epistemic_status, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [sid, input.entity_id ?? null, input.artifact_id ?? null, need(input.title, 'title'),
       JSON.stringify(need(input.body, 'body')),
       input.epistemic_status ?? EPISTEMIC_STATUS.USER_SUPPLIED,
       input.status ?? CANONICAL_STATUS.PROVISIONAL, ctx.actor.id],
    );
    return { subject_id: sid, new_state: { title: input.title }, description: `Specification "${input.title}" created.` };
  });
}

export async function createStory(ctx, input) {
  const sid = id('sty');
  return governed(ctx, {
    action: 'create_story', subject_kind: 'story', subject_id: sid,
    source: input.source ?? 'operator input', reason: input.reason ?? 'record a story',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO stories (id, world_id, title, logline, status, created_by) VALUES ($1,$2,$3,$4,$5,$6)`,
      [sid, input.world_id ?? null, need(input.title, 'title'), input.logline ?? null,
       input.status ?? CANONICAL_STATUS.PROVISIONAL, ctx.actor.id],
    );
    return { subject_id: sid, new_state: { title: input.title }, description: `Story "${input.title}" recorded.` };
  });
}

export async function proposeDecision(ctx, input) {
  const did = id('dec');
  return governed(ctx, {
    action: 'propose_decision', subject_kind: input.subject_kind, subject_id: input.subject_id,
    source: input.source ?? 'operator input', reason: input.reason ?? 'propose a governed change',
  }, async (tx) => {
    await tx.query(
      `INSERT INTO decisions (id, subject_kind, subject_id, question, rationale, proposed_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [did, need(input.subject_kind, 'subject_kind'), need(input.subject_id, 'subject_id'),
       need(input.question, 'question'), input.rationale ?? null, ctx.actor.id],
    );
    return { subject_id: input.subject_id, new_state: { decision_id: did, status: 'proposed' },
             description: `Decision proposed: ${input.question}` };
  });
}

/**
 * The only path by which anything becomes canonical. Requires a steward and an
 * accepted decision. There is no "set status" endpoint anywhere in WRASAL.
 */
export async function declareCanonical(ctx, input) {
  const { decision_id, resolution } = input;
  return governed(ctx, {
    action: 'declare_canonical', subject_kind: input.subject_kind, subject_id: input.subject_id,
    source: input.source ?? 'steward declaration', reason: need(input.reason, 'reason'),
  }, async (tx) => {
    const table = { entity: 'entities', artifact: 'artifacts', world: 'worlds',
                    story: 'stories', specification: 'specifications' }[input.subject_kind];
    if (!table) throw new Error(`Canonical status is not tracked for subject_kind "${input.subject_kind}".`);

    const before = await tx.query(`SELECT status FROM ${table} WHERE id = $1`, [input.subject_id]);
    if (!before.rows.length) throw new Error(`No such ${input.subject_kind}: ${input.subject_id}`);
    const previous = before.rows[0].status;

    if (decision_id) {
      await tx.query(
        `UPDATE decisions SET status = 'accepted', resolution = $1, decided_by = $2, decided_at = now()
         WHERE id = $3`,
        [resolution ?? input.reason, ctx.actor.id, decision_id],
      );
    }

    await tx.query(
      `UPDATE canonical_states SET superseded_at = now()
       WHERE subject_kind = $1 AND subject_id = $2 AND superseded_at IS NULL`,
      [input.subject_kind, input.subject_id],
    );
    await tx.query(
      `INSERT INTO canonical_states (id, subject_kind, subject_id, status, decision_id, declared_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id('can'), input.subject_kind, input.subject_id, need(input.status, 'status'),
       decision_id ?? null, ctx.actor.id],
    );
    await tx.query(`UPDATE ${table} SET status = $1 WHERE id = $2`, [input.status, input.subject_id]);

    return {
      subject_id: input.subject_id,
      previous_state: { status: previous },
      new_state: { status: input.status },
      description: `Canonical status changed from ${previous} to ${input.status} by steward declaration.`,
    };
  });
}
