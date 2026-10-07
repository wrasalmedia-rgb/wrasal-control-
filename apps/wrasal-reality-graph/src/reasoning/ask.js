// ASK WRASAL — retrieval over the Reality Graph.
//
// This layer is deliberately NOT a language model. Every sentence it emits is
// either (a) a fixed structural phrase, or (b) a value copied verbatim out of a
// record, carried with that record's id and epistemic status. It is therefore
// structurally incapable of fabricating a fact.
//
// When the graph does not hold records sufficient to answer, the answer is
// UNKNOWN. UNKNOWN is a successful result, not an error.

import { UNKNOWN, isFactual, PROVENANCE_DISCLAIMER } from '../domain/vocabulary.js';
import { entityDossier, listEntities } from '../graph/graph.js';
import { lineageOf, versionDelta } from '../provenance/provenance.js';

const INTENTS = [
  { id: 'what_is_known',   test: /(what|which).*(know|known)|tell me about|who is|what is\b/i },
  { id: 'where_from',      test: /where.*(come from|from|origin)|provenance of|who made/i },
  { id: 'evidence_for',    test: /what evidence|evidence (supports?|for)|supported by/i },
  { id: 'what_changed',    test: /what changed|changes? between|differ|version history/i },
  { id: 'what_canonical',  test: /what is canonical|canonical\b/i },
  { id: 'what_unknown',    test: /unknown|unresolved|still missing|what don'?t (we|i) know/i },
  { id: 'connected_to',    test: /connected|related to|belongs? to|everything about|links?\b/i },
  { id: 'what_decisions',  test: /decisions?\b|who decided|changed this world/i },
  { id: 'what_releasable', test: /release|safely ship|ready to publish/i },
];

export function classify(question) {
  // Order matters: more specific intents are listed before broader ones where
  // they overlap, and the first match wins. No scoring, no model.
  const ordered = ['evidence_for', 'where_from', 'what_changed', 'what_unknown',
                   'what_canonical', 'what_releasable', 'what_decisions',
                   'connected_to', 'what_is_known'];
  for (const intentId of ordered) {
    const intent = INTENTS.find((i) => i.id === intentId);
    if (intent.test.test(question)) return intentId;
  }
  return null;
}

/** Resolve an entity mentioned by name in free text. Exact-ish, never fuzzy-guessy. */
export async function resolveEntity(db, question, hintId = null) {
  if (hintId) {
    const { rows } = await db.query(`SELECT * FROM entities WHERE id = $1`, [hintId]);
    if (rows.length) return rows[0];
  }
  const entities = await listEntities(db);
  const q = question.toLowerCase();
  const matches = entities.filter((e) => q.includes(e.name.toLowerCase()));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return matches.sort((a, b) => b.name.length - a.name.length)[0];
  }
  return null;
}

const cite = (kind, id, detail) => ({ record_kind: kind, record_id: id, ...detail });

function unknown(reason, checked, citations = []) {
  return {
    answer: UNKNOWN,
    status: 'unknown',
    reason,
    records_checked: checked,
    citations,
    note: 'WRASAL returns UNKNOWN rather than inventing an answer. UNKNOWN is a valid result.',
  };
}

export async function ask(db, question, { entity_id = null, artifact_id = null } = {}) {
  const intent = classify(question);
  if (!intent) {
    return unknown(
      'The question does not map to a retrieval WRASAL is able to perform over the Reality Graph.',
      0,
    );
  }
  const entity = await resolveEntity(db, question, entity_id);
  const base = { question, intent, subject: entity ? { id: entity.id, name: entity.name } : null };

  const handler = HANDLERS[intent];
  const result = await handler(db, { question, entity, artifact_id });
  return { ...base, ...result };
}

