import test from 'node:test';
import assert from 'node:assert/strict';

import { makeService, seedWray, blackRoomScene, fakeFetch } from './helpers.mjs';
import { PROVIDER } from '../src/adapters/providers.js';
import { HeyGenAdapter } from '../src/adapters/heygen-adapter.js';
import { ProviderContractError } from '../src/core/errors.js';

/**
 * The constraint that matters most: WRAYVE must stop at the adapter boundary
 * and report a missing contract rather than invent provider behaviour.
 */

test('no HEYGEN_API_KEY => contract refusal, not a simulated success', async () => {
  const { service } = makeService({ heygen: { apiKey: null, binding: null } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);

  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);
  const result = await service.execute(request.id);

  assert.equal(result.status, 'FAILED');
  assert.equal(result.failure.code, 'PROVIDER_CONTRACT_UNAVAILABLE');
  assert.equal(result.failure.contract_boundary, true);
  assert.equal(result.generation_event.simulated, false, 'a contract failure must never be recorded as a simulation');
  assert.equal(result.generation_event.output_reference, null);

  const elements = result.failure.detail.missing_contract_elements.map((item) => item.contract_element);
  assert.ok(elements.includes('credential:HEYGEN_API_KEY'));
  assert.ok(elements.includes('provider_binding:heygen_avatar_id'));

  assert.equal(service.log.byType('PROVIDER_CONTRACT_UNAVAILABLE').length, 1);
});

test('API key present but no provider binding => still refused, with the reason named', async () => {
  const fetchImpl = fakeFetch({ 'GET /v2/avatars': { status: 200, body: { data: {} } } });
  const { service } = makeService({ heygen: { apiKey: 'k', binding: null, fetchImpl } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.failure.code, 'PROVIDER_CONTRACT_UNAVAILABLE');
  assert.equal(result.failure.stage, 'validate');
  assert.match(result.failure.detail.remedy, /SIMULATION/);
});

test('provider answers without the declared required field => contract error, no synthesised job id', async () => {
  const fetchImpl = fakeFetch({
    'GET /v2/avatars': { status: 200, body: { data: {} } },
    'POST /v2/video/generate': { status: 200, body: { data: { something_else: true } } },
  });
  const { service } = makeService({
    heygen: { apiKey: 'k', binding: { heygen_avatar_id: 'a', heygen_voice_id: 'v' }, fetchImpl },
  });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.failure.code, 'PROVIDER_CONTRACT_UNAVAILABLE');
  assert.equal(result.failure.detail.expected_field, 'data.video_id');
  assert.equal(result.generation_event.provider_job_id, null);
});

test('unreachable provider endpoint is reported as a transport-level contract failure', async () => {
  const fetchImpl = async () => { throw new Error('getaddrinfo ENOTFOUND api.heygen.com'); };
  const adapter = new HeyGenAdapter({
    apiKey: 'k',
    binding: { heygen_avatar_id: 'a', heygen_voice_id: 'v' },
    fetchImpl,
  });
  await assert.rejects(() => adapter.validate(), (error) => {
    assert.ok(error instanceof ProviderContractError);
    assert.equal(error.detail.stage, 'preflight');
    assert.match(error.detail.transport_error, /ENOTFOUND/);
    return true;
  });
});

test('the declared HeyGen contract is marked unverified and names what it will not infer', () => {
  const contract = HeyGenAdapter.contract;
  assert.equal(contract.verification_state, 'UNVERIFIED_IN_THIS_ENVIRONMENT');
  assert.ok(contract.fields_wrayve_will_not_infer.includes('provider_model'));
  assert.ok(contract.endpoints.every((endpoint) => endpoint.confirmed === false));
});

test('Runway has no established contract and refuses rather than guessing an endpoint', async () => {
  const { service } = makeService({ withRunway: true });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.RUNWAY });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.failure.code, 'PROVIDER_CONTRACT_UNAVAILABLE');
  assert.equal(result.generation_event.provider, 'RUNWAY');
  assert.equal(result.generation_event.provider_job_id, null);
});
