import { EventLog } from './event-log.js';
import { project } from './projection.js';
import { authorityCheck, policySummary } from './authority.js';
import { buildFreebuffPayload, deliverToMockFreebuff } from './freebuff.js';
import { buildArtifactRecord, REFERENCE_CLASS } from './artifact.js';
import {
  AUTHORITY_STATUS,
  BINDING_STATUS,
  EVENT,
  EXECUTION_MODE,
  IDENTITY_STATUS,
  LIFECYCLE,
  SCENE_CONTEXT_KEYS,
  SCENE_STATUS,
  SNAPSHOT_STATUS,
  UNKNOWN,
  VISIBILITY,
  canTransition,
} from './vocabulary.js';
import {
  AuthorityError,
  NotFoundError,
  ProviderContractError,
  ProviderExecutionError,
  StateTransitionError,
  ValidationError,
  WrayveError,
} from './errors.js';

const DEFAULT_POLICY = Object.freeze({
  commercial_allowed: true,
  political_allowed: false,
  sexualized_allowed: false,
  deceptive_context_allowed: false,
  identity_alteration_allowed: false,
  public_distribution_allowed: false,
  approval_required: true,
});

/**
 * WRAYVE application service.
 *
 * Owns: identity, authority, approval, provenance.
 * Knows nothing about any provider beyond "ask the registry for an adapter".
 */
export class WrayveService {
  constructor({ eventLog, registry, mediaStore = null, clock = () => new Date().toISOString() }) {
    this.log = eventLog ?? new EventLog({ clock });
    this.registry = registry;
    this.mediaStore = mediaStore;
    this.clock = clock;
    this.state = project(this.log.all());
    this.counters = this.#rebuildCounters();
  }

  // ---------------------------------------------------------------- internals

