import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EventLog } from '../src/core/event-log.js';
import { WrayveService } from '../src/core/service.js';
import { MediaStore } from '../src/core/media-store.js';
import { AdapterRegistry } from '../src/adapters/registry.js';
import { MockExecutionAdapter } from '../src/adapters/mock-adapter.js';
import { PROVIDER } from '../src/adapters/providers.js';
import { EXECUTION_MODE } from '../src/core/vocabulary.js';
import { seedWray, blackRoomScene, fixedClock } from './helpers.mjs';
import {
  CUSTODY_RESULT, CUSTODY_STATE, RESULT_STATE, RESULT_SEMANTICS,
  foldCustody, substantiationGap, assertNoRetroactiveRewrite,
} from '../src/core/custody.js';
import { ArchiveSteward, NOT_ATTEMPTED_REASON } from '../src/core/archive-steward.js';
import { REFERENCE_CLASS, buildArtifactRecord } from '../src/core/artifact.js';

/**
 * WRASAL-0015 — ARCHIVE STEWARD.
 *
 * The constitutional rule under test:
 *   Past informs. Future cannot rewrite.
 *
 * And the distinction the Steward exists to protect: what WRASAL once
 * possessed, what it currently possesses, and what it can currently prove.
 */

/** A service backed by real on-disk media, so bytes can actually vanish. */
function makeDiskService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrayve-custody-'));
  const mediaStore = new MediaStore({ directory: path.join(dir, 'media') });
  const registry = new AdapterRegistry();
  registry.register(PROVIDER.MOCK, new MockExecutionAdapter({ mediaStore }));
  const clock = fixedClock();
  const service = new WrayveService({ eventLog: new EventLog({ clock }), registry, mediaStore, clock });
  return { service, mediaStore, dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

async function completedRun(service) {
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({
    scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION,
  });
  service.runAuthorityCheck(request.id, {});
  service.approve(request.id, { actor: 'wray', statement: 'approved' });
  const { generation_event: event } = await service.execute(request.id, {});
  return event;
}

// ------------------------------------------------------- the result vocabulary

test('only a hash mismatch is dispositive; absence and inaccessibility are not falsehood', () => {
  assert.equal(RESULT_STATE[CUSTODY_RESULT.PRESENT_HASH_MATCH], CUSTODY_STATE.INTEGRITY_OK);
  assert.equal(RESULT_STATE[CUSTODY_RESULT.PRESENT_HASH_MISMATCH], CUSTODY_STATE.INTEGRITY_FAILED);
  for (const result of [CUSTODY_RESULT.ABSENT, CUSTODY_RESULT.INACCESSIBLE, CUSTODY_RESULT.NOT_ATTEMPTED]) {
    assert.equal(RESULT_STATE[result], CUSTODY_STATE.INTEGRITY_UNVERIFIED,
      `${result} must fold to INTEGRITY_UNVERIFIED, never to a finding of falsehood`);
  }
  // Every result must name the inference it does NOT license.
  for (const key of Object.keys(CUSTODY_RESULT)) {
    assert.ok(RESULT_SEMANTICS[key].does_not_establish, `${key} must state what it does not establish`);
  }
  // Existence and accessibility are different facts.
  assert.match(RESULT_SEMANTICS.ABSENT.does_not_establish, /ceased to exist/i);
});

// --------------------------------------------------------- the Steward's limits

test('the Archive Steward is structurally incapable of reaching a provider', () => {
  const source = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'archive-steward.js'),
    'utf8',
  );
  for (const forbidden of ['fetch(', 'node:http', 'node:https', 'node:net', 'node:tls', 'XMLHttpRequest']) {
    assert.ok(!source.includes(forbidden), `the Steward must not reference ${forbidden}`);
  }
  // It accepts no fetch implementation and no credential.
  const steward = new ArchiveSteward({ mediaStore: { resolve: () => null } });
  assert.equal(steward.fetchImpl, undefined);
  assert.equal(steward.apiKey, undefined);
  // It exposes exactly one verb.
  const verbs = Object.getOwnPropertyNames(ArchiveSteward.prototype).filter((n) => n !== 'constructor');
  assert.deepEqual(verbs, ['observe']);
});

