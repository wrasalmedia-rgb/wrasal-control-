import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IdentityExecutionAdapter, emptyProviderResult } from './identity-execution-adapter.js';
import { ProviderContractError, ProviderExecutionError } from '../core/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = JSON.parse(fs.readFileSync(path.join(here, 'heygen-contract.json'), 'utf8'));

/**
 * §9 HeyGenAdapter — contract revision v0.2 (work order WRASAL-0013).
 *
 * HeyGen is an execution provider. It is NOT the identity authority.
 *
 * WRASAL-0013 verification outcome: HEYGEN_BLOCKED. No endpoint was observed
 * live (no credential, and egress to every heygen.com host is severed). The
 * contract is therefore DOCUMENTED_NOT_OBSERVED throughout, and this adapter
 * behaves accordingly:
 *
 *   1. It will not pick an API surface on documentation alone. HeyGen documents
 *      v1/v2 as legacy with a 2026-10-31 sunset and v3 as the replacement, but
 *      neither has been observed from here, so an operator must set
 *      HEYGEN_API_SURFACE explicitly. Unset => PROVIDER_SURFACE_UNVERIFIED.
 *   2. No credential or no provider binding => refusal, never simulation.
 *   3. Live preflight before every real execution.
 *   4. Absent response fields become UNKNOWN/null and are listed. Never inferred.
 *   5. A documented request parameter proves only that an instruction can be
 *      EXPRESSED. It is never recorded as EXECUTED without observation.
 *   6. Provider-reported deprecation (headers + `warning` body) is captured
 *      verbatim as provider fact.
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
   * @param {object|null} options.binding  { heygen_avatar_id, heygen_voice_id?, background_color? }
   * @param {string|null} options.surface  'v2_legacy' | 'v3' — must be set explicitly by an operator
   * @param {typeof fetch} [options.fetchImpl]
   * @param {string} [options.baseUrl]
   */
  constructor({
    apiKey = null,
    binding = null,
    surface = null,
    fetchImpl = globalThis.fetch,
    baseUrl = CONTRACT.base_url,
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.binding = binding;
    this.surface = surface;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
  }

  #headers() {
    return { 'x-api-key': this.apiKey, 'content-type': 'application/json' };
  }

  #surfaceSpec() {
    if (!this.surface) {
      throw new ProviderContractError(
        'No HeyGen API surface has been verified or selected for this environment.',
        {
          provider: 'HEYGEN',
          stage: 'surface_selection',
          reason: 'PROVIDER_SURFACE_UNVERIFIED',
          available: CONTRACT.surfaces.available,
          selection_rule: CONTRACT.surfaces.selection_rule,
          documented_lifecycle: {
            v2_legacy: `${CONTRACT.v2_legacy.lifecycle}; sunset ${CONTRACT.v2_legacy.sunset_date}`,
            v3: CONTRACT.v3.lifecycle,
          },
          remedy: 'Set HEYGEN_API_SURFACE=v3 (or v2_legacy) after confirming which surface the account answers on. WRAYVE will not choose on documentation alone.',
        },
      );
    }
    const spec = CONTRACT[this.surface];
    if (!spec) {
      throw new ProviderContractError(`Unknown HeyGen API surface "${this.surface}".`, {
        provider: 'HEYGEN', stage: 'surface_selection', available: CONTRACT.surfaces.available,
      });
    }
    return spec;
  }

  #endpoint(id) {
    const endpoint = this.#surfaceSpec().endpoints.find((item) => item.id === id);
    if (!endpoint) {
      throw new ProviderContractError(
        `HeyGen surface "${this.surface}" declares no "${id}" endpoint.`,
        { provider: 'HEYGEN', stage: 'endpoint_lookup', surface: this.surface, endpoint_id: id },
      );
    }
    return endpoint;
  }

  /** Static, offline readiness report. Used by SETTINGS; no network call. */
  readiness() {
    const missing = [];

    if (!this.surface) {
      missing.push({
        contract_element: 'surface:HEYGEN_API_SURFACE',
        status: 'UNSELECTED',
        detail: `No API surface selected. HeyGen documents v1/v2 as legacy (sunset ${CONTRACT.v2_legacy.sunset_date}) and v3 as the replacement, but neither has been observed from this environment.`,
      });
    }
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
      selected_surface: this.surface,
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
      // Surface selection is the first gate and has its own explicit reason.
      if (!this.surface) this.#surfaceSpec();
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

    const endpoint = this.#endpoint('preflight');
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: this.#headers(),
      });
    } catch (cause) {
      throw new ProviderContractError(
        'HeyGen preflight could not be completed; the declared endpoint was unreachable from this environment.',
        {
          provider: 'HEYGEN',
          stage: 'preflight',
          surface: this.surface,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          transport_error: String(cause?.message ?? cause),
        },
      );
    }

    if (!response.ok) {
      throw new ProviderContractError(
        `HeyGen preflight returned HTTP ${response.status}; the declared contract could not be confirmed.`,
        {
          provider: 'HEYGEN',
          stage: 'preflight',
          surface: this.surface,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          http_status: response.status,
          provider_error: (await safeJson(response))?.error ?? null,
        },
      );
    }

    return {
      ok: true,
      contract: CONTRACT,
      surface: this.surface,
      preflight: {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        http_status: response.status,
        confirmed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Translate WRASAL creative intent into the declared provider payload.
   * Pure; performs no I/O. Anything the contract cannot express is reported,
   * not silently discarded.
   */
  compile(order) {
    const spec = this.#surfaceSpec();

    if (!this.binding?.heygen_avatar_id) {
      throw new ProviderContractError(
        'Cannot compile a HeyGen payload: no verified provider binding for this identity snapshot.',
        {
          provider: 'HEYGEN',
          stage: 'compile',
          reason: 'PROVIDER_BINDING_REQUIRED',
          required: CONTRACT.required_provider_binding,
          note: CONTRACT.required_provider_binding_note,
          identity_binding_warning: CONTRACT.identity_binding.critical_distinction,
        },
      );
    }

    if (!order.scene.dialogue || !order.scene.dialogue.trim()) {
      throw new ProviderContractError(
        'Cannot compile a HeyGen payload: the declared contract requires a script and the SceneSpec has no dialogue.',
        { provider: 'HEYGEN', stage: 'compile', surface: this.surface, required_field: 'script' },
      );
    }

    const payload = this.surface === 'v3'
      ? this.#compileV3(order)
      : this.#compileV2Legacy(order);

    return {
      payload,
      surface: this.surface,
      endpoint: `${this.#endpoint('generate').method} ${this.#endpoint('generate').path}`,
      carried_but_unexecuted: this.#carriedButUnexecuted(order),
      contract_id: CONTRACT.contract_id,
      contract_verification_state: spec.status,
    };
  }

  #compileV3(order) {
    return {
      type: 'avatar',
      avatar_id: this.binding.heygen_avatar_id,
      script: order.scene.dialogue,
      // v3 documents voice_id as optional: the avatar's default voice is used
      // when it is omitted. WRAYVE sends it only when an operator bound one.
      ...(this.binding.heygen_voice_id ? { voice_id: this.binding.heygen_voice_id } : {}),
      ...(this.binding.background_color
        ? { background: { type: 'color', value: this.binding.background_color } }
        : {}),
      title: order.scene.title,
    };
  }

  #compileV2Legacy(order) {
    return {
      video_inputs: [
        {
          character: { type: 'avatar', avatar_id: this.binding.heygen_avatar_id, avatar_style: 'normal' },
          voice: {
            type: 'text',
            input_text: order.scene.dialogue,
            ...(this.binding.heygen_voice_id ? { voice_id: this.binding.heygen_voice_id } : {}),
          },
          ...(this.binding.background_color
            ? { background: { type: 'color', value: this.binding.background_color } }
            : {}),
        },
      ],
      dimension: { width: 1280, height: 720 },
      title: order.scene.title,
    };
  }

  /**
   * Scene direction that the documented contract cannot execute.
   *
   * Driven by the verified contract's scene_field_translation table, so the
   * classification travels with its evidence. Note that even a MAPPABLE field
   * is never asserted to have been EXECUTED — no generation has been observed.
   */
  #carriedButUnexecuted(order) {
    return CONTRACT.scene_field_translation.fields
      .filter((entry) => entry.classification !== 'MAPPABLE_UNOBSERVED')
      .filter((entry) => {
        const value = order.scene[entry.scene_field];
        return value !== null && value !== undefined && String(value).trim() !== '';
      })
      .map((entry) => ({
        scene_field: entry.scene_field,
        value: order.scene[entry.scene_field],
        classification: entry.classification,
        provider_parameter: entry.provider_parameter ?? 'NONE_DOCUMENTED',
        evidence: entry.source_ref,
        note: entry.notes,
      }));
  }

  async execute(order) {
    const compiled = this.compile(order);
    const endpoint = this.#endpoint('generate');

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
        {
          provider: 'HEYGEN',
          stage: 'execute',
          surface: this.surface,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          transport_error: String(cause?.message ?? cause),
        },
      );
    }

    const body = await safeJson(response);
    const deprecation = readDeprecation(response, body);

    if (!response.ok) {
      throw new ProviderExecutionError(
        `HeyGen rejected the generation request with HTTP ${response.status}.`,
        {
          provider: 'HEYGEN',
          stage: 'execute',
          surface: this.surface,
          http_status: response.status,
          provider_error_code: body?.error?.code ?? null,
          provider_error_message: body?.error?.message ?? null,
          provider_body: body,
          provider_deprecation: deprecation,
        },
      );
    }

    // v3 returns data.video_id on create; the detail resource exposes data.id.
    const jobId = body?.data?.video_id ?? body?.data?.id ?? null;
    if (!jobId) {
      throw new ProviderContractError(
        'HeyGen responded without a job identifier; the declared response contract was not met.',
        {
          provider: 'HEYGEN',
          stage: 'execute',
          surface: this.surface,
          expected_field: 'data.video_id (create) or data.id (detail)',
          provider_body: body,
          note: 'WRAYVE will not synthesise a provider_job_id.',
        },
      );
    }

    return { provider_job_id: jobId, raw: body, compiled, provider_deprecation: deprecation };
  }

  async retrieve(handle) {
    const endpoint = this.#endpoint('status');
    const url = this.surface === 'v3'
      ? `${this.baseUrl}/v3/videos/${encodeURIComponent(handle.provider_job_id)}`
      : `${this.baseUrl}/v1/video_status.get?video_id=${encodeURIComponent(handle.provider_job_id)}`;

    let response;
    try {
      response = await this.fetchImpl(url, { method: endpoint.method, headers: this.#headers() });
    } catch (cause) {
      throw new ProviderContractError(
        'HeyGen status endpoint was unreachable from this environment.',
        {
          provider: 'HEYGEN',
          stage: 'retrieve',
          surface: this.surface,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          transport_error: String(cause?.message ?? cause),
        },
      );
    }

    const body = await safeJson(response);
    if (!response.ok) {
      throw new ProviderExecutionError(
        `HeyGen status check returned HTTP ${response.status}.`,
        {
          provider: 'HEYGEN',
          stage: 'retrieve',
          surface: this.surface,
          http_status: response.status,
          provider_error_code: body?.error?.code ?? null,
          provider_body: body,
        },
      );
    }
    if (!body?.data?.status) {
      throw new ProviderContractError(
        'HeyGen status response did not contain data.status; the declared response contract was not met.',
        { provider: 'HEYGEN', stage: 'retrieve', surface: this.surface, expected_field: 'data.status', provider_body: body },
      );
    }
    return { ...body, __deprecation: readDeprecation(response, body) };
  }

  /**
   * Map a provider response onto the canonical result.
   * Absent fields become UNKNOWN/null and are listed. Nothing is inferred.
   */
  normalize(raw, order, context = {}) {
    const result = emptyProviderResult();
    const data = raw?.data ?? {};
    const unresolved = [];

    result.provider_job_id = context.provider_job_id ?? data.video_id ?? data.id ?? null;

    // No HeyGen response schema documents a model identifier. The rendering
    // engine is a REQUEST parameter, not a reported output, so it is recorded
    // as a generation parameter and the model stays UNKNOWN.
    result.provider_model = data.model ?? 'UNKNOWN';
    result.provider_model_version = data.model_version ?? 'UNKNOWN';
    if (result.provider_model === 'UNKNOWN') unresolved.push('provider_model');
    if (result.provider_model_version === 'UNKNOWN') unresolved.push('provider_model_version');

    // v3 documents created_at / completed_at as UNIX SECONDS (integers).
    result.provider_timestamp = unixToIso(data.completed_at) ?? unixToIso(data.created_at) ?? null;
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

    // Provider-reported facts that WRASAL records but does not interpret.
    result.provider_surface = context.compiled?.surface ?? this.surface ?? 'UNKNOWN';
    result.provider_deprecation = context.provider_deprecation ?? raw?.__deprecation ?? null;

    // The documented output URL is PRESIGNED and therefore expiring. Saying so
    // is a fact about the reference, not a claim about the media.
    result.output_reference_durability = data.video_url ? 'PRESIGNED_EXPIRING' : 'UNKNOWN';

    return result;
  }
}

/** VideoStatus enum: pending | processing | completed | failed. Nothing else is mapped. */
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

/** Capture provider-reported deprecation verbatim. Never inferred. */
function readDeprecation(response, body) {
  const header = (name) => {
    try { return response.headers?.get?.(name) ?? null; } catch { return null; }
  };
  const deprecationHeader = header('deprecation');
  const sunsetHeader = header('sunset');
  const warning = body?.warning ?? null;
  if (!deprecationHeader && !sunsetHeader && !warning) return null;
  return {
    reported_by: 'PROVIDER',
    deprecation_header: deprecationHeader,
    sunset_header: sunsetHeader,
    warning,
  };
}

function unixToIso(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}