  #rebuildCounters() {
    return {
      identity: this.state.identities.size,
      snapshot: this.state.snapshots.size,
      policy: this.state.policies.size,
      scene: this.state.scenes.size,
      request: this.state.requests.size,
      generation: this.state.generationEvents.size,
      media: this.state.media.size,
      handoff: this.state.handoffs.size,
      binding: this.state.bindings.size,
    };
  }

  #nextId(kind, prefix) {
    this.counters[kind] += 1;
    return `${prefix}-${String(this.counters[kind]).padStart(4, '0')}`;
  }

  #emit(type, payload, meta) {
    const record = this.log.append(type, payload, meta);
    this.state = project(this.log.all());
    return record;
  }

  // -------------------------------------------------------------- 01 Identity

  createIdentity({ id = null, canonical_name, actor = 'operator' }) {
    if (!canonical_name || !canonical_name.trim()) {
      throw new ValidationError('canonical_name is required to create an identity');
    }
    const identityId = id?.trim() || this.#nextId('identity', 'IDENTITY');
    if (this.state.identities.has(identityId)) {
      throw new ValidationError(`identity ${identityId} already exists; identities are never overwritten`);
    }
    const now = this.clock();
    const identity = {
      id: identityId,
      canonical_name: canonical_name.trim(),
      status: IDENTITY_STATUS.ACTIVE,
      created_at: now,
      updated_at: now,
    };
    this.#emit(EVENT.IDENTITY_CREATED, { identity }, { actor, subject: identityId });
    return this.state.identities.get(identityId);
  }

  getIdentity(id) {
    const identity = this.state.identities.get(id);
    if (!identity) throw new NotFoundError(`identity ${id} not found`);
    return identity;
  }

  listIdentities() {
    return [...this.state.identities.values()];
  }

  // ------------------------------------------------------- 02 IdentitySnapshot

  /**
   * Snapshots are append-only. Creating a new one marks the previous ACTIVE
   * snapshot SUPERSEDED; its recorded content is never altered.
   */
  createSnapshot({
    identity_id,
    face_reference = null,
    voice_reference = null,
    appearance_profile = '',
    performance_profile = '',
    canonical_notes = '',
    actor = 'operator',
  }) {
    const identity = this.getIdentity(identity_id);
    const siblings = this.snapshotsFor(identity.id);
    const version = `v0.${siblings.length + 1}`;
    const snapshotId = this.#nextId('snapshot', 'SNAP');

    const previousActive = siblings.find((snapshot) => snapshot.status === SNAPSHOT_STATUS.ACTIVE);

    const snapshot = {
      id: snapshotId,
      identity_id: identity.id,
      version,
      face_reference,
      voice_reference,
      appearance_profile,
      performance_profile,
      canonical_notes,
      created_at: this.clock(),
      status: SNAPSHOT_STATUS.ACTIVE,
      supersedes: previousActive?.id ?? null,
    };

    this.#emit(EVENT.SNAPSHOT_CREATED, { snapshot }, { actor, subject: snapshotId });

    if (previousActive) {
      this.#emit(
        EVENT.SNAPSHOT_SUPERSEDED,
        { snapshot_id: previousActive.id, status: SNAPSHOT_STATUS.SUPERSEDED, superseded_by: snapshotId },
        { actor, subject: previousActive.id },
      );
    }

    return this.state.snapshots.get(snapshotId);
  }

  deactivateSnapshot({ snapshot_id, reason = 'operator action', actor = 'operator' }) {
    const snapshot = this.getSnapshot(snapshot_id);
    this.#emit(
      EVENT.SNAPSHOT_DEACTIVATED,
      { snapshot_id: snapshot.id, status: SNAPSHOT_STATUS.INACTIVE, reason },
      { actor, subject: snapshot.id },
    );
    return this.state.snapshots.get(snapshot.id);
  }

  getSnapshot(id) {
    const snapshot = this.state.snapshots.get(id);
    if (!snapshot) throw new NotFoundError(`identity snapshot ${id} not found`);
    return snapshot;
  }

  snapshotsFor(identityId) {
    return [...this.state.snapshots.values()].filter((snapshot) => snapshot.identity_id === identityId);
  }

  activeSnapshotFor(identityId) {
    return this.snapshotsFor(identityId).find((snapshot) => snapshot.status === SNAPSHOT_STATUS.ACTIVE) ?? null;
  }

  // --------------------------------------------------------- 03 LikenessPolicy

  /**
   * Policies are versioned the same way snapshots are: a new policy record is
   * appended, the previous one remains readable forever.
   */
  createPolicy({ identity_snapshot_id, permissions = {}, notes = '', actor = 'operator' }) {
    const snapshot = this.getSnapshot(identity_snapshot_id);
    const merged = { ...DEFAULT_POLICY };
    for (const key of Object.keys(DEFAULT_POLICY)) {
      if (Object.hasOwn(permissions, key)) {
        if (typeof permissions[key] !== 'boolean') {
          throw new ValidationError(`policy field ${key} must be boolean`, { received: permissions[key] });
        }
        merged[key] = permissions[key];
      }
    }
    const unknownKeys = Object.keys(permissions).filter((key) => !Object.hasOwn(DEFAULT_POLICY, key));
    if (unknownKeys.length) {
      throw new ValidationError('unknown likeness policy fields', { unknownKeys });
    }

    const policy = {
      id: this.#nextId('policy', 'POLICY'),
      identity_snapshot_id: snapshot.id,
      ...merged,
      notes,
      created_at: this.clock(),
      supersedes: this.policyFor(snapshot.id)?.id ?? null,
    };
    this.#emit(EVENT.POLICY_CREATED, { policy }, { actor, subject: policy.id });
    return this.state.policies.get(policy.id);
  }

  /** Current policy for a snapshot = most recently appended policy record. */
  policyFor(snapshotId) {
    const matches = [...this.state.policies.values()].filter((policy) => policy.identity_snapshot_id === snapshotId);
    return matches.length ? matches[matches.length - 1] : null;
  }

  policyHistoryFor(snapshotId) {
    return [...this.state.policies.values()].filter((policy) => policy.identity_snapshot_id === snapshotId);
  }

  static defaultPolicy() {
    return { ...DEFAULT_POLICY };
  }

  // ---------------------------------------------------------------- 04 Scene

  createScene({
    identity_snapshot_id,
    title,
    description = '',
    environment = '',
    wardrobe = '',
    performance_direction = '',
    camera_direction = '',
    dialogue = '',
    voice_direction = '',
    duration_seconds = null,
    intended_context = {},
    actor = 'operator',
  }) {
    const snapshot = this.getSnapshot(identity_snapshot_id);
    if (!title || !title.trim()) throw new ValidationError('scene title is required');

    const context = {};
    for (const key of SCENE_CONTEXT_KEYS) context[key] = intended_context[key] === true;
    const unknownContext = Object.keys(intended_context).filter((key) => !SCENE_CONTEXT_KEYS.includes(key));
    if (unknownContext.length) {
      throw new ValidationError('unknown scene context keys', { unknownContext, allowed: SCENE_CONTEXT_KEYS });
    }

    const scene = {
      id: this.#nextId('scene', 'SCENE'),
      identity_snapshot_id: snapshot.id,
      title: title.trim(),
      description,
      environment,
      wardrobe,
      performance_direction,
      camera_direction,
      dialogue,
      voice_direction,
      duration_seconds: duration_seconds === null || duration_seconds === '' ? null : Number(duration_seconds),
      intended_context: context,
      created_at: this.clock(),
      status: SCENE_STATUS.READY,
    };
    this.#emit(EVENT.SCENE_CREATED, { scene }, { actor, subject: scene.id });
    return this.state.scenes.get(scene.id);
  }

  getScene(id) {
    const scene = this.state.scenes.get(id);
    if (!scene) throw new NotFoundError(`scene spec ${id} not found`);
    return scene;
  }

  listScenes() {
    return [...this.state.scenes.values()];
  }

  // ------------------------------------------- WRASAL-0014 ProviderBinding

  /**
   * The formal join between a Representation Identity (IdentitySnapshot) and a
   * Provider Identity (whatever the renderer calls the subject).
   *
   * This exists so that `provider subject id` never has to masquerade as
   * `WRASAL identity`. A binding is DECLARED when an operator asserts it and
   * only becomes VERIFIED when WRASAL has observed the provider confirm it.
   */
  declareProviderBinding({
    identity_snapshot_id,
    provider,
    provider_object_type,
    provider_subject_id,
    label = null,
    actor = 'operator',
  }) {
    const snapshot = this.getSnapshot(identity_snapshot_id);
    if (!provider) throw new ValidationError('provider is required for a provider binding');
    if (!provider_subject_id) {
      throw new ValidationError('provider_subject_id is required; WRAYVE never invents a provider identifier');
    }

    const binding = {
      id: this.#nextId('binding', 'BINDING'),
      identity_snapshot_id: snapshot.id,
      identity_id: snapshot.identity_id,
      provider,
      provider_object_type: provider_object_type ?? UNKNOWN,
      provider_subject_id,
      label,
      binding_status: BINDING_STATUS.DECLARED,
      declared_by: actor,
      declared_at: this.clock(),
      verified_at: null,
      evidence_ref: null,
    };
    this.#emit(EVENT.PROVIDER_BINDING_DECLARED, { binding }, { actor, subject: binding.id });
    return this.state.bindings.get(binding.id);
  }

  /**
   * Promote a binding to VERIFIED. Requires an evidence reference — an
   * assertion alone can never produce a VERIFIED binding.
   */
  verifyProviderBinding(bindingId, { evidence_ref, actor = 'operator' } = {}) {
    const binding = this.getProviderBinding(bindingId);
    if (!evidence_ref) {
      throw new ValidationError(
        'a provider binding cannot be marked VERIFIED without an evidence reference',
        { binding_id: binding.id, required: 'evidence_ref' },
      );
    }
    this.#emit(
      EVENT.PROVIDER_BINDING_VERIFIED,
      { binding_id: binding.id, binding_status: BINDING_STATUS.VERIFIED, evidence_ref },
      { actor, subject: binding.id },
    );
    return this.getProviderBinding(bindingId);
  }

  revokeProviderBinding(bindingId, { reason = '', actor = 'operator' } = {}) {
    const binding = this.getProviderBinding(bindingId);
    this.#emit(
      EVENT.PROVIDER_BINDING_REVOKED,
      { binding_id: binding.id, binding_status: BINDING_STATUS.REVOKED, reason },
      { actor, subject: binding.id },
    );
    return this.getProviderBinding(bindingId);
  }

  getProviderBinding(id) {
    const binding = this.state.bindings.get(id);
    if (!binding) throw new NotFoundError(`provider binding ${id} not found`);
    return binding;
  }

  /** Active binding for a snapshot/provider pair, if any. */
  bindingFor(snapshotId, provider) {
    return [...this.state.bindings.values()].find(
      (binding) => binding.identity_snapshot_id === snapshotId
        && binding.provider === provider
        && binding.binding_status !== BINDING_STATUS.REVOKED,
    ) ?? null;
  }

  listProviderBindings() {
    return [...this.state.bindings.values()];
  }

  // ------------------------------------------------------- 07 ExecutionRequest

  requestExecution({
    scene_spec_id,
    provider,
    mode = EXECUTION_MODE.REAL,
    requested_by = 'operator',
    purpose = '',
  }) {
    const scene = this.getScene(scene_spec_id);
    const snapshot = this.getSnapshot(scene.identity_snapshot_id);

    // No default provider: the caller must name one, and it must be registered.
    if (!provider) {
      throw new ValidationError('provider is required', { registered: this.registry.list() });
    }
    if (!this.registry.has(provider)) {
      throw new ValidationError(`provider ${provider} is not registered`, { registered: this.registry.list() });
    }
    if (!Object.values(EXECUTION_MODE).includes(mode)) {
      throw new ValidationError(`unknown execution mode ${mode}`);
    }

    const request = {
      id: this.#nextId('request', 'EXEC'),
      identity_id: snapshot.identity_id,
      identity_snapshot_id: snapshot.id,
      scene_spec_id: scene.id,
      provider,
      execution_mode: mode,
      purpose,
      requested_by,
      authority_status: AUTHORITY_STATUS.UNCHECKED,
      lifecycle_state: LIFECYCLE.DRAFT,
      created_at: this.clock(),
    };

    this.#emit(EVENT.EXECUTION_REQUESTED, { request }, { actor: requested_by, subject: request.id });

    // Move straight to review: the operator asked for this to be reviewed.
    this.#transition(request.id, LIFECYCLE.READY_FOR_REVIEW, EVENT.AUTHORITY_CHECKED, requested_by, { preview: true });

    return this.getRequest(request.id);
  }

  getRequest(id) {
    const request = this.state.requests.get(id);
    if (!request) throw new NotFoundError(`execution request ${id} not found`);
    return request;
  }

  listRequests() {
    return [...this.state.requests.values()];
  }

  // -------------------------------------------------------- 05 AuthorityCheck

  /** Resolve every governance object an execution request depends on. */
  resolveContext(requestId) {
    const request = this.getRequest(requestId);
    const snapshot = this.state.snapshots.get(request.identity_snapshot_id) ?? null;
    const identity = snapshot ? this.state.identities.get(snapshot.identity_id) ?? null : null;
    const policy = snapshot ? this.policyFor(snapshot.id) : null;
    const scene = this.state.scenes.get(request.scene_spec_id) ?? null;
    return { request, snapshot, identity, policy, scene };
  }

  /**
   * Run and RECORD an authority check.
   * @param {string} requestId
   * @param {object} options { mode, actor, lifecycleTarget }
   */
  runAuthorityCheck(requestId, { mode = null, actor = 'system', lifecycleTarget = null } = {}) {
    const context = this.resolveContext(requestId);
    const effectiveMode = mode ?? context.request.execution_mode ?? EXECUTION_MODE.REAL;
    const check = authorityCheck({ ...context, mode: effectiveMode, clock: this.clock });

    const nextState = lifecycleTarget
      ?? (context.request.lifecycle_state === LIFECYCLE.READY_FOR_REVIEW && check.decision === AUTHORITY_STATUS.AUTHORIZED
        ? LIFECYCLE.PENDING_APPROVAL
        : context.request.lifecycle_state);

    this.#emit(
      EVENT.AUTHORITY_CHECKED,
      { execution_request_id: requestId, check, lifecycle_state: nextState },
      { actor, subject: requestId },
    );
    return { check, request: this.getRequest(requestId) };
  }

  /** §18 EXECUTION REVIEW payload. */
  executionReview(requestId) {
    const context = this.resolveContext(requestId);
    const { check } = { check: authorityCheck({ ...context, mode: context.request.execution_mode, clock: this.clock }) };
    const adapterInfo = this.registry.describe().find((item) => item.provider === context.request.provider) ?? null;

    return {
      request: context.request,
      identity: context.identity,
      snapshot: context.snapshot,
      policy: context.policy,
      scene: context.scene,
      policy_summary: policySummary(context.policy, context.scene),
      authority_preview: check,
      provider: adapterInfo,
      execution_verdict: check.decision === AUTHORITY_STATUS.AUTHORIZED
        ? (context.policy?.approval_required === false ? 'AUTHORIZED' : 'AUTHORIZED AFTER APPROVAL')
        : 'DENIED',
    };
  }

  // ----------------------------------------------------------- 06 ApprovalState

  #transition(requestId, target, eventType, actor, extraPayload = {}) {
    const request = this.getRequest(requestId);
    if (!canTransition(request.lifecycle_state, target)) {
      throw new StateTransitionError(
        `illegal transition ${request.lifecycle_state} -> ${target}`,
        { execution_request_id: requestId, from: request.lifecycle_state, to: target },
      );
    }
    if (eventType === EVENT.AUTHORITY_CHECKED) {
      const context = this.resolveContext(requestId);
      const check = authorityCheck({ ...context, mode: request.execution_mode, clock: this.clock });
      this.#emit(
        EVENT.AUTHORITY_CHECKED,
        { execution_request_id: requestId, check, lifecycle_state: target, ...extraPayload },
        { actor, subject: requestId },
      );
      return this.getRequest(requestId);
    }
    this.#emit(eventType, { execution_request_id: requestId, lifecycle_state: target, ...extraPayload }, { actor, subject: requestId });
    return this.getRequest(requestId);
  }

  submitForApproval(requestId, { actor = 'operator' } = {}) {
    const request = this.getRequest(requestId);
    if (request.lifecycle_state !== LIFECYCLE.READY_FOR_REVIEW) {
      throw new StateTransitionError(
        `request must be READY_FOR_REVIEW to enter approval; it is ${request.lifecycle_state}`,
      );
    }
    return this.runAuthorityCheck(requestId, { actor, lifecycleTarget: LIFECYCLE.PENDING_APPROVAL }).request;
  }

  approve(requestId, { approver = 'operator', note = '' } = {}) {
    const request = this.getRequest(requestId);
    if (request.lifecycle_state === LIFECYCLE.READY_FOR_REVIEW) {
      this.submitForApproval(requestId, { actor: approver });
    }

    // Authority is evaluated before approval can be granted. A denied request
    // can never be approved through the UI or the API.
    const { check } = this.runAuthorityCheck(requestId, { actor: approver });
    const blocking = check.reasons.filter(
      (reason) => reason.result === 'DENY' && reason.rule !== 'APPROVAL_PRESENT',
    );
    if (blocking.length) {
      throw new AuthorityError('authority denied; this request cannot be approved', { reasons: blocking });
    }

    return this.#transition(requestId, LIFECYCLE.APPROVED, EVENT.APPROVAL_GRANTED, approver, { approver, note });
  }

  reject(requestId, { actor = 'operator', reason = '' } = {}) {
    return this.#transition(requestId, LIFECYCLE.REJECTED, EVENT.APPROVAL_REJECTED, actor, { actor, reason });
  }

  cancel(requestId, { actor = 'operator', reason = '' } = {}) {
    return this.#transition(requestId, LIFECYCLE.CANCELLED, EVENT.APPROVAL_REJECTED, actor, { actor, reason });
  }

  // ------------------------------------------------------------- 08-11 Execute

  /**
   * The single execution entry point.
   * The UI cannot reach an adapter any other way.
   */
  async execute(requestId, { actor = 'operator' } = {}) {
    const request = this.getRequest(requestId);
    const mode = request.execution_mode;
    const isSimulation = mode === EXECUTION_MODE.SIMULATION;

    // 1. Authority is re-evaluated server-side immediately before execution.
    const { check } = this.runAuthorityCheck(requestId, { mode, actor });
    if (check.decision !== AUTHORITY_STATUS.AUTHORIZED) {
      throw new AuthorityError('execution refused: AuthorityCheck returned DENIED', {
        execution_request_id: requestId,
        reasons: check.reasons.filter((reason) => reason.result === 'DENY'),
      });
    }

    // 2. Lifecycle gate. APPROVED -> EXECUTING, with one documented exception:
    //    an explicitly marked SIMULATION may run before approval (§10).
    const current = this.getRequest(requestId).lifecycle_state;
    const approvalWaived = current !== LIFECYCLE.APPROVED;
    if (approvalWaived) {
      if (!isSimulation) {
        throw new StateTransitionError(
          `execution refused: approval_status != APPROVED (lifecycle ${current}) and execution is not marked SIMULATION`,
        );
      }
      if (![LIFECYCLE.READY_FOR_REVIEW, LIFECYCLE.PENDING_APPROVAL].includes(current)) {
        throw new StateTransitionError(`execution refused: lifecycle ${current} cannot start an execution`);
      }
    }

    const adapter = this.registry.get(request.provider);
    const adapterCtor = adapter.constructor;

    // A SIMULATION must never be routed to an external provider, and a REAL
    // execution must never be routed to a simulation adapter.
    if (isSimulation && adapterCtor.isExternal) {
      throw new ValidationError(
        `provider ${request.provider} is an external provider and cannot serve a SIMULATION execution; use the MOCK provider`,
      );
    }
    if (!isSimulation && adapterCtor.isSimulation) {
      throw new ValidationError(
        `provider ${request.provider} is a simulation adapter; its output can never be recorded as a real execution`,
      );
    }

    const order = this.#buildOrder(requestId);
    const requestedAt = this.clock();

    this.#emitExecutionStarted(requestId, {
      provider: request.provider,
      mode,
      approval_waived: approvalWaived,
      actor,
    });

    // 3. Adapter boundary. Any contract problem stops here and is reported.
    try {
      await adapter.validate(order);
    } catch (error) {
      return this.#recordFailure(requestId, order, error, { actor, requestedAt, stage: 'validate' });
    }

    let handle;
    try {
      handle = await adapter.execute(order);
    } catch (error) {
      return this.#recordFailure(requestId, order, error, { actor, requestedAt, stage: 'execute' });
    }

    let raw;
    try {
      raw = await adapter.retrieve(handle);
    } catch (error) {
      return this.#recordFailure(requestId, order, error, { actor, requestedAt, stage: 'retrieve' });
    }

    // The handle is opaque to WRASAL. It is forwarded verbatim so that facts the
    // adapter captured at submission time (job id, compiled payload, any
    // provider-reported notice) survive into normalization rather than being
    // silently lost between the two calls.
    const result = adapter.normalize(raw, order, handle);

    if (result.execution_status === 'IN_PROGRESS') {
      // Truthful intermediate state: the job exists, the output does not yet.
      return {
        status: 'IN_PROGRESS',
        request: this.getRequest(requestId),
        provider_job_id: handle.provider_job_id,
        message: `Provider job ${handle.provider_job_id} is still processing. WRAYVE will not report GENERATED until the provider does.`,
      };
    }

    if (result.execution_status !== 'COMPLETED') {
      return this.#recordFailure(
        requestId,
        order,
        new ProviderExecutionError(
          `Provider reported execution_status ${result.execution_status}.`,
          { provider: request.provider, normalized_result: stripRaw(result) },
        ),
        { actor, requestedAt, stage: 'normalize', providerJobId: handle.provider_job_id },
      );
    }

    return this.#recordSuccess(requestId, order, result, { actor, requestedAt });
  }

  #emitExecutionStarted(requestId, { provider, mode, approval_waived, actor }) {
    this.#emit(
      EVENT.EXECUTION_STARTED,
      { execution_request_id: requestId, lifecycle_state: LIFECYCLE.EXECUTING, provider, mode, approval_waived },
      { actor, subject: requestId },
    );
  }

  /** Provider-neutral order. Contains creative intent, never governance state. */
  #buildOrder(requestId) {
    const { request, identity, snapshot, scene } = this.resolveContext(requestId);
    const binding = this.bindingFor(snapshot.id, request.provider);
    return Object.freeze({
      execution_request_id: request.id,
      mode: request.execution_mode,
      // The Provider Identity, carried explicitly and never conflated with the
      // Canonical or Representation Identity above it.
      provider_binding: binding
        ? Object.freeze({
          id: binding.id,
          provider: binding.provider,
          provider_object_type: binding.provider_object_type,
          provider_subject_id: binding.provider_subject_id,
          binding_status: binding.binding_status,
        })
        : null,
      subject: Object.freeze({
        label: identity.canonical_name,
        snapshot_id: snapshot.id,
        snapshot_version: snapshot.version,
        face_reference: snapshot.face_reference,
        voice_reference: snapshot.voice_reference,
        appearance_profile: snapshot.appearance_profile,
        performance_profile: snapshot.performance_profile,
      }),
      scene: Object.freeze({
        id: scene.id,
        title: scene.title,
        description: scene.description,
        environment: scene.environment,
        wardrobe: scene.wardrobe,
        performance_direction: scene.performance_direction,
        camera_direction: scene.camera_direction,
        dialogue: scene.dialogue,
        voice_direction: scene.voice_direction,
        duration_seconds: scene.duration_seconds,
      }),
    });
  }

  // ------------------------------------------------------- 11 GenerationEvent

  #recordSuccess(requestId, order, result, { actor, requestedAt }) {
    const { request, snapshot, scene } = this.resolveContext(requestId);
    const completedAt = this.clock();

    // WRASAL-0014: what WRASAL possesses is computed from the adapter's
    // declared reference class and the evidence ladder — never asserted.
    const artifactInput = result.artifact ?? {
      reference_class: result.output_reference
        ? REFERENCE_CLASS.PROVIDER_REFERENCE
        : REFERENCE_CLASS.ARTIFACT_UNAVAILABLE,
      reference: result.output_reference ?? null,
      media_type: result.output_media_type ?? null,
      content_hash: null,
      expires_at: null,
    };
    const artifact = buildArtifactRecord({
      ...artifactInput,
      evidence: {
        observed_response: true,
        provider_reported_completion: result.execution_status === 'COMPLETED',
      },
    });

    let mediaRecord = null;
    if (result.output_reference) {
      mediaRecord = {
        id: this.#nextId('media', 'MEDIA'),
        execution_request_id: requestId,
        reference: result.output_reference,
        media_type: result.output_media_type,
        visibility: VISIBILITY.PRIVATE,
        simulated: result.simulated,
        artifact,
        created_at: completedAt,
      };
      this.#emit(EVENT.MEDIA_GENERATED, { media: mediaRecord }, { actor, subject: requestId });
    }

    const generationEvent = Object.freeze({
      id: this.#nextId('generation', 'GENEVENT'),
      execution_request_id: requestId,
      identity_id: snapshot.identity_id,
      identity_snapshot_id: snapshot.id,
      scene_spec_id: scene.id,
      provider: request.provider,
      execution_mode: request.execution_mode,
      simulated: result.simulated,
      provider_job_id: result.provider_job_id ?? null,
      provider_model: result.provider_model ?? UNKNOWN,
      provider_model_version: result.provider_model_version ?? UNKNOWN,
      provider_timestamp: result.provider_timestamp ?? null,
      generation_parameters: result.generation_parameters ?? null,
      input_references: {
        face_reference: snapshot.face_reference,
        voice_reference: snapshot.voice_reference,
        scene_spec_id: scene.id,
        dialogue_digest: digest(order.scene.dialogue),
      },
      output_reference: result.output_reference ?? null,
      output_media_id: mediaRecord?.id ?? null,
      output_media_type: result.output_media_type ?? UNKNOWN,
      output_duration_seconds: result.output_duration_seconds ?? null,
      artifact,
      provider_binding: order.provider_binding,
      execution_status: 'COMPLETED',
      // Provider-reported facts, recorded verbatim and never interpreted.
      provider_surface: result.provider_surface ?? UNKNOWN,
      provider_deprecation: result.provider_deprecation ?? null,
      output_reference_durability: result.output_reference_durability ?? UNKNOWN,
      unresolved_contract_fields: result.unresolved_contract_fields ?? [],
      carried_but_unexecuted: result.carried_but_unexecuted ?? [],
      requested_at: requestedAt,
      completed_at: completedAt,
      created_by: actor,
    });

    this.#emit(EVENT.PROVENANCE_RECORDED, { generation_event: generationEvent }, { actor, subject: requestId });
    this.#emit(
      EVENT.EXECUTION_COMPLETED,
      { execution_request_id: requestId, lifecycle_state: LIFECYCLE.GENERATED, generation_event_id: generationEvent.id },
      { actor, subject: requestId },
    );

    return {
      status: 'GENERATED',
      request: this.getRequest(requestId),
      generation_event: generationEvent,
      media: mediaRecord,
    };
  }

  /**
   * Truthful failure. A failure is a first-class, auditable outcome with its own
   * immutable GenerationEvent — not an absence of a record.
   */
  #recordFailure(requestId, order, error, { actor, requestedAt, stage, providerJobId = null }) {
    const { request, snapshot, scene } = this.resolveContext(requestId);
    const completedAt = this.clock();
    const isContract = error instanceof ProviderContractError;

    const failure = {
      stage,
      code: error instanceof WrayveError ? error.code : 'UNEXPECTED_ERROR',
      message: error.message,
      detail: error instanceof WrayveError ? error.detail : null,
      contract_boundary: isContract,
    };

    const generationEvent = Object.freeze({
      id: this.#nextId('generation', 'GENEVENT'),
      execution_request_id: requestId,
      identity_id: snapshot.identity_id,
      identity_snapshot_id: snapshot.id,
      scene_spec_id: scene.id,
      provider: request.provider,
      execution_mode: request.execution_mode,
      simulated: request.execution_mode === EXECUTION_MODE.SIMULATION,
      provider_job_id: providerJobId,
      provider_model: UNKNOWN,
      provider_model_version: UNKNOWN,
      provider_timestamp: null,
      generation_parameters: null,
      input_references: {
        face_reference: snapshot.face_reference,
        voice_reference: snapshot.voice_reference,
        scene_spec_id: scene.id,
        dialogue_digest: digest(order.scene.dialogue),
      },
      output_reference: null,
      output_media_id: null,
      output_media_type: UNKNOWN,
      output_duration_seconds: null,
      artifact: buildArtifactRecord({
        reference_class: REFERENCE_CLASS.ARTIFACT_UNAVAILABLE,
        reference: null,
        evidence: { observed_response: stage !== 'validate' },
      }),
      provider_binding: order.provider_binding,
      execution_status: 'FAILED',
      failure,
      unresolved_contract_fields: [],
      carried_but_unexecuted: [],
      requested_at: requestedAt,
      completed_at: completedAt,
      created_by: actor,
    });

    this.#emit(EVENT.PROVENANCE_RECORDED, { generation_event: generationEvent }, { actor, subject: requestId });
    this.#emit(
      isContract ? EVENT.PROVIDER_CONTRACT_UNAVAILABLE : EVENT.EXECUTION_FAILED,
      {
        execution_request_id: requestId,
        lifecycle_state: LIFECYCLE.FAILED,
        generation_event_id: generationEvent.id,
        failure,
      },
      { actor, subject: requestId },
    );

    return {
      status: 'FAILED',
      request: this.getRequest(requestId),
      generation_event: generationEvent,
      failure,
    };
  }

  getGenerationEvent(id) {
    const event = this.state.generationEvents.get(id);
    if (!event) throw new NotFoundError(`generation event ${id} not found`);
    return event;
  }

  listGenerationEvents() {
    return [...this.state.generationEvents.values()];
  }

  // ------------------------------------------------------------------ Review

  recordReview(requestId, { reviewer = 'operator', verdict = 'ACCEPTED', notes = '' } = {}) {
    if (!['ACCEPTED', 'REJECTED_ON_REVIEW'].includes(verdict)) {
      throw new ValidationError('review verdict must be ACCEPTED or REJECTED_ON_REVIEW');
    }
    return this.#transition(requestId, LIFECYCLE.REVIEWED, EVENT.REVIEW_RECORDED, reviewer, { reviewer, verdict, notes });
  }

  archive(requestId, { actor = 'operator' } = {}) {
    return this.#transition(requestId, LIFECYCLE.ARCHIVED, EVENT.REVIEW_RECORDED, actor, {
      reviewer: actor,
      verdict: 'ARCHIVED',
      notes: '',
    });
  }

  // -------------------------------------------------------------- 12 Provenance

  /** §20: the chain an operator reads to answer "where did this come from?". */
  provenanceChain(generationEventId) {
    const generationEvent = this.getGenerationEvent(generationEventId);
    const request = this.state.requests.get(generationEvent.execution_request_id) ?? null;
    const snapshot = this.state.snapshots.get(generationEvent.identity_snapshot_id) ?? null;
    const identity = this.state.identities.get(generationEvent.identity_id) ?? null;
    const scene = this.state.scenes.get(generationEvent.scene_spec_id) ?? null;
    const policy = snapshot ? this.policyFor(snapshot.id) : null;
    const authority = this.state.authorityChecks.get(generationEvent.execution_request_id) ?? null;
    const media = [...this.state.media.values()].find((item) => item.id === generationEvent.output_media_id) ?? null;
    const handoff = [...this.state.handoffs.values()]
      .find((item) => item.payload.generation_event_id === generationEvent.id) ?? null;

    const events = this.log.forSubject(generationEvent.execution_request_id)
      .map((record) => ({ id: record.id, type: record.type, recorded_at: record.recorded_at, actor: record.actor }));

    return {
      generation_event: generationEvent,
      links: [
        { step: 'IDENTITY', id: identity?.id ?? UNKNOWN, label: identity?.canonical_name ?? UNKNOWN, status: identity?.status ?? UNKNOWN },
        { step: 'SNAPSHOT', id: snapshot?.id ?? UNKNOWN, label: snapshot?.version ?? UNKNOWN, status: snapshot?.status ?? UNKNOWN },
        { step: 'POLICY', id: policy?.id ?? UNKNOWN, label: policy ? `approval_required=${policy.approval_required}` : UNKNOWN, status: policy ? 'BOUND' : UNKNOWN },
        { step: 'SCENE', id: scene?.id ?? UNKNOWN, label: scene?.title ?? UNKNOWN, status: scene?.status ?? UNKNOWN },
        { step: 'AUTHORITY', id: request?.id ?? UNKNOWN, label: authority?.decision ?? UNKNOWN, status: request?.approval_status ?? UNKNOWN },
        { step: 'PROVIDER', id: generationEvent.provider, label: generationEvent.simulated ? 'SIMULATED EXECUTION' : 'REAL EXECUTION', status: generationEvent.execution_status },
        { step: 'GENERATION', id: generationEvent.id, label: generationEvent.provider_job_id ?? UNKNOWN, status: generationEvent.execution_status },
        { step: 'OUTPUT', id: media?.id ?? UNKNOWN, label: generationEvent.output_reference ?? UNKNOWN, status: media?.visibility ?? UNKNOWN },
        { step: 'FREEBUFF', id: handoff?.id ?? 'NOT_CREATED', label: handoff ? handoff.label : 'NO HANDOFF RECORDED', status: handoff ? handoff.mode : UNKNOWN },
      ],
      authority_check: authority,
      events,
      media,
      handoff,
    };
  }

  // --------------------------------------------------------- 13 Freebuff handoff

  createFreebuffHandoff(generationEventId, { actor = 'operator' } = {}) {
    const generationEvent = this.getGenerationEvent(generationEventId);
    if (generationEvent.execution_status !== 'COMPLETED') {
      throw new ValidationError('a Freebuff handoff can only be built from a completed generation event', {
        execution_status: generationEvent.execution_status,
      });
    }

    const chain = this.provenanceChain(generationEventId);
    const payload = buildFreebuffPayload(generationEvent, {
      lineage: chain.links.filter((link) => link.step !== 'FREEBUFF'),
    });
    const delivery = deliverToMockFreebuff(payload, { clock: this.clock });

    const handoff = {
      id: this.#nextId('handoff', 'FBHANDOFF'),
      generation_event_id: generationEvent.id,
      ...delivery,
    };
    this.#emit(EVENT.FREEBUFF_HANDOFF_CREATED, { handoff }, { actor, subject: generationEvent.execution_request_id });
    return this.state.handoffs.get(handoff.id);
  }

  listHandoffs() {
    return [...this.state.handoffs.values()];
  }

  // ------------------------------------------------------------------ Event log

  events({ limit = 500 } = {}) {
    return this.log.all().slice(-limit).reverse();
  }

  integrity() {
    return this.log.verifyChain();
  }
}

function digest(value) {
  // Non-reversible marker so provenance can prove "this exact script" without
  // duplicating the script into every record.
  let hash = 0;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return `fnv-${hash.toString(16)}:${text.length}`;
}

function stripRaw(result) {
  const { raw_provider_payload, ...rest } = result;
  return rest;
}
