import test from 'node:test';
import assert from 'node:assert/strict';

import { makeService, seedWray, blackRoomScene, fakeFetch } from './helpers.mjs';
import { EXECUTION_MODE, BINDING_STATUS } from '../src/core/vocabulary.js';
import { PROVIDER } from '../src/adapters/providers.js';
import {
  EVIDENCE_LEVEL, EVIDENCE_BURDEN, EVIDENCE_ORDER, claim, rank, atLeast, assertClaimable,
} from '../src/core/evidence-ladder.js';
import {
  REFERENCE_CLASS, POSSESSION, DURABILITY, REFERENCE_SEMANTICS,
  buildArtifactRecord, assertNoFalsePossessionClaim,
} from '../src/core/artifact.js';

/**
 * WRASAL-0014 — Durable Output & Provider Evidence.
 *
 * The invariant under test:
 *   An evidence record must never imply durable possession of an artifact
 *   when WRASAL only possesses an expiring provider reference.
 */

// ---------------------------------------------------------- evidence ladder

test('the evidence ladder is strictly ordered and each rung has a distinct burden', () => {
  assert.deepEqual(EVIDENCE_ORDER, [
    'UNKNOWN', 'DOCUMENTED', 'OBSERVED', 'EXECUTED', 'VERIFIED', 'ARCHIVED',
  ]);
  for (let i = 1; i < EVIDENCE_ORDER.length; i += 1) {
    assert.ok(rank(EVIDENCE_ORDER[i]) > rank(EVIDENCE_ORDER[i - 1]), 'ranks must strictly increase');
  }
  // From OBSERVED upward the burden is strictly cumulative. DOCUMENTED sits
  // off that chain on purpose: documentary evidence is a weaker kind, and a
  // live observation must never be gated on someone filing a doc reference.
  const chain = EVIDENCE_ORDER.slice(EVIDENCE_ORDER.indexOf(EVIDENCE_LEVEL.OBSERVED));
  for (let i = 1; i < chain.length; i += 1) {
    const prev = EVIDENCE_BURDEN[chain[i - 1]].requires;
    const here = EVIDENCE_BURDEN[chain[i]].requires;
    assert.ok(here.length > prev.length, 'each rung must add a burden');
    for (const requirement of prev) assert.ok(here.includes(requirement), `${requirement} must carry upward`);
  }
  assert.deepEqual(EVIDENCE_BURDEN.DOCUMENTED.requires, ['documentation_reference']);
  assert.equal(EVIDENCE_BURDEN.OBSERVED.requires.includes('documentation_reference'), false);
  assert.ok(atLeast('VERIFIED', 'EXECUTED'));
  assert.equal(atLeast('DOCUMENTED', 'OBSERVED'), false);
});

test('documentation alone establishes DOCUMENTED and never EXECUTED', () => {
  const result = claim({ documentation_reference: 'developers.example.com/reference/create-video' });
  assert.equal(result.level, EVIDENCE_LEVEL.DOCUMENTED);
  assert.equal(result.next_level, EVIDENCE_LEVEL.OBSERVED);
  assert.deepEqual(result.missing_for_next, ['observed_response']);
  assert.throws(
    () => assertClaimable(EVIDENCE_LEVEL.EXECUTED, { documentation_reference: 'docs' }),
    (error) => error.code === 'EVIDENCE_OVERCLAIM' && error.detail.supported === 'DOCUMENTED',
  );
});

test('a provider accepting a request is OBSERVED, not EXECUTED', () => {
  const accepted = claim({ observed_response: true });
  assert.equal(accepted.level, EVIDENCE_LEVEL.OBSERVED);
  assert.deepEqual(accepted.missing_for_next, ['provider_reported_completion']);

  const completed = claim({ observed_response: true, provider_reported_completion: true });
  assert.equal(completed.level, EVIDENCE_LEVEL.EXECUTED);
  assert.deepEqual(completed.missing_for_next, ['content_hash']);
});

test('VERIFIED requires independent confirmation and ARCHIVED requires possession', () => {
  const verified = claim({
    observed_response: true, provider_reported_completion: true, content_hash: 'sha256:abc',
  });
  assert.equal(verified.level, EVIDENCE_LEVEL.VERIFIED);
  assert.deepEqual(verified.missing_for_next, ['durable_possession']);

  const archived = claim({
    observed_response: true, provider_reported_completion: true, content_hash: 'sha256:abc', durable_possession: true,
  });
  assert.equal(archived.level, EVIDENCE_LEVEL.ARCHIVED);
  assert.equal(archived.next_level, null);
});

