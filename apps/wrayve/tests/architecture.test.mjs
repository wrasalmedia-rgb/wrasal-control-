import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeService, seedWray, blackRoomScene, memoryMediaStore } from './helpers.mjs';
import { EXECUTION_MODE } from '../src/core/vocabulary.js';
import { PROVIDER } from '../src/adapters/providers.js';
import { MockExecutionAdapter } from '../src/adapters/mock-adapter.js';
import { RunwayAdapter } from '../src/adapters/runway-adapter.js';
import { HeyGenAdapter } from '../src/adapters/heygen-adapter.js';
import { IdentityExecutionAdapter } from '../src/adapters/identity-execution-adapter.js';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * §28 ARCHITECTURAL TEST.
 *
 * Disable HeyGen. Swap in another adapter. Nothing in the identity model moves.
 */

test('every adapter implements the IdentityExecutionAdapter interface', () => {
  for (const Adapter of [MockExecutionAdapter, HeyGenAdapter, RunwayAdapter]) {
    assert.ok(Adapter.prototype instanceof IdentityExecutionAdapter, `${Adapter.name} must extend the interface`);
    for (const method of ['validate', 'compile', 'execute', 'retrieve', 'normalize']) {
      assert.equal(typeof Adapter.prototype[method], 'function', `${Adapter.name}.${method} missing`);
    }
  }
});

test('HeyGen can be unregistered entirely and the application keeps working', async () => {
  const { service, registry } = makeService();
  registry.unregister(PROVIDER.HEYGEN);
  assert.equal(registry.has(PROVIDER.HEYGEN), false);

  const { identity, snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION });
  service.approve(request.id, { approver: 'wray' });
  const result = await service.execute(request.id);

  assert.equal(result.status, 'GENERATED');
  const chain = service.provenanceChain(result.generation_event.id);
  assert.equal(chain.links[0].id, identity.id);
  assert.equal(service.createFreebuffHandoff(result.generation_event.id).mode, 'SIMULATED');
});

test('swapping the provider changes nothing in the identity model', async () => {
  const runs = [];

  for (const Adapter of [MockExecutionAdapter, class SecondMock extends MockExecutionAdapter {
    static provider = 'MOCK';
    static label = 'drop-in replacement adapter';
  }]) {
    const { service, registry } = makeService();
    registry.unregister(PROVIDER.MOCK);
    registry.register(PROVIDER.MOCK, new Adapter({ mediaStore: memoryMediaStore() }));

    const { snapshot } = seedWray(service);
    const scene = blackRoomScene(service, snapshot.id);
    const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.SIMULATION });
    service.approve(request.id, { approver: 'wray' });
    const result = await service.execute(request.id);

    runs.push({
      identity: service.listIdentities(),
      snapshots: service.snapshotsFor('WRAY-001').map((item) => ({ ...item })),
      policy: service.policyFor(snapshot.id),
      scene: service.getScene(scene.id),
      authority: service.state.authorityChecks.get(request.id).reasons.map((reason) => `${reason.rule}:${reason.result}`),
      chainSteps: service.provenanceChain(result.generation_event.id).links.map((link) => link.step),
      generationShape: Object.keys(result.generation_event).sort(),
    });
  }

  assert.deepEqual(runs[0].identity, runs[1].identity);
  assert.deepEqual(runs[0].snapshots, runs[1].snapshots);
  assert.deepEqual(runs[0].policy, runs[1].policy);
  assert.deepEqual(runs[0].scene, runs[1].scene);
  assert.deepEqual(runs[0].authority, runs[1].authority);
  assert.deepEqual(runs[0].chainSteps, runs[1].chainSteps);
  assert.deepEqual(runs[0].generationShape, runs[1].generationShape);
});

test('the core domain contains no provider-specific knowledge', () => {
  const coreFiles = fs.readdirSync(path.join(srcDir, 'core')).filter((file) => file.endsWith('.js'));
  for (const file of coreFiles) {
    if (file === 'config.js') continue; // config names env vars by necessity
    const text = fs.readFileSync(path.join(srcDir, 'core', file), 'utf8');
    assert.ok(!/heygen/i.test(text), `${file} must not mention HeyGen`);
    assert.ok(!/api\.heygen\.com/.test(text), `${file} must not know a provider endpoint`);
    assert.ok(!/runway/i.test(text), `${file} must not mention Runway`);
  }
});

test('the browser bundle contains no provider endpoint or credential', () => {
  for (const file of fs.readdirSync(publicDir)) {
    const text = fs.readFileSync(path.join(publicDir, file), 'utf8');
    assert.ok(!/api\.heygen\.com/.test(text), `${file} must not contain a provider endpoint`);
    assert.ok(!/x-api-key/i.test(text), `${file} must not contain a provider credential header`);
    assert.ok(!/HEYGEN_API_KEY\s*[:=]\s*['"][^'"]+['"]/.test(text), `${file} must not contain a credential value`);
  }
});

test('the SceneSpec holds no provider-specific parameters', () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const serialised = JSON.stringify(scene).toLowerCase();
  for (const forbidden of ['heygen', 'avatar_id', 'voice_id', 'dimension', 'runway']) {
    assert.ok(!serialised.includes(forbidden), `SceneSpec must not contain ${forbidden}`);
  }
});