const HANDLERS = {
  async what_is_known(db, { entity }) {
    if (!entity) return unknown('No entity in the Reality Graph matches the subject of the question.', 0);
    const d = await entityDossier(db, entity.id);

    const facts = [];
    const citations = [];
    const inferences = [];

    facts.push({
      statement: `${d.entity.name} is recorded as an entity of type "${d.entity.type_label}".`,
      basis: 'entity record', epistemic_status: 'user_supplied',
    });
    citations.push(cite('entity', d.entity.id, { name: d.entity.name, status: d.entity.status }));

    facts.push({
      statement: `Its canonical status is "${d.entity.status}".`,
      basis: d.canonical_states.length ? 'canonical_states declaration' : 'entity record default',
      epistemic_status: 'user_supplied',
    });
    for (const cs of d.canonical_states) {
      citations.push(cite('canonical_state', cs.id,
        { status: cs.status, declared_by: cs.declared_by_name, declared_at: cs.declared_at }));
    }

    if (d.entity.summary) {
      const bucket = isFactual(d.entity.summary_epistemic_status) ? facts : inferences;
      bucket.push({
        statement: d.entity.summary,
        basis: 'entity summary', epistemic_status: d.entity.summary_epistemic_status,
      });
    }

    for (const m of d.memories) {
      const bucket = isFactual(m.epistemic_status) ? facts : inferences;
      bucket.push({ statement: m.body, basis: 'memory', epistemic_status: m.epistemic_status,
                    occurred_at: m.occurred_at ?? UNKNOWN });
      citations.push(cite('memory', m.id, { recorded_by: m.recorded_by_name, epistemic_status: m.epistemic_status }));
    }

    for (const c of d.claims) {
      const support = Array.isArray(c.support) ? c.support : JSON.parse(c.support ?? '[]');
      const entry = { statement: c.statement, basis: 'claim', claim_status: c.status,
                      epistemic_status: c.epistemic_status,
                      supporting_evidence: support.length ? support.map((s) => s.evidence_id) : UNKNOWN };
      if (c.status === 'supported') facts.push(entry);
      else inferences.push(entry);
      citations.push(cite('claim', c.id, { status: c.status }));
    }

    for (const e of d.evidence) citations.push(cite('evidence', e.id, { title: e.title, source: e.source }));

    const connections = [
      ...d.relationships.outgoing.map((r) => ({ direction: 'out', predicate: r.predicate,
        other: r.target_name, other_id: r.target_entity_id, epistemic_status: r.epistemic_status })),
      ...d.relationships.incoming.map((r) => ({ direction: 'in', predicate: r.predicate,
        other: r.source_name, other_id: r.source_entity_id, epistemic_status: r.epistemic_status })),
    ];
    for (const r of [...d.relationships.outgoing, ...d.relationships.incoming]) {
      citations.push(cite('relationship', r.id, { predicate: r.predicate }));
    }

    const unknowns = [];
    if (!d.entity.summary) unknowns.push('No summary has been recorded for this entity.');
    if (!d.memories.length) unknowns.push('No memories are attached to this entity.');
    if (!d.evidence.length) unknowns.push('No evidence records are attached to this entity.');
    for (const c of d.claims) {
      if (c.status === 'unresolved' || c.status === 'unknown') {
        unknowns.push(`Claim remains ${c.status}: "${c.statement}"`);
      }
      if (c.status === 'disputed') unknowns.push(`Claim is disputed: "${c.statement}"`);
    }
    if (!d.entity.world_id) unknowns.push('This entity is not assigned to a world.');

    if (!facts.length) {
      return unknown('The entity exists but holds no factual records.', citations.length, citations);
    }

    return {
      status: 'answered',
      answer: {
        established: facts,
        not_established: inferences,
        connections,
        unknown: unknowns,
        artifacts: d.artifacts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, status: a.status,
                                             versions: (Array.isArray(a.versions) ? a.versions : []).length })),
      },
      citations,
      records_checked: citations.length,
      note: 'Items under "not_established" are claims or interpretations that the graph does not treat as fact.',
    };
  },

  async where_from(db, { entity, artifact_id, question }) {
    let kind = null; let sid = null; let label = null;
    if (artifact_id) { kind = 'artifact'; sid = artifact_id; }
    else if (entity) {
      const arts = await db.query(`SELECT * FROM artifacts WHERE entity_id = $1 ORDER BY created_at`, [entity.id]);
      const named = arts.rows.find((a) => question.toLowerCase().includes(a.name.toLowerCase()));
      if (named) { kind = 'artifact'; sid = named.id; label = named.name; }
      else { kind = 'entity'; sid = entity.id; label = entity.name; }
    }
    if (!sid) return unknown('No entity or artifact in the graph matches the subject of the question.', 0);

    const lineage = await lineageOf(db, kind, sid);
    const citations = [...lineage.ancestors, ...lineage.descendants]
      .map((p) => cite('provenance_record', p.id, { relation: p.relation, origin: p.origin, creator: p.creator ?? UNKNOWN }));

    if (!lineage.ancestors.length && !lineage.descendants.length) {
      return unknown(`No provenance records exist for ${kind} ${sid}.`, 0);
    }

    return {
      status: 'answered',
      answer: {
        subject: { kind, id: sid, name: label },
        origin_chain: lineage.ancestors.map((a) => ({
          depth: a.depth, relation: a.relation, origin: a.origin,
          creator: a.creator ?? UNKNOWN, source: a.source ?? UNKNOWN,
          related: a.related_id ? `${a.related_kind}:${a.related_id}` : null, note: a.note,
        })),
        derived_works: lineage.descendants.map((d) => ({
          depth: d.depth, relation: d.relation, subject: `${d.subject_kind}:${d.subject_id}`, origin: d.origin,
        })),
        recorded_creators: lineage.recorded_creators,
        ownership: UNKNOWN,
      },
      citations,
      records_checked: citations.length,
      note: PROVENANCE_DISCLAIMER,
    };
  },

  async evidence_for(db, { entity, question }) {
    if (!entity) return unknown('No entity in the Reality Graph matches the subject of the question.', 0);
    const { rows: claims } = await db.query(
      `SELECT c.*, coalesce(json_agg(json_build_object(
                'evidence_id', ev.id, 'title', ev.title, 'source', ev.source,
                'source_kind', ev.source_kind, 'observed_result', ev.observed_result, 'stance', ce.stance
              ) ORDER BY ev.id) FILTER (WHERE ev.id IS NOT NULL), '[]') AS support
         FROM claims c
         LEFT JOIN claim_evidence ce ON ce.claim_id = c.id
         LEFT JOIN evidence ev ON ev.id = ce.evidence_id
        WHERE c.entity_id = $1 GROUP BY c.id ORDER BY c.created_at`, [entity.id]);

    if (!claims.length) return unknown(`No claims are recorded for ${entity.name}.`, 0);

    const q = question.toLowerCase();
    const targeted = claims.filter((c) =>
      c.statement.toLowerCase().split(/\W+/).filter((w) => w.length > 4).some((w) => q.includes(w)));
    const subject = targeted.length ? targeted : claims;

    const citations = [];
    const results = subject.map((c) => {
      const support = Array.isArray(c.support) ? c.support : JSON.parse(c.support ?? '[]');
      for (const s of support) citations.push(cite('evidence', s.evidence_id, { title: s.title, source: s.source }));
      citations.push(cite('claim', c.id, { status: c.status }));
      return {
        claim: c.statement,
        claim_status: c.status,
        supporting: support.filter((s) => s.stance === 'supports'),
        contradicting: support.filter((s) => s.stance === 'contradicts'),
        verdict: support.length ? c.status : UNKNOWN,
      };
    });

    const anySupport = results.some((r) => r.supporting.length || r.contradicting.length);
    if (!anySupport) {
      return unknown('Claims exist for this entity but no evidence records are linked to any of them.',
                     citations.length, citations);
    }
    return { status: 'answered', answer: { claims: results }, citations, records_checked: citations.length };
  },

  async what_changed(db, { entity, artifact_id, question }) {
    let targetId = artifact_id;
    if (!targetId && entity) {
      const { rows } = await db.query(`SELECT * FROM artifacts WHERE entity_id = $1 ORDER BY created_at`, [entity.id]);
      if (!rows.length) return unknown(`No artifacts are attached to ${entity.name}.`, 0);
      const named = rows.find((a) => question.toLowerCase().includes(a.name.toLowerCase()));
      targetId = (named ?? rows[0]).id;
    }
    if (!targetId) return unknown('No artifact in the graph matches the subject of the question.', 0);

    const { versions, deltas } = await versionDelta(db, targetId);
    if (versions.length < 2) {
      return unknown(`Artifact ${targetId} has ${versions.length} version(s); there is no change to report.`,
                     versions.length,
                     versions.map((v) => cite('artifact_version', v.id, { version_number: v.version_number })));
    }
    return {
      status: 'answered',
      answer: { artifact_id: targetId, version_count: versions.length, changes: deltas },
      citations: versions.map((v) => cite('artifact_version', v.id,
        { version_number: v.version_number, change_summary: v.change_summary })),
      records_checked: versions.length,
      note: 'Change descriptions are the change_summary values recorded by the authoring actor, not generated prose.',
    };
  },

  async what_canonical(db, { entity }) {
    const scope = entity ? { clause: `WHERE e.id = $1`, params: [entity.id] } : { clause: '', params: [] };
    const { rows } = await db.query(
      `SELECT e.id, e.name, e.status, t.label AS type_label FROM entities e
         JOIN entity_types t ON t.id = e.entity_type_id ${scope.clause} ORDER BY e.status, e.name`, scope.params);
    const { rows: declarations } = await db.query(
      `SELECT cs.*, u.display_name AS declared_by_name, u.kind AS declared_by_kind
         FROM canonical_states cs JOIN users u ON u.id = cs.declared_by
        WHERE cs.superseded_at IS NULL ORDER BY cs.declared_at DESC`);

    if (!rows.length) return unknown('No entities are recorded.', 0);
    const canonical = rows.filter((r) => r.status === 'canonical');
    return {
      status: 'answered',
      answer: {
        canonical: canonical.map((r) => ({ id: r.id, name: r.name, type: r.type_label })),
        provisional: rows.filter((r) => r.status === 'provisional').map((r) => ({ id: r.id, name: r.name })),
        disputed: rows.filter((r) => r.status === 'disputed').map((r) => ({ id: r.id, name: r.name })),
        declarations: declarations.map((d) => ({
          subject: `${d.subject_kind}:${d.subject_id}`, status: d.status,
          declared_by: d.declared_by_name, declared_by_kind: d.declared_by_kind, declared_at: d.declared_at,
          decision_id: d.decision_id ?? UNKNOWN })),
      },
      citations: declarations.map((d) => cite('canonical_state', d.id, { status: d.status })),
      records_checked: rows.length + declarations.length,
      note: 'Canonical status is only ever set by a steward declaration recorded in canonical_states.',
    };
  },

  async what_unknown(db, { entity }) {
    const params = entity ? [entity.id] : [null];
    const [claims, memories, entities, provenance] = await Promise.all([
      db.query(`SELECT c.id, c.statement, c.status, e.name AS entity_name FROM claims c
                  JOIN entities e ON e.id = c.entity_id
                 WHERE c.status IN ('unresolved','unknown','disputed')
                   AND ($1::text IS NULL OR c.entity_id = $1)`, params),
      db.query(`SELECT m.id, m.body, e.name AS entity_name FROM memories m
                  JOIN entities e ON e.id = m.entity_id
                 WHERE m.occurred_at IS NULL AND ($1::text IS NULL OR m.entity_id = $1)`, params),
      db.query(`SELECT id, name FROM entities
                 WHERE (summary IS NULL OR status = 'unknown') AND ($1::text IS NULL OR id = $1)`, params),
      db.query(`SELECT id, subject_kind, subject_id, relation FROM provenance_records WHERE creator IS NULL`),
    ]);

    const items = [
      ...claims.rows.map((c) => ({ kind: 'claim', status: c.status, subject: c.entity_name,
        detail: c.statement, record_id: c.id })),
      ...memories.rows.map((m) => ({ kind: 'memory', status: 'unknown_time', subject: m.entity_name,
        detail: `When this occurred is not recorded: "${m.body.slice(0, 90)}"`, record_id: m.id })),
      ...entities.rows.map((e) => ({ kind: 'entity', status: 'incomplete', subject: e.name,
        detail: 'No summary recorded.', record_id: e.id })),
      ...provenance.rows.map((p) => ({ kind: 'provenance_record', status: 'creator_unknown',
        subject: `${p.subject_kind}:${p.subject_id}`, detail: `Creator not recorded for ${p.relation}.`,
        record_id: p.id })),
    ];

    if (!items.length) {
      return { status: 'answered', answer: { open_questions: [],
        statement: 'Every recorded claim is resolved and no record is missing a tracked field.' },
        citations: [], records_checked: 0 };
    }
    return {
      status: 'answered',
      answer: { open_questions: items },
      citations: items.map((i) => cite(i.kind, i.record_id, { status: i.status })),
      records_checked: items.length,
      note: 'These are the places where WRASAL knows that it does not know.',
    };
  },

  async connected_to(db, { entity }) {
    if (!entity) return unknown('No entity in the Reality Graph matches the subject of the question.', 0);
    const d = await entityDossier(db, entity.id);
    const citations = [];
    const edges = [...d.relationships.outgoing.map((r) => {
      citations.push(cite('relationship', r.id, { predicate: r.predicate }));
      return { predicate: r.predicate, direction: 'outgoing', entity: r.target_name,
               entity_id: r.target_entity_id, epistemic_status: r.epistemic_status };
    }), ...d.relationships.incoming.map((r) => {
      citations.push(cite('relationship', r.id, { predicate: r.predicate }));
      return { predicate: r.predicate, direction: 'incoming', entity: r.source_name,
               entity_id: r.source_entity_id, epistemic_status: r.epistemic_status };
    })];

    const attached = {
      memories: d.memories.length, evidence: d.evidence.length, claims: d.claims.length,
      artifacts: d.artifacts.length, specifications: d.specifications.length,
      provenance_records: d.provenance.length, archive_records: d.archive_records.length,
    };
    if (!edges.length && Object.values(attached).every((v) => v === 0)) {
      return unknown(`${entity.name} exists but nothing is connected to it.`, 0);
    }
    return { status: 'answered', answer: { entity: entity.name, relationships: edges, attached },
             citations, records_checked: citations.length };
  },

  async what_decisions(db, { entity }) {
    const { rows } = await db.query(
      `SELECT d.*, p.display_name AS proposed_by_name, s.display_name AS decided_by_name
         FROM decisions d JOIN users p ON p.id = d.proposed_by
         LEFT JOIN users s ON s.id = d.decided_by
        WHERE ($1::text IS NULL OR d.subject_id = $1) ORDER BY d.proposed_at`,
      [entity ? entity.id : null]);
    if (!rows.length) return unknown('No decision records exist for this subject.', 0);
    return {
      status: 'answered',
      answer: { decisions: rows.map((d) => ({
        id: d.id, subject: `${d.subject_kind}:${d.subject_id}`, question: d.question,
        status: d.status, resolution: d.resolution ?? UNKNOWN, rationale: d.rationale ?? UNKNOWN,
        proposed_by: d.proposed_by_name, decided_by: d.decided_by_name ?? UNKNOWN,
        decided_at: d.decided_at ?? UNKNOWN })) },
      citations: rows.map((d) => cite('decision', d.id, { status: d.status })),
      records_checked: rows.length,
    };
  },

  async what_releasable(db) {
    const { rows } = await db.query(
      `SELECT a.id, a.name, a.status, a.archived_at,
              (SELECT count(*)::int FROM artifact_versions v WHERE v.artifact_id = a.id) AS versions,
              (SELECT count(*)::int FROM provenance_records p
                WHERE (p.subject_kind='artifact' AND p.subject_id=a.id)
                   OR p.subject_id IN (SELECT id FROM artifact_versions WHERE artifact_id=a.id)) AS provenance,
              e.name AS entity_name, e.status AS entity_status
         FROM artifacts a LEFT JOIN entities e ON e.id = a.entity_id ORDER BY a.name`);
    if (!rows.length) return unknown('No artifacts are recorded.', 0);

    const assess = (a) => {
      const blockers = [];
      if (a.status !== 'canonical') blockers.push(`artifact status is "${a.status}", not canonical`);
      if (a.provenance === 0) blockers.push('no provenance records');
      if (a.versions === 0) blockers.push('no versions');
      if (a.entity_status && a.entity_status !== 'canonical') {
        blockers.push(`subject entity "${a.entity_name}" is "${a.entity_status}"`);
      }
      return blockers;
    };
    return {
      status: 'answered',
      answer: {
        releasable: rows.filter((a) => assess(a).length === 0).map((a) => ({ id: a.id, name: a.name })),
        blocked: rows.filter((a) => assess(a).length > 0)
          .map((a) => ({ id: a.id, name: a.name, blockers: assess(a) })),
      },
      citations: rows.map((a) => cite('artifact', a.id, { status: a.status })),
      records_checked: rows.length,
      note: 'Release readiness is computed from recorded state only. WRASAL does not grant release; a steward does.',
    };
  },
};

export const SUGGESTED_QUESTIONS = [
  'What do I actually know about Miss Celia?',
  'Where did the Porch Portrait come from?',
  'What evidence supports the claim about the ledger?',
  'What changed between versions of the Porch Portrait?',
  'What is canonical?',
  'What remains unknown?',
  'Show me everything connected to Miss Celia.',
  'Which decisions changed this world?',
  'What can I safely release?',
];
