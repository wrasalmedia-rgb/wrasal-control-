import test from 'node:test';
import assert from 'node:assert/strict';

import { makeService, seedWray, blackRoomScene, fakeFetch } from './helpers.mjs';
import { PROVIDER } from '../src/adapters/providers.js';
import { HeyGenAdapter } from '../src/adapters/heygen-adapter.js';
import { ProviderContractError } from '../src/core/errors.js';

/**
 * The constraint that matters most: WRAYVE must stop at the adapter boundary
 * and report a missing contract rather than invent provider behaviour.
 *
 * WRASAL-0013 adds the surface-selection gate to this set.
 */

const BINDING = { heygen_avatar_id: 'avatar_abc', heygen_voice_id: 'voice_abc' };

test('WRASAL-0013 — no API surface selected => PROVIDER_SURFACE_UNVERIFIED, nothing is attempted', async () => {
  const fetchImpl = fakeFetch({});
  const { service } = makeService({ heygen: { apiKey: 'k', binding: BINDING, surface: null, fetchImpl } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);

  assert.equal(result.status, 'FAILED');
  assert.equal(result.failure.code, 'PROVIDER_CONTRACT_UNAVAILABLE');
  assert.equal(result.failure.detail.reason, 'PROVIDER_SURFACE_UNVERIFIED');
  assert.deepEqual(result.failure.detail.available, ['v2_legacy', 'v3']);
  // The refusal happens before any network call is made.
  assert.equal(fetchImpl.calls.length, 0);
});

test('no HEYGEN_API_KEY => contract refusal, not a simulated success', async () => {
  const { service } = makeService({ heygen: { apiKey: null, binding: null, surface: 'v3' } });
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

test('§10 invalid credential => truthful provider authentication failure', async () => {
  const fetchImpl = fakeFetch({
    'GET /v3/users/me': {
      status: 401,
      body: { error: { code: 'unauthorized', message: 'Invalid or expired API key. Verify your x-api-key header.', param: null, doc_url: null } },
    },
  });
  const { service } = makeService({ heygen: { apiKey: 'wrong-key', binding: BINDING, surface: 'v3', fetchImpl } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.failure.stage, 'validate', 'service records the stage it was in');
  assert.equal(result.failure.detail.stage, 'preflight', 'adapter records the precise step that failed');
  assert.equal(result.failure.detail.http_status, 401);
  assert.equal(result.failure.detail.provider_error.code, 'unauthorized');
  // The key never leaves the server-side header, and never lands in provenance.
  assert.ok(!JSON.stringify(result.generation_event).includes('wrong-key'));
});

test('§10 invalid provider binding => truthful provider failure, recorded verbatim', async () => {
  const fetchImpl = fakeFetch({
    'GET /v3/users/me': { status: 200, body: { data: { username: 'acct' } } },
    'POST /v3/videos': {
      status: 400,
      body: { error: { code: 'avatar_not_usable', message: 'This avatar cannot be used because it did not pass content moderation.', param: null, doc_url: null } },
    },
  });
  const { service } = makeService({ heygen: { apiKey: 'k', binding: BINDING, surface: 'v3', fetchImpl } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.failure.code, 'PROVIDER_EXECUTION_FAILED');
  assert.equal(result.failure.detail.provider_error_code, 'avatar_not_usable');
  assert.equal(result.generation_event.execution_status, 'FAILED');
  assert.equal(result.generation_event.provider_job_id, null);
});

test('API key present but no provider binding => PROVIDER_BINDING_REQUIRED, no invented avatar_id', async () => {
  const fetchImpl = fakeFetch({ 'GET /v3/users/me': { status: 200, body: { data: {} } } });
  const { service } = makeService({ heygen: { apiKey: 'k', binding: null, surface: 'v3', fetchImpl } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.failure.code, 'PROVIDER_CONTRACT_UNAVAILABLE');
  assert.equal(result.failure.stage, 'validate');
  assert.match(result.failure.detail.remedy, /SIMULATION/);
  const elements = result.failure.detail.missing_contract_elements.map((item) => item.contract_element);
  assert.ok(elements.includes('provider_binding:heygen_avatar_id'));
});

test('provider answers without the declared required field => contract error, no synthesised job id', async () => {
  const fetchImpl = fakeFetch({
    'GET /v3/users/me': { status: 200, body: { data: {} } },
    'POST /v3/videos': { status: 200, body: { data: { something_else: true } } },
  });
  const { service } = makeService({ heygen: { apiKey: 'k', binding: BINDING, surface: 'v3', fetchImpl } });
  const { snapshot } = seedWray(service);
  const scene = blackRoomScene(service, snapshot.id);
  const request = service.requestExecution({ scene_spec_id: scene.id, provider: PROVIDER.HEYGEN });
  service.approve(request.id);

  const result = await service.execute(request.id);
  assert.equal(result.failure.code, 'PROVIDER_CONTRACT_UNAVAILABLE');
  assert.match(result.failure.detail.expected_field, /data\.video_id/);
  assert.equal(result.generation_event.provider_job_id, null);
});

test('unreachable provider endpoint is reported as a transport-level contract failure', async () => {
  const fetchImpl = async () => { throw new Error('getaddrinfo ENOTFOUND api.heygen.com'); };
  const adapter = new HeyGenAdapter({ apiKey: 'k', binding: BINDING, surface: 'v3', fetchImpl });
  await assert.rejects(() => adapter.validate(), (error) => {
    assert.ok(error instanceof ProviderContractError);
    assert.equal(error.detail.stage, 'preflight');
    assert.match(error.detail.transport_error, /ENOTFOUND/);
    return true;
  });
});

/* ------------------------------------------------- WRASAL-0013 contract shape */

test('WRASAL-0013 — the contract records documentation-only evidence as such, never as VERIFIED', () => {
  const contract = HeyGenAdapter.contract;
  assert.equal(contract.contract_id, 'heygen-execution-contract/v0.2');
  assert.equal(contract.verification_state, 'DOCUMENTED_NOT_OBSERVED');
  assert.equal(contract.live_observation.succeeded, false);
  assert.equal(contract.live_observation.credential_available, false);
  assert.equal(contract.live_observation.network_reachable, false);

  // Nothing anywhere in the artefact may claim live verification.
  const serialised = JSON.stringify(contract);
  assert.ok(!/"status"\s*:\s*"VERIFIED"/.test(serialised), 'no entry may be marked VERIFIED');
  assert.ok(!/"source"\s*:\s*"observed_live_response"/.test(serialised));

  // Every declared endpoint on both surfaces is unconfirmed.
  for (const surface of ['v2_legacy', 'v3']) {
    assert.equal(contract[surface].status, 'DOCUMENTED_NOT_OBSERVED');
    for (const endpoint of contract[surface].endpoints) {
      assert.equal(endpoint.confirmed, false, `${surface} ${endpoint.id} must be unconfirmed`);
      assert.equal(endpoint.source, 'DOCUMENTATION');
    }
  }
});

test('WRASAL-0013 — the legacy surface is recorded as sunset, and v3 as its documented replacement', () => {
  const contract = HeyGenAdapter.contract;
  assert.equal(contract.v2_legacy.lifecycle, 'LEGACY_SUNSET_ANNOUNCED');
  assert.equal(contract.v2_legacy.sunset_date, '2026-10-31');
  assert.equal(contract.v3.lifecycle, 'CURRENT_RECOMMENDED');
  assert.equal(contract.surfaces.selected, null, 'no surface may be pre-selected on documentation alone');
});

test('WRASAL-0013 — HeyGen consent is never equated with WRASAL authority', () => {
  const binding = HeyGenAdapter.contract.identity_binding;
  assert.match(binding.critical_distinction, /NOT equivalent to a WRAYVE IdentitySnapshot/i);
  assert.match(binding.provider_consent_primitive.wrasal_interpretation, /never treat HeyGen consent as satisfying AuthorityCheck/i);
  assert.ok(HeyGenAdapter.contract.fields_wrayve_will_not_infer
    .includes('equivalence between HeyGen consent and WRASAL authority'));

  // avatar_group is the closest analogue but is explicitly not an equivalence.
  const group = binding.provider_object_types.find((item) => item.provider_object_type === 'avatar_group');
  assert.match(group.relationship_to_identity_snapshot, /NOT EQUIVALENT/);
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
