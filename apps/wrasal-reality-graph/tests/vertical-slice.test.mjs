// WRASAL V0.1 — end-to-end vertical slice test.
//
// Success criterion under test:
//   Can WRASAL represent a piece of reality, preserve its context, trace where
//   it came from, distinguish evidence from inference, enforce authority,
//   expose relationships, and refuse to invent what it does not know?

import test from 'node:test';
import assert from 'node:assert/strict';

import { createDatabase, migrate } from '../src/persistence/db.js';
import { seed } from '../src/seed/seed.js';
import * as reality from '../src/domain/reality.js';
import * as graph from '../src/graph/graph.js';
import { lineageOf, versionDelta } from '../src/provenance/provenance.js';
import { archiveArtifact, captureArtifactSnapshot, stableStringify } from '../src/archive/archive.js';
import { ask } from '../src/reasoning/ask.js';
import { AuthorityError, capabilitiesOf, permits } from '../src/authority/authority.js';
import { UNKNOWN, CANONICAL_STATUS as CS, EPISTEMIC_STATUS as ES } from '../src/domain/vocabulary.js';

const db = await createDatabase();
await migrate(db);
const fixture = await seed(db);

const steward = { db, actor: fixture.users.steward };
const archivist = { db, actor: fixture.users.archivist };
const machine = { db, actor: fixture.users.machine };

// --- 1. CREATE -------------------------------------------------------------

test('1. an entity can be created and enters the Reality Graph', async () => {
  const e = await reality.createEntity(steward, {
    name: 'The Flood of 1977', entity_type_id: 'event', world_id: fixture.world_id,
    summary: 'Water to the second step of the porch house.',
    source: 'test harness', reason: 'vertical slice: create',
  });
  const d = await graph.entityDossier(db, e.subject_id);
  assert.equal(d.entity.name, 'The Flood of 1977');
  assert.equal(d.entity.status, CS.PROVISIONAL, 'new entities are provisional, never canonical by default');
});

test('2. entity types are assigned and enumerable', async () => {
  const types = await graph.listEntityTypes(db);
  assert.ok(types.find((t) => t.id === 'character'));
  const d = await graph.entityDossier(db, fixture.celia_id);
  assert.equal(d.entity.type_label, 'Character');
});

test('3. relationships connect entities in both directions', async () => {
  const d = await graph.entityDossier(db, fixture.celia_id);
  const predicates = d.relationships.outgoing.map((r) => r.predicate);
  assert.ok(predicates.includes('keeper_of'));
  assert.ok(d.relationships.incoming.some((r) => r.predicate === 'author_of'));
});

test('4. memories attach to an entity and may have an unknown time', async () => {
  const d = await graph.entityDossier(db, fixture.celia_id);
  assert.ok(d.memories.length >= 4);
  assert.ok(d.memories.some((m) => m.occurred_at === null), 'a memory may record that its time is unknown');
});

test('5. evidence records carry a source and an observed result', async () => {
  const d = await graph.entityDossier(db, fixture.celia_id);
  assert.ok(d.evidence.length >= 3);
  for (const e of d.evidence) {
    assert.ok(e.source && e.observed_result);
    assert.notEqual(e.epistemic_status, ES.GENERATED_INTERPRETATION,
      'evidence can never be machine-generated interpretation');
  }
});

test('5b. the database refuses to store generated interpretation as evidence', async () => {
  await assert.rejects(
    reality.recordEvidence(archivist, {
      entity_id: fixture.celia_id, title: 'Fabricated', source: 'model output',
      source_kind: 'document', observed_result: 'invented',
      epistemic_status: ES.GENERATED_INTERPRETATION,
      source: 'test', reason: 'attempt to launder inference into evidence',
    }),
    /evidence_is_not_generated|violates check constraint/i,
  );
});

test('6. claim status is computed from evidence links, never asserted', async () => {
  const d = await graph.entityDossier(db, fixture.celia_id);
  const supported = d.claims.find((c) => c.statement.includes('kept the Pell Road Ledger'));
  const unresolved = d.claims.find((c) => c.id === fixture.unresolved_claim_id);
  assert.equal(supported.status, 'supported');
  assert.equal(unresolved.status, 'unresolved');
  assert.equal((Array.isArray(unresolved.support) ? unresolved.support : []).length, 0);
});