test('a presigned provider reference is never fetched and stays honestly NOT_ATTEMPTED', () => {
  const steward = new ArchiveSteward({ mediaStore: { resolve: () => { throw new Error('must not be called'); } } });
  const artifact = buildArtifactRecord({
    reference_class: REFERENCE_CLASS.PRESIGNED_REFERENCE,
    reference: 'https://files.provider.example/vid_001.mp4?signature=redacted',
    evidence: { observed_response: true, provider_reported_completion: true },
  });

  const observation = steward.observe(artifact);
  assert.equal(observation.result, CUSTODY_RESULT.NOT_ATTEMPTED);
  assert.equal(observation.reason, NOT_ATTEMPTED_REASON.REMOTE_REFERENCE_FETCH_FORBIDDEN);
  assert.equal(observation.bytes_present, null, 'presence must not be guessed for a reference never examined');
  assert.equal(RESULT_STATE[observation.result], CUSTODY_STATE.INTEGRITY_UNVERIFIED);
});

// ------------------------------------------------------------- the three clocks

test('event time, evidence time and custody time are never collapsed', async () => {
  const { service, cleanup } = makeDiskService();
  try {
    const event = await completedRun(service);
    const custody = service.observeCustody(event.id);

    assert.equal(custody.current_epistemic_state, CUSTODY_STATE.INTEGRITY_OK);
    const { event_time, evidence_time, custody_time } = custody.clocks;
    assert.ok(event_time && evidence_time && custody_time);
    // Custody time is strictly later: it is a separate act of observation.
    assert.ok(Date.parse(custody_time) > Date.parse(event_time),
      'custody time must be a later, separate observation, not a copy of event time');
  } finally { cleanup(); }
});

test('custody time advances only on substantiation, not merely on looking', async () => {
  const { service, mediaStore, cleanup } = makeDiskService();
  try {
    const event = await completedRun(service);
    const first = service.observeCustody(event.id);
    const substantiatedAt = first.clocks.custody_time;
    assert.ok(substantiatedAt);

    // The artefact disappears, then we look again.
    fs.rmSync(mediaStore.resolve(event.artifact.reference.split('/').pop()));
    const second = service.observeCustody(event.id);

    assert.equal(second.last_result, CUSTODY_RESULT.ABSENT);
    assert.ok(Date.parse(second.last_observed_at) > Date.parse(substantiatedAt), 'we looked again');
    assert.equal(second.clocks.custody_time, substantiatedAt,
      'a failed look must not refresh the last moment possession could be substantiated');
  } finally { cleanup(); }
});

// -------------------------------------------- the sandbox reset, reproduced

test('when the bytes vanish the historical claim survives untouched and only the current state decays', async () => {
  const { service, mediaStore, cleanup } = makeDiskService();
  try {
    const event = await completedRun(service);
    const originalStatement = event.artifact.possession_statement;
    const originalHash = event.artifact.content_hash;
    assert.equal(event.artifact.reference_class, REFERENCE_CLASS.ARCHIVED_ARTIFACT);

    service.observeCustody(event.id);

    // Exactly what the sandbox did between turns: the gitignored bytes go away.
    fs.rmSync(mediaStore.resolve(event.artifact.reference.split('/').pop()));
    const custody = service.observeCustody(event.id);

    // The current state decays...
    assert.equal(custody.current_epistemic_state, CUSTODY_STATE.INTEGRITY_UNVERIFIED);
    assert.equal(custody.last_result, CUSTODY_RESULT.ABSENT);
    assert.match(custody.state_note, /does not mean the artefact is gone or false/i);

    // ...but the historical proposition is reproduced verbatim, not revised.
    assert.equal(custody.historical_proposition.statement, originalStatement);
    assert.equal(custody.historical_proposition.content_hash, originalHash);
    assert.equal(custody.historical_proposition.claimed_durability, 'DURABLE');

    // And the record in the ledger itself is byte-identical to what it was.
    const stored = service.getGenerationEvent(event.id);
    assert.deepEqual(stored.artifact, event.artifact, 'the generation event must never be patched');

    // It was substantiated once; that fact also survives.
    assert.equal(custody.ever_substantiated, true);
    assert.equal(custody.observation_count, 2);
  } finally { cleanup(); }
});

