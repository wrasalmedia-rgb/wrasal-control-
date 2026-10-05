import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IdentityExecutionAdapter, emptyProviderResult } from './identity-execution-adapter.js';
import { ProviderContractError, ProviderExecutionError } from '../core/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = JSON.parse(fs.readFileSync(path.join(here, 'heygen-contract.json'), 'utf8'));

/**
 * §9 HeyGenAdapter.
 *
 * HeyGen is an execution provider. It is NOT the identity authority.
 *
 * Discipline enforced here, deliberately and loudly:
 *   1. No credential  -> ProviderContractError. No fallback to simulation.
 *   2. No verified provider binding (avatar_id/voice_id) -> ProviderContractError.
 *      WRAYVE will not invent a HeyGen-side identity artefact.
 *   3. Live preflight before every real execution. If the declared endpoint does
 *      not answer as declared, execution stops and the mismatch is reported.
 *   4. Response fields that are absent are recorded as UNKNOWN/null and listed
 *      in unresolved_contract_fields. They are never inferred.
 *   5. SceneSpec direction with no confirmed provider parameter is carried
 *      forward as unexecuted intent, not quietly dropped.
 */
export class HeyGenAdapter extends IdentityExecutionAdapter {
  static provider = 'HEYGEN';
  static label = 'HeyGen (external execution provider)';
  static contract = CONTRACT;
  static isExternal = true;
  static isSimulation = false;

  /**
   * @param {object} options
   * @param {string|null} options.apiKey
   * @param {object|null} options.binding  { heygen_avatar_id, heygen_voice_id, background_color? }
   * @param {typeof fetch} [options.fetchImpl]
   * @param {string} [options.baseUrl]
   */
  constructor({ apiKey = null, binding = null, fetchImpl = globalThis.fetch, baseUrl = CONTRACT.base_url } = {}) {
    super();
    this.apiKey = apiKey;
    this.binding = binding;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
  }

