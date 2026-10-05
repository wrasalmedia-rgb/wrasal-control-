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

test('TEST 07 — real HeyGen execution on the v3 surface records provider=HEYGEN with a non-null provider_job_id', async () => {
  const fetchImpl = fakeFetch({
    'GET /v3/users/me': { status: 200, body: { data: { username: 'acct' } } },
    'POST /v3/videos': { status: 200, body: { data: { video_id: 'v_live_123' } } },
    'GET /v3/videos/': {
      status: 200,
      body: {
        data: {
          id: 'v_live_123',
          status: 'completed',
          video_url: 'https://files.heygen.ai/video/v_live_123.mp4',
          duration: 11.8,
          created_at: 1711929600,
          completed_at: 1711930200,
        },
      },
    },
  });

  const { service } = makeService({
    heygen: {
      apiKey: 'test-key',
      binding: { heygen_avatar_id: 'avatar_abc', heygen_voice_id: 'voice_abc' },
      surface: 'v3',
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
  assert.equal(result.generation_event.provider_job_id, 'v_live_123');
  assert.equal(result.generation_event.simulated, false);
  assert.equal(result.generation_event.provider_surface, 'v3');
  assert.equal(result.generation_event.output_reference, 'https://files.heygen.ai/video/v_live_123.mp4');

  // The documented v3 request body is a discriminated union on `type`.
  const createCall = fetchImpl.calls.find((call) => call.path === '/v3/videos' && call.method === 'POST');
  assert.equal(createCall.body.type, 'avatar');
  assert.equal(createCall.body.avatar_id, 'avatar_abc');
  assert.equal(createCall.body.script, scene.dialogue);
  assert.equal(createCall.headers['x-api-key'], 'test-key');

  // created_at/completed_at are documented as UNIX SECONDS, not ISO strings.
  assert.equal(result.generation_event.provider_timestamp, '2024-04-01T00:10:00.000Z');
  assert.equal(result.generation_event.output_duration_seconds, 11.8);

  // Still UNKNOWN, because no HeyGen response documents a model identifier.
  assert.equal(result.generation_event.provider_model, 'UNKNOWN');
  assert.equal(result.generation_event.provider_model_version, 'UNKNOWN');
  assert.ok(result.generation_event.unresolved_contract_fields.includes('provider_model'));

  // The documented output URL is presigned; WRASAL records that it expires.
  assert.equal(result.generation_event.output_reference_durability, 'PRESIGNED_EXPIRING');

  // Direction the documented contract cannot execute is carried, not dropped.
  const carried = Object.fromEntries(
    result.generation_event.carried_but_unexecuted.map((item) => [item.scene_field, item.classification]),
  );
  assert.equal(carried.camera_direction, 'UNSUPPORTED');
  assert.equal(carried.wardrobe, 'UNSUPPORTED');
  assert.equal(carried.duration_seconds, 'UNSUPPORTED_AS_INPUT');
  assert.equal(carried.performance_direction, 'PARTIALLY_MAPPABLE_UNOBSERVED');
  // dialogue is the one field with a direct documented parameter.
  assert.equal(carried.dialogue, undefined);
});

test('WRASAL-0013 — the legacy v2 surface still works and its deprecation warning is captured verbatim', async () => {
  const fetchImpl = fakeFetch({
    'GET /v2/avatars': { status: 200, body: { data: { avatars: [] } } },
    'POST /v2/video/generate': {
      status: 200,
      headers: { Deprecation: 'true', Sunset: 'Sat, 31 Oct 2026 00:00:00 GMT' },
      body: {
        error: null,
        data: { video_id: 'vid_legacy_1' },
        warning: {
          message: 'This v2 endpoint is Legacy and will be removed on 2026-10-31.',
          v3_endpoint: 'POST /v3/videos',
          docs_url: 'https://developers.heygen.com/reference/create-video',
          sunset_date: '2026-10-31',
        },
      },
    },
    'GET /v1/video_status.get': {
      status: 200,
      body: { data: { status: 'completed', video_url: 'https://files.heygen.ai/legacy.mp4' } },
    },
  });

  const { service } = makeService({
    heygen: {
      apiKey: 'k',
      binding: { heygen_avatar_id: 'a', heygen_voice_id: 'v' },
      surface: 'v2_legacy',
      fetchImpl,
    },
  });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);
  const result = await service.execute(request.id);

  assert.equal(result.status, 'GENERATED');
  assert.equal(result.generation_event.provider_surface, 'v2_legacy');

  // Provider-reported deprecation is recorded as provider fact, not inferred.
  const dep = result.generation_event.provider_deprecation;
  assert.equal(dep.reported_by, 'PROVIDER');
  assert.equal(dep.sunset_header, 'Sat, 31 Oct 2026 00:00:00 GMT');
  assert.equal(dep.warning.v3_endpoint, 'POST /v3/videos');

  // The legacy body shape is still what v2 expects.
  const createCall = fetchImpl.calls.find((call) => call.method === 'POST');
  assert.equal(createCall.body.video_inputs[0].character.avatar_id, 'a');
});

test('TEST 08 — provider failure => FAILED with an auditable failure event', async () => {
  const fetchImpl = fakeFetch({
    'GET /v3/users/me': { status: 200, body: { data: {} } },
    'POST /v3/videos': { status: 500, body: { error: { code: 'internal', message: 'upstream failure' } } },
  });

  const { service } = makeService({
    heygen: { apiKey: 'test-key', binding: { heygen_avatar_id: 'a' }, surface: 'v3', fetchImpl },
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
    'GET /v3/users/me': { status: 200, body: { data: {} } },
    'POST /v3/videos': { status: 200, body: { data: { video_id: 'vid_slow' } } },
    'GET /v3/videos/': { status: 200, body: { data: { status: 'processing' } } },
  });

  const { service } = makeService({
    heygen: { apiKey: 'k', binding: { heygen_avatar_id: 'a' }, surface: 'v3', fetchImpl },
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