test('6b. contradicting evidence moves a claim to disputed', async () => {
  const claim = await reality.assertClaim(steward, {
    entity_id: fixture.celia_id, statement: 'Miss Celia left the county in 1977.',
    source: 'test harness', reason: 'vertical slice: disputed claim',
  });
  const forEv = await reality.recordEvidence(archivist, {
    entity_id: fixture.celia_id, title: 'Departure note', source: 'box 14',
    source_kind: 'document', observed_result: 'A note reading "gone north".',
    source: 'test', reason: 'supporting record',
  });
  const againstEv = await reality.recordEvidence(archivist, {
    entity_id: fixture.celia_id, title: 'Census line, 1978', source: 'box 2',
    source_kind: 'external_record', observed_result: 'A C. listed at Pell Road in 1978.',
    source: 'test', reason: 'contradicting record',
  });
  await reality.linkClaimEvidence(archivist, { claim_id: claim.subject_id, evidence_id: forEv.subject_id,
    stance: 'supports', source: 'test', reason: 'link' });
  const res = await reality.linkClaimEvidence(archivist, { claim_id: claim.subject_id,
    evidence_id: againstEv.subject_id, stance: 'contradicts', source: 'test', reason: 'link' });
  assert.equal(res.new_state.status, 'disputed');
});

test('7. provenance is recorded and lineage is traversable in both directions', async () => {
  const lineage = await lineageOf(db, 'artifact', fixture.artifact_id);
  assert.ok(lineage.ancestors.length >= 1);
  assert.equal(lineage.ownership, UNKNOWN, 'derivation never implies ownership');
  assert.match(lineage.note, /do not establish ownership/i);
});

test('8 & 9. artifacts version, and each version derives from the last', async () => {
  const { versions, deltas } = await versionDelta(db, fixture.artifact_id);
  assert.equal(versions.length, 3);
  assert.equal(deltas.length, 2);
  const lineage = await lineageOf(db, 'artifact_version', versions[2].id);
  assert.ok(lineage.ancestors.some((a) => a.relation === 'supersedes'));
  assert.equal(versions[1].epistemic_status, ES.GENERATED_INTERPRETATION,
    'the machine-rendered version is marked as interpretation');
  assert.equal(versions[2].epistemic_status, ES.USER_SUPPLIED,
    'the human correction is marked as user-supplied');
});

test('10. the graph projection exposes nodes, links and attached record classes', async () => {
  const g = await graph.graphProjection(db, { focus: fixture.celia_id, depth: 2 });
  assert.ok(g.nodes.find((n) => n.id === fixture.celia_id));
  assert.ok(g.links.length > 0);
  assert.ok(g.satellites.some((s) => s.entity_id === fixture.celia_id && s.kind === 'evidence'));
});

// --- AUTHORITY -------------------------------------------------------------

test('A1. an AI actor may not declare canonical status', async () => {
  await assert.rejects(
    reality.declareCanonical(machine, {
      subject_kind: 'entity', subject_id: fixture.celia_id, status: CS.CANONICAL,
      source: 'model confidence', reason: 'the model is confident',
    }),
    (err) => err instanceof AuthorityError && /may not perform "declare_canonical"/.test(err.message),
  );
});

test('A2. an AI actor may not accept a decision or release', async () => {
  assert.equal(permits(fixture.users.machine, 'accept_decision'), false);
  assert.equal(permits(fixture.users.machine, 'release'), false);
  assert.equal(permits(fixture.users.machine, 'record_memory'), true,
    'the AI may still participate by contributing records');
  const caps = capabilitiesOf(fixture.users.machine);
  assert.ok(caps.may_not.includes('declare_canonical'));
  assert.ok(caps.may.includes('create_relationship'));
});

test('A3. a contributor may not declare canonical status', async () => {
  await assert.rejects(
    reality.declareCanonical(archivist, {
      subject_kind: 'entity', subject_id: fixture.celia_id, status: CS.CANONICAL,
      source: 'archivist', reason: 'looks settled to me',
    }),
    /requires authority level "steward"/,
  );
});

test('A4. a mutation without a stated source and reason is refused', async () => {
  await assert.rejects(
    reality.createEntity({ db, actor: fixture.users.steward },
      { name: 'Nameless', entity_type_id: 'object', source: '', reason: '' }),
    /requires an explicit source and reason/,
  );
});

