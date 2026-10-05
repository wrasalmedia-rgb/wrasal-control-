import crypto from 'node:crypto';
import { IdentityExecutionAdapter, emptyProviderResult } from './identity-execution-adapter.js';

/**
 * §9/§24 MockExecutionAdapter — SIMULATION MODE.
 *
 * Contacts nothing. Produces a deterministic, visibly-labelled placeholder so
 * the control loop can be exercised without spending provider credits.
 *
 * It must never be mistaken for a real generation:
 *   - provider is recorded as MOCK, not HEYGEN
 *   - simulated = true on the result and on the GenerationEvent
 *   - the rendered artefact itself carries "SIMULATED EXECUTION" on its face
 */
export class MockExecutionAdapter extends IdentityExecutionAdapter {
  static provider = 'MOCK';
  static label = 'WRASAL simulation adapter';
  static isExternal = false;
  static isSimulation = true;

  static contract = {
    provider: 'MOCK',
    verification_state: 'NOT_APPLICABLE',
    description: 'In-process simulation. No external endpoint is contacted.',
    endpoints: [],
    required_response_fields: [],
    credentials: [],
  };

  constructor({ mediaStore } = {}) {
    super();
    this.mediaStore = mediaStore;
  }

  async validate() {
    return {
      ok: true,
      contract: MockExecutionAdapter.contract,
      notes: ['Simulation adapter requires no credentials and makes no network calls.'],
    };
  }

  compile(order) {
    return {
      kind: 'wrasal.simulation.order/v1',
      scene_title: order.scene.title,
      environment: order.scene.environment,
      wardrobe: order.scene.wardrobe,
      performance_direction: order.scene.performance_direction,
      camera_direction: order.scene.camera_direction,
      dialogue: order.scene.dialogue,
      voice_direction: order.scene.voice_direction,
      duration_seconds: order.scene.duration_seconds,
      subject_reference: order.subject.snapshot_id,
    };
  }

  async execute(order) {
    const compiled = this.compile(order);
    const jobId = `SIM-${crypto.createHash('sha256')
      .update(`${order.execution_request_id}:${JSON.stringify(compiled)}`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase()}`;

    return {
      provider_job_id: jobId,
      raw: {
        simulated: true,
        job_id: jobId,
        status: 'completed',
        compiled,
        note: 'No external provider was contacted. This is a WRASAL simulation.',
      },
    };
  }

  async retrieve(handle) {
    return handle.raw;
  }

  normalize(raw, order) {
    const result = emptyProviderResult();
    result.provider_job_id = raw.job_id;
    result.provider_model = 'WRASAL_SIMULATION';
    result.provider_model_version = 'sim-0.1';
    result.provider_timestamp = null; // a simulation has no provider clock
    result.generation_parameters = raw.compiled;
    result.execution_status = 'COMPLETED';
    result.simulated = true;
    result.raw_provider_payload = raw;
    result.output_media_type = 'image/svg+xml';
    result.output_duration_seconds = null;
    result.unresolved_contract_fields = ['provider_timestamp', 'output_duration_seconds'];

    if (this.mediaStore) {
      const asset = this.mediaStore.writeSimulatedPlaceholder({
        execution_request_id: order.execution_request_id,
        job_id: raw.job_id,
        scene_title: order.scene.title,
        identity_label: order.subject.label,
        snapshot_version: order.subject.snapshot_version,
        dialogue: order.scene.dialogue,
      });
      result.output_reference = asset.reference;
    }

    return result;
  }
}
