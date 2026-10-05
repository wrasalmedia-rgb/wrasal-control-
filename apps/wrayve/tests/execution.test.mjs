import test from 'node:test';
import assert from 'node:assert/strict';

import { makeService, seedWray, blackRoomScene, fakeFetch, jsonResponse } from './helpers.mjs';
import { EXECUTION_MODE } from '../src/core/vocabulary.js';
import { PROVIDER } from '../src/adapters/providers.js';
import { ValidationError } from '../src/core/errors.js';

/**
 * §25 Test scenarios 06–08: execution, provider truthfulness, failure.
 */

test('TEST 06 — simulation execution => SIMULATED, clearly labelled, never HEYGEN', async () => {
  const { service, mediaStore } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({
    scene_spec_id: scene.id,
    provider: PROVIDER.MOCK,
    mode: EXECUTION_MODE.SIMULATION,
  });
  const result = await service.execute(request.id);

  assert.equal(result.status, 'GENERATED');
  assert.equal(result.generation_event.simulated, true);
  assert.equal(result.generation_event.provider, 'MOCK');
  assert.notEqual(result.generation_event.provider, 'HEYGEN');
  assert.equal(result.generation_event.execution_mode, 'SIMULATION');
  assert.match(result.generation_event.provider_job_id, /^SIM-/);
  assert.equal(result.media.visibility, 'PRIVATE');
  assert.equal(mediaStore.written.length, 1);
});

test('a SIMULATION may not be routed to an external provider', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({
    scene_spec_id: scene.id,
    provider: PROVIDER.HEYGEN,
    mode: EXECUTION_MODE.SIMULATION,
  });
  await assert.rejects(() => service.execute(request.id), ValidationError);
});

test('a REAL execution may not be served by the simulation adapter', async () => {
  const { service } = makeService();
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.MOCK, mode: EXECUTION_MODE.REAL });
  service.approve(request.id);
  await assert.rejects(() => service.execute(request.id), ValidationError);
});

test('TEST 07 — real HeyGen execution records provider=HEYGEN with a non-null provider_job_id', async () => {
  const fetchImpl = fakeFetch({
    'GET /v2/avatars': { status: 200, body: { data: { avatars: [] } } },
    'POST /v2/video/generate': { status: 200, body: { error: null, data: { video_id: 'vid_live_123' } } },
    'GET /v1/video_status.get': {
      status: 200,
      body: { data: { status: 'completed', video_url: 'https://files.heygen.ai/vid_live_123.mp4', duration: 11.8 } },
    },
  });

  const { service } = makeService({
    heygen: {
      apiKey: 'test-key',
      binding: { heygen_avatar_id: 'avatar_abc', heygen_voice_id: 'voice_abc' },
      fetchImpl,
    },
  });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id, { approver: 'wray' });
  const result = await service.execute(request.id);

  assert.equal(result.status, 'GENERATED');
  assert.equal(result.generation_event.provider, 'HEYGEN');
  assert.notEqual(result.generation_event.provider_job_id, null);
  assert.equal(result.generation_event.provider_job_id, 'vid_live_123');
  assert.equal(result.generation_event.simulated, false);
  assert.equal(result.generation_event.output_reference, 'https://files.heygen.ai/vid_live_123.mp4');

  // The API key goes out in a server-side header and nowhere else.
  assert.equal(fetchImpl.calls[0].headers['x-api-key'], 'test-key');

  // Fields HeyGen did not return are UNKNOWN/null — never invented.
  assert.equal(result.generation_event.provider_model, 'UNKNOWN');
  assert.equal(result.generation_event.provider_model_version, 'UNKNOWN');
  assert.equal(result.generation_event.provider_timestamp, null);
  assert.ok(result.generation_event.unresolved_contract_fields.includes('provider_model'));

  // Direction the declared contract cannot express is carried, not dropped.
  const carried = result.generation_event.carried_but_unexecuted.map((item) => item.scene_field);
  assert.ok(carried.includes('camera_direction'));
  assert.ok(carried.includes('wardrobe'));
});

test('TEST 08 — provider failure => FAILED with an auditable failure event', async () => {
  const fetchImpl = fakeFetch({
    'GET /v2/avatars': { status: 200, body: { data: { avatars: [] } } },
    'POST /v2/video/generate': { status: 500, body: { error: { code: 'internal', message: 'upstream failure' } } },
  });

  const { service } = makeService({
    heygen: { apiKey: 'test-key', binding: { heygen_avatar_id: 'a', heygen_voice_id: 'v' }, fetchImpl },
  });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);
  const result = await service.execute(request.id);

  assert.equal(result.status, 'FAILED');
  assert.equal(result.generation_event.execution_status, 'FAILED');
  assert.equal(result.generation_event.output_reference, null);
  assert.equal(result.failure.code, 'PROVIDER_EXECUTION_FAILED');
  assert.equal(result.failure.stage, 'execute');
  assert.equal(service.getRequest(request.id).execution_status, 'FAILED');

  const failureEvents = service.log.byType('EXECUTION_FAILED');
  assert.equal(failureEvents.length, 1);
  assert.equal(failureEvents[0].payload.failure.detail.http_status, 500);
});

test('a provider job still processing is reported as IN_PROGRESS, never as GENERATED', async () => {
  const fetchImpl = fakeFetch({
    'GET /v2/avatars': { status: 200, body: { data: {} } },
    'POST /v2/video/generate': { status: 200, body: { data: { video_id: 'vid_slow' } } },
    'GET /v1/video_status.get': { status: 200, body: { data: { status: 'processing' } } },
  });

  const { service } = makeService({
    heygen: { apiKey: 'k', binding: { heygen_avatar_id: 'a', heygen_voice_id: 'v' }, fetchImpl },
  });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.status, 'IN_PROGRESS');
  assert.equal(service.getRequest(request.id).execution_status, 'EXECUTING');
  assert.equal(service.listGenerationEvents().length, 0);
});