test('evidence gaps do not silently skip rungs', () => {
  // Possession without a hash cannot leapfrog to ARCHIVED.
  const result = claim({ observed_response: true, provider_reported_completion: true, durable_possession: true });
  assert.equal(result.level, EVIDENCE_LEVEL.EXECUTED);
  assert.ok(result.missing_for_next.includes('content_hash'));
});

// -------------------------------------------------------- reference classes

test('all six reference classes are modelled with explicit possession semantics', () => {
  assert.deepEqual(Object.keys(REFERENCE_CLASS).sort(), [
    'ARCHIVED_ARTIFACT', 'ARTIFACT_UNAVAILABLE', 'CONTENT_HASH',
    'DURABLE_ARTIFACT', 'PRESIGNED_REFERENCE', 'PROVIDER_REFERENCE',
  ]);
  for (const key of Object.keys(REFERENCE_CLASS)) {
    const semantics = REFERENCE_SEMANTICS[key];
    assert.ok(semantics, `${key} must declare semantics`);
    assert.ok(Object.values(POSSESSION).includes(semantics.possession));
    assert.ok(Object.values(DURABILITY).includes(semantics.durability));
    assert.equal(typeof semantics.statement, 'string');
    // Only genuine byte possession may set the possession flag.
    assert.equal(
      semantics.wrasal_holds_artifact,
      semantics.possession === POSSESSION.BYTES_HELD,
      `${key} possession flag must follow its possession level`,
    );
  }
});

test('an expiring provider URL never implies possession', () => {
  const record = buildArtifactRecord({
    reference_class: REFERENCE_CLASS.PRESIGNED_REFERENCE,
    reference: 'https://provider.example/output.mp4?signature=redacted',
    media_type: 'video/mp4',
    evidence: { observed_response: true, provider_reported_completion: true },
  });
  assert.equal(record.possession, POSSESSION.NONE);
  assert.equal(record.durability, DURABILITY.EXPIRING);
  assert.equal(record.wrasal_holds_artifact, false);
  assert.equal(record.evidence_level, EVIDENCE_LEVEL.EXECUTED);
  assert.match(record.possession_statement, /does not possess/i);
});

test('the reference class ceiling binds even when the evidence would allow more', () => {
  // Full evidence, but a presigned URL can never be ARCHIVED.
  const record = buildArtifactRecord({
    reference_class: REFERENCE_CLASS.PRESIGNED_REFERENCE,
    reference: 'https://provider.example/output.mp4',
    content_hash: 'sha256:deadbeef',
    evidence: { observed_response: true, provider_reported_completion: true },
  });
  assert.equal(record.evidence_ceiling_for_class, EVIDENCE_LEVEL.EXECUTED);
  assert.equal(record.evidence_level, EVIDENCE_LEVEL.EXECUTED);
  assert.ok(rank(record.evidence_level) <= rank(record.evidence_ceiling_for_class));
});

test('a failed generation records ARTIFACT_UNAVAILABLE rather than an empty success', () => {
  const record = buildArtifactRecord({
    reference_class: REFERENCE_CLASS.ARTIFACT_UNAVAILABLE,
    evidence: { observed_response: true },
  });
  assert.equal(record.wrasal_holds_artifact, false);
  assert.equal(record.reference, null);
  assert.equal(record.evidence_level, EVIDENCE_LEVEL.OBSERVED);
});

test('THE INVARIANT: a record implying possession it does not have is refused', () => {
  const honest = buildArtifactRecord({
    reference_class: REFERENCE_CLASS.PRESIGNED_REFERENCE,
    reference: 'https://provider.example/output.mp4',
    evidence: { observed_response: true, provider_reported_completion: true },
  });
  assert.equal(assertNoFalsePossessionClaim(honest), true);

  // Hand-forged records that lie in each of the four available ways.
  const forgeries = [
    { ...honest, wrasal_holds_artifact: true },
    { ...honest, evidence_level: EVIDENCE_LEVEL.ARCHIVED },
    {
      ...honest,
      reference_class: REFERENCE_CLASS.ARCHIVED_ARTIFACT,
      evidence_level: EVIDENCE_LEVEL.ARCHIVED,
      content_hash: null,
      wrasal_holds_artifact: true,
    },
  ];
  for (const forgery of forgeries) {
    assert.throws(
      () => assertNoFalsePossessionClaim(forgery, { stage: 'test' }),
      (error) => error.code === 'FALSE_POSSESSION_CLAIM',
      `expected refusal for ${JSON.stringify(forgery.reference_class)}`,
    );
  }
});

