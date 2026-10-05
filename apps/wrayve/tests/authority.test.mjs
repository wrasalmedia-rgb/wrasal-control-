import test from 'node:test';
import assert from 'node:assert/strict';

import { makeService, seedWray, blackRoomScene } from './helpers.mjs';
import { AUTHORITY_STATUS, EXECUTION_MODE, SNAPSHOT_STATUS } from '../src/core/vocabulary.js';
import { PROVIDER } from '../src/adapters/providers.js';
import { AuthorityError, StateTransitionError } from '../src/core/errors.js';

/**
 * §25 Test scenarios 01–05: the AuthorityCheck.
 */

test('TEST 01 — valid identity + valid snapshot + approved scene => AUTHORIZED', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id, { approver: 'wray' });

  const { check } = service.runAuthorityCheck(request.id);
  assert.equal(check.decision, AUTHORITY_STATUS.AUTHORIZED);
  assert.equal(service.getRequest(request.id).approval_status, 'APPROVED');
  assert.equal(service.getRequest(request.id).authority_status, 'AUTHORIZED');
});

test('TEST 02 — no approval => DENIED, and execution is refused', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  const { check } = service.runAuthorityCheck(request.id);

  assert.equal(check.decision, AUTHORITY_STATUS.DENIED);
  assert.ok(check.reasons.some((reason) => reason.rule === 'APPROVAL_PRESENT' && reason.result === 'DENY'));

  await assert.rejects(() => service.execute(request.id), AuthorityError);
});

test('TEST 03 — political scene against a policy that prohibits it => DENIED', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id, { political: true });

  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  const { check } = service.runAuthorityCheck(request.id);

  assert.equal(check.decision, AUTHORITY_STATUS.DENIED);
  assert.ok(check.reasons.some((reason) => reason.rule === 'CONTEXT_POLITICAL' && reason.result === 'DENY'));

  // A denied request can never be pushed through approval.
  assert.throws(() => service.approve(request.id), AuthorityError);
});

test('TEST 04 — sexualized scene => DENIED, and not waivable by SIMULATION', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id, { sexualized: true });

  const request = service.requestExecution({
    scene_spec_id: scene.id,
    provider: PROVIDER.MOCK,
    mode: EXECUTION_MODE.SIMULATION,
  });
  const { check } = service.runAuthorityCheck(request.id);

  assert.equal(check.decision, AUTHORITY_STATUS.DENIED);
  assert.ok(check.reasons.some((reason) => reason.rule === 'CONTEXT_SEXUALIZED' && reason.result === 'DENY'));

  // Simulation waives the approval gate only — never a policy prohibition.
  await assert.rejects(() => service.execute(request.id), AuthorityError);
});

test('TEST 05 — inactive identity snapshot => DENIED', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });

  service.deactivateSnapshot({ snapshot_id: snapshot.id, reason: 'withdrawn by identity holder' });
  assert.equal(service.getSnapshot(snapshot.id).status, SNAPSHOT_STATUS.INACTIVE);

  const { check } = service.runAuthorityCheck(request.id);
  assert.equal(check.decision, AUTHORITY_STATUS.DENIED);
  assert.ok(check.reasons.some((reason) => reason.rule === 'SNAPSHOT_ACTIVE' && reason.result === 'DENY'));
});

test('a missing LikenessPolicy denies execution', () => {
  const { service } = makeService();
  const identity = service.createIdentity({ id: 'WRAY-002', canonical_name: 'Wray' });
  const snapshot = service.createSnapshot({ identity_id: identity.id });
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });

  const { check } = service.runAuthorityCheck(request.id);
  assert.equal(check.decision, AUTHORITY_STATUS.DENIED);
  assert.ok(check.reasons.some((reason) => reason.rule === 'POLICY_EXISTS' && reason.result === 'DENY'));
});

test('a REAL execution cannot start from a non-APPROVED lifecycle state', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service, { permissions: { approval_required: false } });
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });

  // Authority passes (approval not required) but the lifecycle gate still holds.
  const { check } = service.runAuthorityCheck(request.id);
  assert.equal(check.decision, AUTHORITY_STATUS.AUTHORIZED);
  await assert.rejects(() => service.execute(request.id), StateTransitionError);
});