test('A5. the database itself refuses to record an AI as the authority behind canon', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO authority_events
         (id, actor_id, actor_kind, authority_level, action, subject_kind, subject_id, source, reason)
       VALUES ('auth_forged','usr_perception','ai','author','declare_canonical','entity',$1,'forged','forged')`,
      [fixture.celia_id]),
    /ai_may_not_declare_canon|violates check constraint/i,
  );
});

test('A6. an AI actor cannot be stored with steward authority', async () => {
  await assert.rejects(
    db.query(`INSERT INTO users (id, handle, display_name, kind, authority_level)
              VALUES ('usr_rogue','rogue','Rogue','ai','steward')`),
    /ai_may_not_be_steward|violates check constraint/i,
  );
});

// --- AUDIT SPINE -----------------------------------------------------------

test('E1. every state transition left an authority event with who/what/why', async () => {
  const { rows } = await db.query(`SELECT * FROM authority_events ORDER BY occurred_at`);
  assert.ok(rows.length > 20);
  for (const r of rows) {
    assert.ok(r.actor_id && r.action && r.subject_kind && r.subject_id && r.source && r.reason);
  }
});

test('E2. the canonical promotion recorded previous and new state', async () => {
  const { rows } = await db.query(
    `SELECT * FROM authority_events WHERE action = 'declare_canonical' AND subject_id = $1`,
    [fixture.celia_id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].previous_state.status, 'provisional');
  assert.equal(rows[0].new_state.status, 'canonical');
  assert.equal(rows[0].actor_kind, 'human');
});

test('E3. an entity exposes a complete event history', async () => {
  const d = await graph.entityDossier(db, fixture.celia_id);
  const kinds = d.timeline.map((e) => e.kind);
  assert.ok(kinds.includes('create_entity'));
  assert.ok(kinds.includes('declare_canonical'));
  assert.ok(d.authority_events.length >= 2);
});

test('E4. a failed authorised action writes nothing (transaction rolls back)', async () => {
  const before = (await db.query(`SELECT count(*)::int AS n FROM entities`)).rows[0].n;
  await assert.rejects(reality.createEntity(steward, {
    name: 'Orphan', entity_type_id: 'does_not_exist', source: 'test', reason: 'force a failure' }));
  const after = (await db.query(`SELECT count(*)::int AS n FROM entities`)).rows[0].n;
  assert.equal(after, before);
});

// --- ASK WRASAL ------------------------------------------------------------

test('Q1. "what do I know" separates established fact from unestablished interpretation', async () => {
  const r = await ask(db, 'What do I actually know about Miss Celia?');
  assert.equal(r.status, 'answered');
  assert.ok(r.answer.established.length >= 4);
  assert.ok(r.answer.not_established.some((x) => x.claim_status === 'unresolved'));
  assert.ok(r.citations.length > 0, 'every answer cites the records behind it');
  assert.ok(r.answer.unknown.length > 0, 'the answer names what is not known');
});

test('Q2. the unresolved claim is never reported as fact', async () => {
  const r = await ask(db, 'What do I actually know about Miss Celia?');
  const text = JSON.stringify(r.answer.established);
  assert.ok(!text.includes('wrote the second hand'),
    'an unsupported claim must not appear among established facts');
  assert.ok(JSON.stringify(r.answer.not_established).includes('wrote the second hand'));
});

test('Q3. asking about an entity that does not exist returns UNKNOWN', async () => {
  const r = await ask(db, 'What do I actually know about Captain Nemo?');
  assert.equal(r.answer, UNKNOWN);
  assert.equal(r.status, 'unknown');
  assert.match(r.note, /rather than inventing/);
});

test('Q4. asking an unanswerable kind of question returns UNKNOWN, not prose', async () => {
  const r = await ask(db, 'Write me a poem about the weather in 1823.');
  assert.equal(r.answer, UNKNOWN);
});

test('Q5. provenance questions report the chain and refuse to assert ownership', async () => {
  const r = await ask(db, 'Where did the Porch Portrait come from?', { artifact_id: fixture.artifact_id });
  assert.equal(r.status, 'answered');
  assert.ok(r.answer.origin_chain.length >= 1);
  assert.equal(r.answer.ownership, UNKNOWN);
});

test('Q6. provenance for a subject with no records returns UNKNOWN', async () => {
  const bare = await reality.createEntity(steward, {
    name: 'Unsourced Thing', entity_type_id: 'object', source: 'test', reason: 'no provenance on purpose' });
  const r = await ask(db, 'Where did Unsourced Thing come from?', { entity_id: bare.subject_id });
  assert.equal(r.answer, UNKNOWN);
});

test('Q7. evidence questions report supporting and contradicting records', async () => {
  const r = await ask(db, 'What evidence supports the claim that Miss Celia kept the ledger?');
  assert.equal(r.status, 'answered');
  const ledgerClaim = r.answer.claims.find((c) => c.claim.includes('kept the Pell Road Ledger'));
  assert.equal(ledgerClaim.supporting.length, 2);
  const unresolved = r.answer.claims.find((c) => c.claim.includes('wrote the second hand'));
  if (unresolved) assert.equal(unresolved.verdict, UNKNOWN);
});

test('Q8. "what changed" reports recorded change summaries, not generated prose', async () => {
  const r = await ask(db, 'What changed between versions of the Porch Portrait?',
    { artifact_id: fixture.artifact_id });
  assert.equal(r.status, 'answered');
  assert.equal(r.answer.changes.length, 2);
  assert.match(r.answer.changes[1].change_summary, /Human correction/);
});

test('Q9. "what is canonical" reports only steward declarations', async () => {
  const r = await ask(db, 'What is canonical?');
  assert.ok(r.answer.canonical.some((c) => c.name === 'Miss Celia'));
  for (const d of r.answer.declarations) assert.notEqual(d.declared_by_kind, 'ai');
});

test('Q10. "what remains unknown" enumerates the gaps WRASAL knows about', async () => {
  const r = await ask(db, 'What remains unknown?');
  assert.ok(r.answer.open_questions.length > 0);
  assert.ok(r.answer.open_questions.some((q) => q.kind === 'claim' && q.status === 'unresolved'));
});

test('Q11. connection questions list relationships with their epistemic status', async () => {
  const r = await ask(db, 'Show me everything connected to Miss Celia.');
  assert.ok(r.answer.relationships.length >= 3);
  assert.ok(r.answer.attached.evidence >= 3);
});

test('Q12. release readiness is computed, and blockers are named', async () => {
  const r = await ask(db, 'What can I safely release?');
  assert.ok(r.answer.releasable.length + r.answer.blocked.length > 0);
  for (const b of r.answer.blocked) assert.ok(b.blockers.length > 0);
});

test('Q13. a machine-proposed relationship is never promoted to fact', async () => {
  const { rows } = await db.query(
    `SELECT * FROM relationships WHERE epistemic_status = 'generated_interpretation'`);
  assert.ok(rows.length >= 1);
  for (const r of rows) assert.notEqual(r.status, 'canonical');
  const d = await graph.entityDossier(db, rows[0].source_entity_id);
  const edge = d.relationships.outgoing.find((x) => x.id === rows[0].id);
  assert.equal(edge.epistemic_status, 'generated_interpretation');
});

// --- ARCHIVE ---------------------------------------------------------------

test('Z1. archiving preserves artifact, versions, provenance, evidence and canon', async () => {
  const snapshot = await captureArtifactSnapshot(db, fixture.artifact_id);
  const result = await archiveArtifact(steward, {
    artifact_id: fixture.artifact_id,
    reason: 'vertical slice: preserve the Porch Portrait',
    source: 'test harness',
  });
  const rec = (await db.query(`SELECT * FROM archive_records WHERE id = $1`, [result.archive_id])).rows[0];
  assert.equal(rec.snapshot.versions.length, 3);
  assert.ok(rec.snapshot.provenance.length >= 2);
  assert.ok(rec.snapshot.supporting_evidence.length >= 3);
  assert.equal(rec.snapshot.canonical_status, 'canonical');
  assert.ok(rec.snapshot.created_at);
  assert.ok(rec.archived_at);
  assert.equal(rec.snapshot_hash.length, 64);
  assert.equal(snapshot.versions.length, 3);
});

test('Z2. an archive snapshot is stable: unchanged input hashes identically', async () => {
  const a = await captureArtifactSnapshot(db, fixture.artifact_id);
  const b = await captureArtifactSnapshot(db, fixture.artifact_id);
  assert.equal(stableStringify(a), stableStringify(b));
});

test('Z3. archiving is itself a governed, audited action', async () => {
  const { rows } = await db.query(
    `SELECT * FROM authority_events WHERE action = 'archive' AND subject_id = $1`, [fixture.artifact_id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].previous_state.archived, false);
  assert.equal(rows[0].new_state.archived, true);
});

test('Z4. an AI actor may not archive', async () => {
  await assert.rejects(
    archiveArtifact(machine, { artifact_id: fixture.artifact_id, reason: 'tidy up', source: 'model' }),
    /may not perform "archive"/,
  );
});

test.after(async () => { await db.close(); });