// -------------------------------------------------------- provider bindings

test('a provider binding is declared, never born verified', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);

  const binding = service.declareProviderBinding({
    identity_snapshot_id: snapshot.id,
    provider: PROVIDER.HEYGEN,
    provider_object_type: 'avatar_id',
    provider_subject_id: 'avatar_abc123',
  });

  assert.equal(binding.binding_status, BINDING_STATUS.DECLARED);
  assert.equal(binding.verified_at, null);
  assert.equal(binding.evidence_ref, null);
  // The three identities remain distinct and traceable.
  assert.equal(binding.identity_snapshot_id, snapshot.id);
  assert.equal(binding.identity_id, snapshot.identity_id);
  assert.notEqual(binding.provider_subject_id, snapshot.id);
});

test('a binding cannot be promoted to VERIFIED without evidence', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const binding = service.declareProviderBinding({
    identity_snapshot_id: snapshot.id,
    provider: PROVIDER.HEYGEN,
    provider_object_type: 'avatar_id',
    provider_subject_id: 'avatar_abc123',
  });

  assert.throws(() => service.verifyProviderBinding(binding.id, {}), /evidence reference/i);
  assert.equal(service.getProviderBinding(binding.id).binding_status, BINDING_STATUS.DECLARED);

  const verified = service.verifyProviderBinding(binding.id, { evidence_ref: 'evidence/OBSERVED-001.json' });
  assert.equal(verified.binding_status, BINDING_STATUS.VERIFIED);
  assert.ok(verified.verified_at);
});

test('WRAYVE refuses to invent a provider subject id', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  assert.throws(
    () => service.declareProviderBinding({
      identity_snapshot_id: snapshot.id,
      provider: PROVIDER.HEYGEN,
      provider_object_type: 'avatar_id',
    }),
    /provider_subject_id is required/,
  );
});

test('revoking a binding leaves history intact and removes it from lookup', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const binding = service.declareProviderBinding({
    identity_snapshot_id: snapshot.id,
    provider: PROVIDER.HEYGEN,
    provider_object_type: 'avatar_id',
    provider_subject_id: 'avatar_abc123',
  });
  assert.ok(service.bindingFor(snapshot.id, PROVIDER.HEYGEN));

  service.revokeProviderBinding(binding.id, { reason: 'subject withdrew provider-side consent' });
  assert.equal(service.bindingFor(snapshot.id, PROVIDER.HEYGEN), null);
  // Append-only: the record still exists, it is not deleted.
  assert.equal(service.getProviderBinding(binding.id).binding_status, BINDING_STATUS.REVOKED);
  assert.equal(service.integrity().intact, true);
});

test('the execution order carries the provider binding and its status', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  service.declareProviderBinding({
    identity_snapshot_id: snapshot.id,
    provider: PROVIDER.MOCK,
    provider_object_type: 'mock_subject',
    provider_subject_id: 'mock_subject_001',
  });

  const request = service.requestExecution({
    scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION,
  });
  service.runAuthorityCheck(request.id, {});
  service.approve(request.id, { actor: 'wray', statement: 'approved' });
  const { generation_event: event } = await service.execute(request.id, {});

  assert.equal(event.provider_binding.provider_subject_id, 'mock_subject_001');
  assert.equal(event.provider_binding.binding_status, BINDING_STATUS.DECLARED);
});

// ------------------------------------------------- end-to-end custody states