test('later reality cannot rewrite what earlier WRASAL knew', async () => {
  const { service, mediaStore, cleanup } = makeDiskService();
  try {
    const event = await completedRun(service);
    const before = JSON.stringify(service.getGenerationEvent(event.id));

    fs.rmSync(mediaStore.resolve(event.artifact.reference.split('/').pop()));
    service.observeCustody(event.id);
    service.observeCustody(event.id);

    assert.equal(JSON.stringify(service.getGenerationEvent(event.id)), before,
      'no number of later observations may alter the historical record');
    assert.equal(service.integrity().intact, true, 'the hash chain stays intact');
    assert.throws(
      () => assertNoRetroactiveRewrite({ durability: 'DURABLE' }, { durability: 'UNKNOWN' }),
      (error) => error.code === 'RETROACTIVE_REWRITE',
    );
  } finally { cleanup(); }
});

test('corruption is the one dispositive finding', async () => {
  const { service, mediaStore, cleanup } = makeDiskService();
  try {
    const event = await completedRun(service);
    fs.writeFileSync(mediaStore.resolve(event.artifact.reference.split('/').pop()), 'tampered');
    const custody = service.observeCustody(event.id);

    assert.equal(custody.last_result, CUSTODY_RESULT.PRESENT_HASH_MISMATCH);
    assert.equal(custody.current_epistemic_state, CUSTODY_STATE.INTEGRITY_FAILED);
    assert.ok(custody.substantiation_gaps.some((gap) => gap.code === 'INTEGRITY_CONTRADICTED'));
    assert.notEqual(custody.observations.at(-1).recomputed_hash, custody.historical_proposition.content_hash);
  } finally { cleanup(); }
});

// -------------------------------------------------- the 0015 headline finding

test('an unobserved ARCHIVED claim is reported as unsubstantiated, not quietly downgraded', async () => {
  const { service, cleanup } = makeDiskService();
  try {
    const event = await completedRun(service);
    // No observation has been taken yet — the state WRASAL shipped 0014 in.
    const custody = service.custodyFor(event.id);

    assert.equal(custody.observation_count, 0);
    assert.equal(custody.ever_substantiated, false);
    assert.equal(custody.clocks.custody_time, null);
    assert.equal(custody.current_epistemic_state, CUSTODY_STATE.INTEGRITY_UNVERIFIED);

    const codes = custody.substantiation_gaps.map((gap) => gap.code);
    assert.ok(codes.includes('UNSUBSTANTIATED_DURABILITY_CLAIM'));
    assert.ok(codes.includes('UNSUBSTANTIATED_POSSESSION_CLAIM'));
    // The claim itself is NOT edited to make the gap disappear.
    assert.equal(service.getGenerationEvent(event.id).artifact.durability, 'DURABLE');
  } finally { cleanup(); }
});

test('the custody report states plainly what WRASAL cannot substantiate', async () => {
  const { service, mediaStore, cleanup } = makeDiskService();
  try {
    const event = await completedRun(service);
    service.observeCustody(event.id);

    let report = service.custodyReport();
    assert.equal(report.artifact_count, 1);
    assert.equal(report.substantiated, 1);
    assert.equal(report.substantiation_gap_count, 0);
    assert.match(report.statement, /has been substantiated/i);

    fs.rmSync(mediaStore.resolve(event.artifact.reference.split('/').pop()));
    service.observeCustody(event.id);

    report = service.custodyReport();
    assert.equal(report.substantiated, 0);
    assert.equal(report.unverified, 1);
    assert.equal(report.contradicted, 0);
    assert.ok(report.gap_codes.includes('UNSUBSTANTIATED_POSSESSION_CLAIM'));
    assert.match(report.statement, /cannot currently substantiate/i);
  } finally { cleanup(); }
});

test('a failed execution has nothing to observe and says so without inventing a finding', async () => {
  const folded = foldCustody(
    buildArtifactRecord({ reference_class: REFERENCE_CLASS.ARTIFACT_UNAVAILABLE, evidence: {} }),
    [],
  );
  assert.equal(folded.current_epistemic_state, CUSTODY_STATE.INTEGRITY_UNVERIFIED);
  assert.equal(folded.last_result, CUSTODY_RESULT.NOT_ATTEMPTED);
  // No possession was ever claimed, so there is no gap to report.
  assert.deepEqual(
    substantiationGap(buildArtifactRecord({ reference_class: REFERENCE_CLASS.ARTIFACT_UNAVAILABLE, evidence: {} }), folded),
    [],
  );
});