  #headers() {
    return { 'x-api-key': this.apiKey, 'content-type': 'application/json' };
  }

  /** Static, offline readiness report. Used by SETTINGS; no network call. */
  readiness() {
    const missing = [];
    if (!this.apiKey) {
      missing.push({
        contract_element: 'credential:HEYGEN_API_KEY',
        status: 'ABSENT',
        detail: 'HEYGEN_API_KEY is not present in the server environment.',
      });
    }
    for (const field of CONTRACT.required_provider_binding) {
      if (!this.binding?.[field]) {
        missing.push({
          contract_element: `provider_binding:${field}`,
          status: 'ABSENT',
          detail: CONTRACT.required_provider_binding_note,
        });
      }
    }
    if (typeof this.fetchImpl !== 'function') {
      missing.push({
        contract_element: 'runtime:fetch',
        status: 'ABSENT',
        detail: 'No HTTP client available in this runtime.',
      });
    }
    return {
      provider: 'HEYGEN',
      ready_for_real_execution: missing.length === 0,
      contract_verification_state: CONTRACT.verification_state,
      missing_contract_elements: missing,
    };
  }

  /**
   * Live validation. Throws ProviderContractError with an itemised list of what
   * is missing — this is the "stop at the adapter boundary and report" path.
   */
  async validate() {
    const readiness = this.readiness();
    if (!readiness.ready_for_real_execution) {
      throw new ProviderContractError(
        'HeyGen execution contract is not available in this environment.',
        {
          provider: 'HEYGEN',
          stage: 'validate',
          missing_contract_elements: readiness.missing_contract_elements,
          remedy: 'Provide HEYGEN_API_KEY server-side and record a verified provider binding, or run this execution in SIMULATION mode (which is labelled as such and is not a HeyGen generation).',
        },
      );
    }

    const endpoint = CONTRACT.endpoints.find((item) => item.id === 'preflight');
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: this.#headers(),
      });
    } catch (cause) {
      throw new ProviderContractError(
        'HeyGen preflight could not be completed; the declared endpoint was unreachable from this environment.',
        { provider: 'HEYGEN', stage: 'preflight', endpoint: `${endpoint.method} ${endpoint.path}`, transport_error: String(cause?.message ?? cause) },
      );
    }

    if (!response.ok) {
      throw new ProviderContractError(
        `HeyGen preflight returned HTTP ${response.status}; the declared contract could not be confirmed.`,
        {
          provider: 'HEYGEN',
          stage: 'preflight',
          endpoint: `${endpoint.method} ${endpoint.path}`,
          http_status: response.status,
          body_excerpt: await safeText(response),
        },
      );
    }

    return {
      ok: true,
      contract: CONTRACT,
      preflight: { endpoint: `${endpoint.method} ${endpoint.path}`, http_status: response.status, confirmed_at: new Date().toISOString() },
    };
  }

  /**
   * Translate WRASAL creative intent into the declared provider payload.
   * Pure; performs no I/O. Anything the contract cannot express is reported,
   * not silently discarded.
   */
  compile(order) {
    if (!this.binding?.heygen_avatar_id || !this.binding?.heygen_voice_id) {
      throw new ProviderContractError(
        'Cannot compile a HeyGen payload: no verified provider binding for this identity snapshot.',
        {
          provider: 'HEYGEN',
          stage: 'compile',
          required: CONTRACT.required_provider_binding,
          note: CONTRACT.required_provider_binding_note,
        },
      );
    }

    if (!order.scene.dialogue || !order.scene.dialogue.trim()) {
      throw new ProviderContractError(
        'Cannot compile a HeyGen payload: the declared contract requires voice.input_text and the SceneSpec has no dialogue.',
        { provider: 'HEYGEN', stage: 'compile', required_field: 'video_inputs[0].voice.input_text' },
      );
    }

    const payload = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: this.binding.heygen_avatar_id,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            input_text: order.scene.dialogue,
            voice_id: this.binding.heygen_voice_id,
          },
          ...(this.binding.background_color
            ? { background: { type: 'color', value: this.binding.background_color } }
            : {}),
        },
      ],
      dimension: { width: 1280, height: 720 },
      title: order.scene.title,
    };

    const carriedButUnexecuted = CONTRACT.unmapped_scene_fields
      .filter((field) => {
        const value = order.scene[field];
        return value !== null && value !== undefined && String(value).trim() !== '';
      })
      .map((field) => ({ scene_field: field, value: order.scene[field], provider_parameter: 'NONE_CONFIRMED' }));

    return { payload, carried_but_unexecuted: carriedButUnexecuted, contract_id: CONTRACT.contract_id };
  }

  async execute(order) {
    const compiled = this.compile(order);
    const endpoint = CONTRACT.endpoints.find((item) => item.id === 'generate');

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: this.#headers(),
        body: JSON.stringify(compiled.payload),
      });
    } catch (cause) {
      throw new ProviderContractError(
        'HeyGen generate endpoint was unreachable from this environment.',
        { provider: 'HEYGEN', stage: 'execute', endpoint: `${endpoint.method} ${endpoint.path}`, transport_error: String(cause?.message ?? cause) },
      );
    }

    const body = await safeJson(response);

    if (!response.ok) {
      throw new ProviderExecutionError(
        `HeyGen rejected the generation request with HTTP ${response.status}.`,
        { provider: 'HEYGEN', stage: 'execute', http_status: response.status, provider_body: body },
      );
    }

    const jobId = body?.data?.video_id ?? null;
    if (!jobId) {
      // The provider answered, but not with the field the contract requires.
      throw new ProviderContractError(
        'HeyGen responded without data.video_id; the declared response contract was not met.',
        {
          provider: 'HEYGEN',
          stage: 'execute',
          expected_field: 'data.video_id',
          provider_body: body,
          note: 'WRAYVE will not synthesise a provider_job_id.',
        },
      );
    }

    return { provider_job_id: jobId, raw: body, compiled };
  }

  async retrieve(handle) {
    const endpoint = CONTRACT.endpoints.find((item) => item.id === 'status');
    const url = `${this.baseUrl}/v1/video_status.get?video_id=${encodeURIComponent(handle.provider_job_id)}`;

    let response;
    try {
      response = await this.fetchImpl(url, { method: endpoint.method, headers: this.#headers() });
    } catch (cause) {
      throw new ProviderContractError(
        'HeyGen status endpoint was unreachable from this environment.',
        { provider: 'HEYGEN', stage: 'retrieve', endpoint: `${endpoint.method} ${endpoint.path}`, transport_error: String(cause?.message ?? cause) },
      );
    }

    const body = await safeJson(response);
    if (!response.ok) {
      throw new ProviderExecutionError(
        `HeyGen status check returned HTTP ${response.status}.`,
        { provider: 'HEYGEN', stage: 'retrieve', http_status: response.status, provider_body: body },
      );
    }
    if (!body?.data?.status) {
      throw new ProviderContractError(
        'HeyGen status response did not contain data.status; the declared response contract was not met.',
        { provider: 'HEYGEN', stage: 'retrieve', expected_field: 'data.status', provider_body: body },
      );
    }
    return body;
  }

  /**
   * Map a provider response onto the canonical result.
   * Absent fields become UNKNOWN/null and are listed. Nothing is inferred.
   */
  normalize(raw, order, context = {}) {
    const result = emptyProviderResult();
    const data = raw?.data ?? {};
    const unresolved = [];

    result.provider_job_id = context.provider_job_id ?? data.video_id ?? null;

    // HeyGen's declared avatar-video response carries no model identifier.
    result.provider_model = data.model ?? 'UNKNOWN';
    result.provider_model_version = data.model_version ?? 'UNKNOWN';
    if (result.provider_model === 'UNKNOWN') unresolved.push('provider_model');
    if (result.provider_model_version === 'UNKNOWN') unresolved.push('provider_model_version');

    result.provider_timestamp = data.created_at ?? data.updated_at ?? null;
    if (result.provider_timestamp === null) unresolved.push('provider_timestamp');

    result.output_reference = data.video_url ?? null;
    if (result.output_reference === null) unresolved.push('output_reference');

    result.output_media_type = data.video_url ? 'video/mp4' : 'UNKNOWN';
    result.output_duration_seconds = typeof data.duration === 'number' ? data.duration : null;
    if (result.output_duration_seconds === null) unresolved.push('output_duration_seconds');

    result.execution_status = mapHeyGenStatus(data.status);
    result.simulated = false;
    result.generation_parameters = context.compiled?.payload ?? null;
    result.raw_provider_payload = raw;
    result.unresolved_contract_fields = unresolved;
    result.carried_but_unexecuted = context.compiled?.carried_but_unexecuted ?? [];
    return result;
  }
}

function mapHeyGenStatus(status) {
  switch (status) {
    case 'completed': return 'COMPLETED';
    case 'failed': return 'FAILED';
    case 'processing':
    case 'pending':
    case 'waiting': return 'IN_PROGRESS';
    default: return 'UNKNOWN';
  }
}

async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function safeText(response) {
  try { return (await response.text()).slice(0, 500); } catch { return null; }
}