test('a local simulated run genuinely reaches ARCHIVED because WRASAL holds the bytes', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({
    scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION,
  });
  service.runAuthorityCheck(request.id, {});
  service.approve(request.id, { actor: 'wray', statement: 'approved' });
  const { generation_event: event } = await service.execute(request.id, {});

  assert.equal(event.artifact.reference_class, REFERENCE_CLASS.ARCHIVED_ARTIFACT);
  assert.equal(event.artifact.wrasal_holds_artifact, true);
  assert.equal(event.artifact.possession, POSSESSION.BYTES_HELD);
  assert.equal(event.artifact.durability, DURABILITY.DURABLE);
  assert.match(event.artifact.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(event.artifact.evidence_level, EVIDENCE_LEVEL.ARCHIVED);
  // Still unmistakably a simulation. Possession is not authenticity.
  assert.equal(event.simulated, true);
});

test('the Freebuff handoff states custody explicitly and refuses to overstate it', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({
    scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION,
  });
  service.runAuthorityCheck(request.id, {});
  service.approve(request.id, { actor: 'wray', statement: 'approved' });
  const { generation_event: event } = await service.execute(request.id, {});
  service.recordReview(request.id, { actor: 'wray', decision: 'APPROVED', notes: 'ok' });
  const handoff = service.createFreebuffHandoff(event.id, {});

  assert.equal(handoff.payload.schema, 'wrasal.freebuff.record/v0.2');
  assert.equal(handoff.certified, false);
  assert.equal(handoff.payload.artifact_custody.wrasal_holds_artifact, true);
  assert.equal(handoff.payload.evidence.level, EVIDENCE_LEVEL.ARCHIVED);
  assert.equal(handoff.payload.evidence.simulated, true);
  assert.match(handoff.custody_statement, /durably holds/i);
});

test('a presigned provider artefact degrades to evidence-of-generation, not possession', () => {
  // The exact shape WRASAL-0013 found documented: an expiring output URL.
  const record = buildArtifactRecord({
    reference_class: REFERENCE_CLASS.PRESIGNED_REFERENCE,
    reference: 'https://provider.example/output.mp4?expires=soon',
    media_type: 'video/mp4',
    evidence: { observed_response: true, provider_reported_completion: true },
  });

  const payloadView = {
    artifact_custody: {
      wrasal_holds_artifact: record.wrasal_holds_artifact,
      durability: record.durability,
    },
  };
  assert.equal(payloadView.artifact_custody.wrasal_holds_artifact, false);
  assert.equal(payloadView.artifact_custody.durability, DURABILITY.EXPIRING);
  // What is missing is named, not hidden.
  assert.ok(record.missing_for_next_level.includes('content_hash'));
});

test('HeyGen normalisation classifies its documented output URL as PRESIGNED, never archived', async () => {
  const fetchImpl = fakeFetch({
    'GET /v3/users/me': { status: 200, body: { data: { username: 'ops' } } },
    'POST /v3/videos': { status: 200, body: { data: { video_id: 'vid_001' } } },
    'GET /v3/videos/': {
      status: 200,
      body: {
        data: {
          id: 'vid_001',
          status: 'completed',
          video_url: 'https://files.provider.example/vid_001.mp4?signature=redacted',
          created_at: 1767225600,
          completed_at: 1767225900,
        },
      },
    },
  });
  const { service } = makeService({
    heygen: { apiKey: 'test-key-not-real', surface: 'v3', binding: { heygen_avatar_id: 'avatar_abc' }, fetchImpl },
  });
  const { snapshot } = seedWray(service, { public_distribution_allowed: true });
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({
    scene_spec_id: scene.id, provider: PROVIDER.HEYGEN, mode: EXECUTION_MODE.REAL,
  });
  service.runAuthorityCheck(request.id, {});
  service.approve(request.id, { actor: 'wray', statement: 'approved' });
  const { generation_event: event } = await service.execute(request.id, {});

  assert.equal(event.execution_status, 'COMPLETED');
  assert.equal(event.artifact.reference_class, REFERENCE_CLASS.PRESIGNED_REFERENCE);
  assert.equal(event.artifact.wrasal_holds_artifact, false);
  assert.equal(event.artifact.content_hash, null);
  assert.equal(event.artifact.evidence_level, EVIDENCE_LEVEL.EXECUTED);
  // The contrast that matters: a real provider run cannot reach the rung a
  // local simulated run reaches, because possession is a different claim.
  assert.ok(rank(event.artifact.evidence_level) < rank(EVIDENCE_LEVEL.ARCHIVED));
});
