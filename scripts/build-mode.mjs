#!/usr/bin/env node
/**
 * WRASAL Build Mode MVP
 *
 * A deliberately small, file-backed implementation of:
 * DEFINE -> SPECIFY -> BUILD -> TEST -> EVIDENCE -> DECIDE
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const BUILD_STATES = Object.freeze([
  'DRAFT',
  'SPECIFIED',
  'BUILDING',
  'TESTING',
  'EVIDENCE_REVIEW',
  'DECIDED',
]);

export const DECISION_STATES = Object.freeze([
  'SHIP',
  'ITERATE',
  'ARCHIVE',
  'ABANDON',
  'BLOCKED',
]);

export const EVIDENCE_CLASSES = Object.freeze([
  'OBSERVED',
  'USER_SUPPLIED',
  'THIRD_PARTY_SUPPORTED',
  'INFERRED',
  'UNVERIFIED',
]);

const SCHEMA_VERSION = 'wrasal-build-mode-v1';
const TEST_RESULTS = new Set(['PENDING', 'PASS', 'FAIL']);
const STATE_INDEX = new Map(BUILD_STATES.map((state, index) => [state, index]));
const NON_ESTABLISHING_EVIDENCE = new Set(['INFERRED', 'UNVERIFIED']);
const EVENT_TYPES = new Set([
  'BUILD_DEFINED',
  'CAPABILITY_DEFERRED',
  'BUILD_SPECIFIED',
  'ARTIFACT_RECORDED',
  'TEST_STARTED',
  'TEST_COMPLETED',
  'EVIDENCE_RECORDED',
  'DECISION_RECORDED',
]);

const LIFECYCLE_EVENTS = [
  {
    type: 'BUILD_DEFINED',
    from: null,
    to: 'DRAFT',
    objectType: 'Build',
    objectId: (record) => record.build?.id,
  },
  {
    type: 'BUILD_SPECIFIED',
    from: 'DRAFT',
    to: 'SPECIFIED',
    objectType: 'Build Spec',
    objectId: (record) => record.build_spec?.id,
  },
  {
    type: 'ARTIFACT_RECORDED',
    from: 'SPECIFIED',
    to: 'BUILDING',
    objectType: 'Artifact',
    objectId: (record) => record.artifact?.id,
  },
  {
    type: 'TEST_STARTED',
    from: 'BUILDING',
    to: 'TESTING',
    objectType: 'Test',
    objectId: (record) => record.test?.id,
  },
  {
    type: 'EVIDENCE_RECORDED',
    from: 'TESTING',
    to: 'EVIDENCE_REVIEW',
    objectType: 'Evidence',
    objectId: (record) => record.evidence?.id,
  },
  {
    type: 'DECISION_RECORDED',
    from: 'EVIDENCE_REVIEW',
    to: 'DECIDED',
    objectType: 'Decision',
    objectId: (record) => record.decision?.id,
  },
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value) {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function now() {
  return new Date().toISOString();
}

function errorListToText(errors) {
  return errors.map((error) => `- ${error}`).join('\n');
}

function assertObjectShape(value, keys, label, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }

  const actual = Object.keys(value);
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  const unexpected = actual.filter((key) => !keys.includes(key));

  if (missing.length > 0) errors.push(`${label} is missing keys: ${missing.join(', ')}`);
  if (unexpected.length > 0) errors.push(`${label} has unsupported keys: ${unexpected.join(', ')}`);
  return missing.length === 0 && unexpected.length === 0;
}

function assertText(value, label, errors) {
  if (!hasText(value)) errors.push(`${label} must be a non-empty string`);
}

function assertNullableText(value, label, errors) {
  if (value !== null && !hasText(value)) errors.push(`${label} must be a non-empty string or null`);
}

function assertTimestamp(value, label, errors) {
  if (!validTimestamp(value)) errors.push(`${label} must be an ISO-compatible timestamp`);
}

function validateBuild(record, errors) {
  if (!assertObjectShape(record.build, ['id', 'target', 'state', 'created_at'], 'build', errors)) return;

  assertText(record.build.id, 'build.id', errors);
  assertText(record.build.target, 'build.target', errors);
  if (!BUILD_STATES.includes(record.build.state)) {
    errors.push(`build.state must be one of: ${BUILD_STATES.join(', ')}`);
  }
  assertTimestamp(record.build.created_at, 'build.created_at', errors);
}

function validateBuildSpec(record, errors) {
  if (record.build_spec === null) return;
  if (!assertObjectShape(
    record.build_spec,
    ['id', 'build_id', 'summary', 'acceptance_criteria'],
    'build_spec',
    errors,
  )) return;

  assertText(record.build_spec.id, 'build_spec.id', errors);
  assertText(record.build_spec.build_id, 'build_spec.build_id', errors);
  assertText(record.build_spec.summary, 'build_spec.summary', errors);
  assertText(record.build_spec.acceptance_criteria, 'build_spec.acceptance_criteria', errors);
  if (record.build?.id && record.build_spec.build_id !== record.build.id) {
    errors.push('build_spec.build_id must match build.id');
  }
}

function safeArtifactAbsolutePath(root, artifactPath) {
  if (!hasText(artifactPath) || path.isAbsolute(artifactPath)) return null;

  const absolute = path.resolve(root, artifactPath);
  const relative = path.relative(root, absolute);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return absolute;
}

function validateArtifact(record, root, errors) {
  if (record.artifact === null) return;
  if (!assertObjectShape(
    record.artifact,
    ['id', 'build_id', 'build_spec_id', 'path', 'description'],
    'artifact',
    errors,
  )) return;

  assertText(record.artifact.id, 'artifact.id', errors);
  assertText(record.artifact.build_id, 'artifact.build_id', errors);
  assertText(record.artifact.build_spec_id, 'artifact.build_spec_id', errors);
  assertText(record.artifact.path, 'artifact.path', errors);
  assertText(record.artifact.description, 'artifact.description', errors);

  if (record.build?.id && record.artifact.build_id !== record.build.id) {
    errors.push('artifact.build_id must match build.id');
  }
  if (record.build_spec?.id && record.artifact.build_spec_id !== record.build_spec.id) {
    errors.push('artifact.build_spec_id must match build_spec.id');
  }

  const artifactPath = safeArtifactAbsolutePath(root, record.artifact.path);
  if (artifactPath === null) {
    errors.push('artifact.path must be a non-empty relative file path inside the repository root');
    return;
  }
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    errors.push(`artifact.path does not resolve to a file: ${record.artifact.path}`);
    return;
  }
  if (fs.readFileSync(artifactPath, 'utf8').trim().length === 0) {
    errors.push(`artifact.path must reference a non-empty file: ${record.artifact.path}`);
  }
}

function validateTest(record, errors) {
  if (record.test === null) return;
  if (!assertObjectShape(
    record.test,
    ['id', 'build_id', 'artifact_id', 'command', 'result', 'exit_code', 'output', 'started_at', 'completed_at'],
    'test',
    errors,
  )) return;

  assertText(record.test.id, 'test.id', errors);
  assertText(record.test.build_id, 'test.build_id', errors);
  assertText(record.test.artifact_id, 'test.artifact_id', errors);
  assertText(record.test.command, 'test.command', errors);
  if (!TEST_RESULTS.has(record.test.result)) {
    errors.push(`test.result must be one of: ${[...TEST_RESULTS].join(', ')}`);
  }
  if (typeof record.test.output !== 'string') errors.push('test.output must be a string');
  assertTimestamp(record.test.started_at, 'test.started_at', errors);

  if (record.build?.id && record.test.build_id !== record.build.id) {
    errors.push('test.build_id must match build.id');
  }
  if (record.artifact?.id && record.test.artifact_id !== record.artifact.id) {
    errors.push('test.artifact_id must match artifact.id');
  }

  if (record.test.result === 'PENDING') {
    if (record.test.exit_code !== null) errors.push('test.exit_code must be null while test.result is PENDING');
    if (record.test.completed_at !== null) errors.push('test.completed_at must be null while test.result is PENDING');
    return;
  }

  if (record.test.exit_code !== null && !Number.isInteger(record.test.exit_code)) {
    errors.push('test.exit_code must be an integer or null');
  }
  assertTimestamp(record.test.completed_at, 'test.completed_at', errors);
  if (record.test.result === 'PASS' && record.test.exit_code !== 0) {
    errors.push('test.exit_code must be 0 when test.result is PASS');
  }
  if (record.test.result === 'FAIL' && record.test.exit_code === 0) {
    errors.push('test.exit_code must not be 0 when test.result is FAIL');
  }
}

export function evidenceRoute(evidenceClass) {
  return NON_ESTABLISHING_EVIDENCE.has(evidenceClass) ? 'NON_ESTABLISHING' : 'REVIEWABLE';
}

function validateEvidence(record, errors) {
  if (record.evidence === null) return;
  if (!assertObjectShape(
    record.evidence,
    ['id', 'build_id', 'test_id', 'evidence_class', 'claim', 'source', 'route', 'recorded_at'],
    'evidence',
    errors,
  )) return;

  assertText(record.evidence.id, 'evidence.id', errors);
  assertText(record.evidence.build_id, 'evidence.build_id', errors);
  assertText(record.evidence.test_id, 'evidence.test_id', errors);
  if (!EVIDENCE_CLASSES.includes(record.evidence.evidence_class)) {
    errors.push(`evidence.evidence_class must be one of: ${EVIDENCE_CLASSES.join(', ')}`);
  }
  assertText(record.evidence.claim, 'evidence.claim', errors);
  assertText(record.evidence.source, 'evidence.source', errors);
  assertTimestamp(record.evidence.recorded_at, 'evidence.recorded_at', errors);

  if (record.build?.id && record.evidence.build_id !== record.build.id) {
    errors.push('evidence.build_id must match build.id');
  }
  if (record.test?.id && record.evidence.test_id !== record.test.id) {
    errors.push('evidence.test_id must match test.id');
  }

  const expectedRoute = evidenceRoute(record.evidence.evidence_class);
  if (record.evidence.route !== expectedRoute) {
    errors.push(`evidence.route must be ${expectedRoute} for ${record.evidence.evidence_class} evidence`);
  }
}

function validateDecision(record, errors) {
  if (record.decision === null) return;
  if (!assertObjectShape(
    record.decision,
    ['id', 'build_id', 'state', 'rationale', 'evidence_id', 'established_evidence_id', 'recorded_at'],
    'decision',
    errors,
  )) return;

  assertText(record.decision.id, 'decision.id', errors);
  assertText(record.decision.build_id, 'decision.build_id', errors);
  if (!DECISION_STATES.includes(record.decision.state)) {
    errors.push(`decision.state must be one of: ${DECISION_STATES.join(', ')}`);
  }
  assertText(record.decision.rationale, 'decision.rationale', errors);
  assertText(record.decision.evidence_id, 'decision.evidence_id', errors);
  assertNullableText(record.decision.established_evidence_id, 'decision.established_evidence_id', errors);
  assertTimestamp(record.decision.recorded_at, 'decision.recorded_at', errors);

  if (record.build?.id && record.decision.build_id !== record.build.id) {
    errors.push('decision.build_id must match build.id');
  }
  if (record.evidence?.id && record.decision.evidence_id !== record.evidence.id) {
    errors.push('decision.evidence_id must match evidence.id');
  }
  if (
    record.decision.established_evidence_id !== null
    && record.evidence?.id
    && record.decision.established_evidence_id !== record.evidence.id
  ) {
    errors.push('decision.established_evidence_id must match evidence.id or be null');
  }

  if (record.decision.established_evidence_id !== null && record.evidence) {
    if (NON_ESTABLISHING_EVIDENCE.has(record.evidence.evidence_class)) {
      errors.push(
        `decision.established_evidence_id may not promote ${record.evidence.evidence_class} evidence as established reality`,
      );
    }
    if (record.evidence.route === 'NON_ESTABLISHING') {
      errors.push('decision.established_evidence_id may not promote NON_ESTABLISHING evidence as established reality');
    }
  }

  if (record.decision.state === 'SHIP') {
    if (record.test?.result !== 'PASS') {
      errors.push('decision.state SHIP requires a passing test result');
    }
    if (record.decision.established_evidence_id === null) {
      errors.push('decision.state SHIP requires an eligible established_evidence_id');
    }
  }
}

function validateDeferredCapabilities(record, errors) {
  if (!Array.isArray(record.deferred_capabilities)) {
    errors.push('deferred_capabilities must be an array');
    return;
  }

  const ids = new Set();
  record.deferred_capabilities.forEach((capability, index) => {
    const label = `deferred_capabilities[${index}]`;
    if (!assertObjectShape(capability, ['id', 'description', 'reason', 'disposition', 'recorded_at'], label, errors)) return;

    assertText(capability.id, `${label}.id`, errors);
    assertText(capability.description, `${label}.description`, errors);
    assertText(capability.reason, `${label}.reason`, errors);
    if (capability.disposition !== 'DEFERRED') {
      errors.push(`${label}.disposition must be DEFERRED`);
    }
    assertTimestamp(capability.recorded_at, `${label}.recorded_at`, errors);
    if (ids.has(capability.id)) errors.push(`${label}.id must be unique`);
    ids.add(capability.id);
  });
}

function validateStageObjects(record, errors) {
  const stateIndex = STATE_INDEX.get(record.build?.state);
  if (stateIndex === undefined) return;

  const stagedObjects = [
    ['build_spec', 1, 'SPECIFIED'],
    ['artifact', 2, 'BUILDING'],
    ['test', 3, 'TESTING'],
    ['evidence', 4, 'EVIDENCE_REVIEW'],
    ['decision', 5, 'DECIDED'],
  ];

  for (const [key, requiredAt, state] of stagedObjects) {
    const shouldExist = stateIndex >= requiredAt;
    if (shouldExist && record[key] === null) {
      errors.push(`${key} is required once build.state is ${state} or later`);
    }
    if (!shouldExist && record[key] !== null) {
      errors.push(`${key} must be null before build.state is ${state}`);
    }
  }

  if (stateIndex > STATE_INDEX.get('TESTING') && record.test?.result === 'PENDING') {
    errors.push('test.result must not remain PENDING after TESTING');
  }
}

function validateEvents(record, errors) {
  if (!Array.isArray(record.events)) {
    errors.push('events must be an array');
    return;
  }

  const eventIds = new Set();
  const deferredEventIds = [];
  let lastTime = null;
  let currentState = null;
  let lifecycleIndex = 0;
  let testCompletedCount = 0;

  record.events.forEach((event, index) => {
    const label = `events[${index}]`;
    if (!assertObjectShape(
      event,
      ['id', 'sequence', 'at', 'type', 'from_state', 'to_state', 'object_type', 'object_id', 'detail'],
      label,
      errors,
    )) return;

    assertText(event.id, `${label}.id`, errors);
    if (eventIds.has(event.id)) errors.push(`${label}.id must be unique`);
    eventIds.add(event.id);
    if (event.sequence !== index + 1) errors.push(`${label}.sequence must be ${index + 1}`);
    assertTimestamp(event.at, `${label}.at`, errors);
    if (validTimestamp(event.at)) {
      const eventTime = Date.parse(event.at);
      if (lastTime !== null && eventTime < lastTime) {
        errors.push(`${label}.at must not be earlier than the preceding event`);
      }
      lastTime = eventTime;
    }
    if (!EVENT_TYPES.has(event.type)) {
      errors.push(`${label}.type must be one of: ${[...EVENT_TYPES].join(', ')}`);
      return;
    }
    if (event.from_state !== null && !BUILD_STATES.includes(event.from_state)) {
      errors.push(`${label}.from_state must be a build state or null`);
    }
    if (!BUILD_STATES.includes(event.to_state)) {
      errors.push(`${label}.to_state must be a build state`);
    }
    assertText(event.object_type, `${label}.object_type`, errors);
    assertText(event.object_id, `${label}.object_id`, errors);
    assertText(event.detail, `${label}.detail`, errors);

    if (event.type === 'CAPABILITY_DEFERRED') {
      if (currentState === null) errors.push(`${label} cannot defer a capability before BUILD_DEFINED`);
      if (event.from_state !== currentState || event.to_state !== currentState) {
        errors.push(`${label} must preserve the current build state`);
      }
      if (event.object_type !== 'Deferred Capability') {
        errors.push(`${label}.object_type must be Deferred Capability`);
      }
      deferredEventIds.push(event.object_id);
      return;
    }

    if (event.type === 'TEST_COMPLETED') {
      if (currentState !== 'TESTING' || event.from_state !== 'TESTING' || event.to_state !== 'TESTING') {
        errors.push(`${label} must occur within TESTING`);
      }
      if (event.object_type !== 'Test' || event.object_id !== record.test?.id) {
        errors.push(`${label} must identify the recorded Test object`);
      }
      testCompletedCount += 1;
      return;
    }

    const expected = LIFECYCLE_EVENTS[lifecycleIndex];
    if (!expected) {
      errors.push(`${label}.type ${event.type} is not valid after the complete lifecycle`);
      return;
    }
    if (event.type !== expected.type) {
      errors.push(`${label}.type must be ${expected.type} at this point in the core loop`);
    }
    if (event.from_state !== expected.from || event.to_state !== expected.to) {
      errors.push(`${label} must transition ${String(expected.from)} to ${expected.to}`);
    }
    if (event.object_type !== expected.objectType || event.object_id !== expected.objectId(record)) {
      errors.push(`${label} must identify ${expected.objectType} ${expected.objectId(record)}`);
    }
    if (currentState !== expected.from) {
      errors.push(`${label} does not continue from the prior lifecycle state`);
    }
    currentState = expected.to;
    lifecycleIndex += 1;
  });

  const stateIndex = STATE_INDEX.get(record.build?.state);
  if (stateIndex !== undefined) {
    const requiredLifecycleEvents = stateIndex + 1;
    if (lifecycleIndex !== requiredLifecycleEvents) {
      errors.push(`event history must contain ${requiredLifecycleEvents} lifecycle event(s) for build.state ${record.build.state}`);
    }
    if (currentState !== record.build.state) {
      errors.push('event history final state must match build.state');
    }
  }

  const expectedDeferredIds = Array.isArray(record.deferred_capabilities)
    ? record.deferred_capabilities.map((capability) => capability.id)
    : [];
  if (deferredEventIds.length !== expectedDeferredIds.length) {
    errors.push('each deferred capability must have one CAPABILITY_DEFERRED event');
  }
  for (const capabilityId of expectedDeferredIds) {
    if (deferredEventIds.filter((eventId) => eventId === capabilityId).length !== 1) {
      errors.push(`deferred capability ${capabilityId} must have exactly one CAPABILITY_DEFERRED event`);
    }
  }

  if (record.test) {
    const expectedCompletions = record.test.result === 'PENDING' ? 0 : 1;
    if (testCompletedCount !== expectedCompletions) {
      errors.push(`test.result ${record.test.result} requires ${expectedCompletions} TEST_COMPLETED event(s)`);
    }
  } else if (testCompletedCount !== 0) {
    errors.push('TEST_COMPLETED cannot exist without a Test object');
  }
}

/**
 * Validate an entire Build Mode record without changing it.
 *
 * The returned errors are deliberately plain strings so the CLI and tests can
 * preserve a compact, inspectable audit surface.
 */
export function validateBuildRecord(record, { root = process.cwd() } = {}) {
  const errors = [];

  if (!assertObjectShape(
    record,
    [
      'schema_version',
      'build',
      'build_spec',
      'artifact',
      'test',
      'evidence',
      'decision',
      'deferred_capabilities',
      'events',
    ],
    'build record',
    errors,
  )) {
    return { valid: false, errors };
  }

  if (record.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }

  validateBuild(record, errors);
  validateBuildSpec(record, errors);
  validateArtifact(record, root, errors);
  validateTest(record, errors);
  validateEvidence(record, errors);
  validateDecision(record, errors);
  validateDeferredCapabilities(record, errors);
  validateStageObjects(record, errors);
  validateEvents(record, errors);

  return { valid: errors.length === 0, errors };
}

function readRecord(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`build record does not exist: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`could not parse build record ${filePath}: ${error.message}`);
  }
}

function writeRecord(filePath, record) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

function validateOrThrow(record, root) {
  const result = validateBuildRecord(record, { root });
  if (!result.valid) throw new Error(`Build Mode validation failed:\n${errorListToText(result.errors)}`);
}

function appendEvent(record, type, fromState, toState, objectType, objectId, detail) {
  const sequence = record.events.length + 1;
  record.events.push({
    id: `${record.build.id}-EVENT-${String(sequence).padStart(3, '0')}`,
    sequence,
    at: now(),
    type,
    from_state: fromState,
    to_state: toState,
    object_type: objectType,
    object_id: objectId,
    detail,
  });
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = args[index + 1];
    if (!key || value === undefined || value.startsWith('--')) {
      throw new Error(`Option ${arg} requires a value`);
    }
    if (Object.hasOwn(options, key)) throw new Error(`Option ${arg} was supplied more than once`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function assertAllowedOptions(options, allowed) {
  const unexpected = Object.keys(options).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`Unsupported option(s): ${unexpected.map((key) => `--${key}`).join(', ')}`);
}

function requiredOption(options, key) {
  const value = options[key];
  if (!hasText(value)) throw new Error(`--${key} is required`);
  return value.trim();
}

function resolveRecordPath(options) {
  return path.resolve(process.cwd(), requiredOption(options, 'file'));
}

function ensureState(record, expected, command) {
  if (record.build?.state !== expected) {
    throw new Error(`${command} requires state ${expected}; current state is ${record.build?.state ?? 'unknown'}`);
  }
}

function repositoryRelativeArtifactPath(artifactPath) {
  const root = process.cwd();
  if (path.isAbsolute(artifactPath)) throw new Error('--path must be relative to the repository root');

  const absolute = safeArtifactAbsolutePath(root, artifactPath);
  if (absolute === null) throw new Error('--path must stay inside the repository root');
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`artifact file does not exist: ${artifactPath}`);
  }
  if (fs.readFileSync(absolute, 'utf8').trim().length === 0) {
    throw new Error(`artifact file must not be empty: ${artifactPath}`);
  }
  return path.relative(root, absolute).split(path.sep).join('/');
}

function commandDefine(options) {
  assertAllowedOptions(options, ['file', 'build-id', 'target']);
  const filePath = resolveRecordPath(options);
  if (fs.existsSync(filePath)) throw new Error(`refusing to overwrite existing build record: ${filePath}`);

  const createdAt = now();
  const record = {
    schema_version: SCHEMA_VERSION,
    build: {
      id: requiredOption(options, 'build-id'),
      target: requiredOption(options, 'target'),
      state: 'DRAFT',
      created_at: createdAt,
    },
    build_spec: null,
    artifact: null,
    test: null,
    evidence: null,
    decision: null,
    deferred_capabilities: [],
    events: [],
  };
  appendEvent(record, 'BUILD_DEFINED', null, 'DRAFT', 'Build', record.build.id, 'Build target defined.');
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);
  console.log(`DEFINED ${record.build.id} (DRAFT)`);
  return 0;
}

function commandSpecify(options) {
  assertAllowedOptions(options, ['file', 'spec-id', 'summary', 'acceptance']);
  const filePath = resolveRecordPath(options);
  const record = readRecord(filePath);
  ensureState(record, 'DRAFT', 'specify');
  if (record.build_spec !== null) throw new Error('build_spec already exists');

  record.build_spec = {
    id: requiredOption(options, 'spec-id'),
    build_id: record.build.id,
    summary: requiredOption(options, 'summary'),
    acceptance_criteria: requiredOption(options, 'acceptance'),
  };
  record.build.state = 'SPECIFIED';
  appendEvent(
    record,
    'BUILD_SPECIFIED',
    'DRAFT',
    'SPECIFIED',
    'Build Spec',
    record.build_spec.id,
    'Build specification recorded.',
  );
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);
  console.log(`SPECIFIED ${record.build.id}`);
  return 0;
}

function commandBuild(options) {
  assertAllowedOptions(options, ['file', 'artifact-id', 'path', 'description']);
  const filePath = resolveRecordPath(options);
  const record = readRecord(filePath);
  ensureState(record, 'SPECIFIED', 'build');
  if (record.artifact !== null) throw new Error('artifact already exists');

  record.artifact = {
    id: requiredOption(options, 'artifact-id'),
    build_id: record.build.id,
    build_spec_id: record.build_spec.id,
    path: repositoryRelativeArtifactPath(requiredOption(options, 'path')),
    description: requiredOption(options, 'description'),
  };
  record.build.state = 'BUILDING';
  appendEvent(
    record,
    'ARTIFACT_RECORDED',
    'SPECIFIED',
    'BUILDING',
    'Artifact',
    record.artifact.id,
    'Artifact recorded for the build.',
  );
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);
  console.log(`BUILT ${record.build.id}`);
  return 0;
}

function testOutput(execution) {
  const output = `${execution.stdout ?? ''}${execution.stderr ?? ''}${execution.error ? `${execution.error.message}\n` : ''}`;
  const limit = 4000;
  return output.length <= limit ? output : `${output.slice(0, limit)}\n[output truncated]`;
}

function commandTest(options) {
  assertAllowedOptions(options, ['file', 'test-id', 'artifact-id', 'command']);
  const filePath = resolveRecordPath(options);
  const record = readRecord(filePath);
  ensureState(record, 'BUILDING', 'test');
  if (record.test !== null) throw new Error('test already exists');
  const artifactId = requiredOption(options, 'artifact-id');
  if (artifactId !== record.artifact?.id) throw new Error('--artifact-id must identify the recorded artifact');

  record.test = {
    id: requiredOption(options, 'test-id'),
    build_id: record.build.id,
    artifact_id: artifactId,
    command: requiredOption(options, 'command'),
    result: 'PENDING',
    exit_code: null,
    output: '',
    started_at: now(),
    completed_at: null,
  };
  record.build.state = 'TESTING';
  appendEvent(
    record,
    'TEST_STARTED',
    'BUILDING',
    'TESTING',
    'Test',
    record.test.id,
    'Test command started.',
  );
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);

  const execution = spawnSync(record.test.command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    maxBuffer: 1024 * 1024,
  });
  record.test.result = execution.status === 0 ? 'PASS' : 'FAIL';
  record.test.exit_code = Number.isInteger(execution.status) ? execution.status : null;
  record.test.output = testOutput(execution);
  record.test.completed_at = now();
  appendEvent(
    record,
    'TEST_COMPLETED',
    'TESTING',
    'TESTING',
    'Test',
    record.test.id,
    `Test command completed with result ${record.test.result}.`,
  );
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);
  console.log(`TESTED ${record.build.id}: ${record.test.result}`);

  if (record.test.result !== 'PASS') {
    console.error(record.test.output || 'Test command failed without output.');
    return 1;
  }
  return 0;
}

function commandEvidence(options) {
  assertAllowedOptions(options, ['file', 'evidence-id', 'class', 'claim', 'source']);
  const filePath = resolveRecordPath(options);
  const record = readRecord(filePath);
  ensureState(record, 'TESTING', 'evidence');
  if (record.test?.result === 'PENDING') throw new Error('evidence requires a completed test');
  if (record.evidence !== null) throw new Error('evidence already exists');
  const evidenceClass = requiredOption(options, 'class');
  if (!EVIDENCE_CLASSES.includes(evidenceClass)) {
    throw new Error(`--class must be one of: ${EVIDENCE_CLASSES.join(', ')}`);
  }

  record.evidence = {
    id: requiredOption(options, 'evidence-id'),
    build_id: record.build.id,
    test_id: record.test.id,
    evidence_class: evidenceClass,
    claim: requiredOption(options, 'claim'),
    source: requiredOption(options, 'source'),
    route: evidenceRoute(evidenceClass),
    recorded_at: now(),
  };
  record.build.state = 'EVIDENCE_REVIEW';
  appendEvent(
    record,
    'EVIDENCE_RECORDED',
    'TESTING',
    'EVIDENCE_REVIEW',
    'Evidence',
    record.evidence.id,
    `Evidence classified as ${evidenceClass} and routed as ${record.evidence.route}.`,
  );
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);
  console.log(`EVIDENCE RECORDED ${record.build.id}: ${evidenceClass}`);
  return 0;
}

function commandDecide(options) {
  assertAllowedOptions(options, ['file', 'decision-id', 'state', 'rationale', 'established-evidence-id']);
  const filePath = resolveRecordPath(options);
  const record = readRecord(filePath);
  ensureState(record, 'EVIDENCE_REVIEW', 'decide');
  if (record.decision !== null) throw new Error('decision already exists');
  const decisionState = requiredOption(options, 'state');
  if (!DECISION_STATES.includes(decisionState)) {
    throw new Error(`--state must be one of: ${DECISION_STATES.join(', ')}`);
  }

  record.decision = {
    id: requiredOption(options, 'decision-id'),
    build_id: record.build.id,
    state: decisionState,
    rationale: requiredOption(options, 'rationale'),
    evidence_id: record.evidence.id,
    established_evidence_id: options['established-evidence-id']?.trim() || null,
    recorded_at: now(),
  };
  record.build.state = 'DECIDED';
  appendEvent(
    record,
    'DECISION_RECORDED',
    'EVIDENCE_REVIEW',
    'DECIDED',
    'Decision',
    record.decision.id,
    `Decision recorded: ${decisionState}.`,
  );
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);
  console.log(`DECIDED ${record.build.id}: ${decisionState}`);
  return 0;
}

function commandDefer(options) {
  assertAllowedOptions(options, ['file', 'capability-id', 'description', 'reason']);
  const filePath = resolveRecordPath(options);
  const record = readRecord(filePath);
  if (!BUILD_STATES.includes(record.build?.state)) throw new Error('defer requires a valid build record state');
  const capabilityId = requiredOption(options, 'capability-id');
  if (record.deferred_capabilities.some((capability) => capability.id === capabilityId)) {
    throw new Error(`deferred capability already exists: ${capabilityId}`);
  }

  record.deferred_capabilities.push({
    id: capabilityId,
    description: requiredOption(options, 'description'),
    reason: requiredOption(options, 'reason'),
    disposition: 'DEFERRED',
    recorded_at: now(),
  });
  appendEvent(
    record,
    'CAPABILITY_DEFERRED',
    record.build.state,
    record.build.state,
    'Deferred Capability',
    capabilityId,
    'Non-core capability recorded as DEFERRED rather than implemented.',
  );
  validateOrThrow(record, process.cwd());
  writeRecord(filePath, record);
  console.log(`DEFERRED ${capabilityId}`);
  return 0;
}

function commandValidate(options) {
  assertAllowedOptions(options, ['file']);
  const filePath = resolveRecordPath(options);
  const record = readRecord(filePath);
  const result = validateBuildRecord(record, { root: process.cwd() });
  if (!result.valid) {
    console.error(`FAIL ${record.build?.id ?? path.basename(filePath)} validation\n${errorListToText(result.errors)}`);
    return 1;
  }
  console.log(`PASS ${record.build.id} validation (${record.build.state})`);
  return 0;
}

function printHelp() {
  console.log(`WRASAL Build Mode MVP

Usage:
  node scripts/build-mode.mjs define --file PATH --build-id ID --target TEXT
  node scripts/build-mode.mjs specify --file PATH --spec-id ID --summary TEXT --acceptance TEXT
  node scripts/build-mode.mjs build --file PATH --artifact-id ID --path RELATIVE_FILE --description TEXT
  node scripts/build-mode.mjs test --file PATH --test-id ID --artifact-id ID --command COMMAND
  node scripts/build-mode.mjs evidence --file PATH --evidence-id ID --class CLASS --claim TEXT --source TEXT
  node scripts/build-mode.mjs decide --file PATH --decision-id ID --state STATE --rationale TEXT [--established-evidence-id ID]
  node scripts/build-mode.mjs defer --file PATH --capability-id ID --description TEXT --reason TEXT
  node scripts/build-mode.mjs validate --file PATH

Core states:
  ${BUILD_STATES.join(' -> ')}

Decision states:
  ${DECISION_STATES.join(', ')}

Evidence classes:
  ${EVIDENCE_CLASSES.join(', ')}

INFERRED and UNVERIFIED evidence is routed as NON_ESTABLISHING and cannot be
referenced by decision.established_evidence_id.`);
}

export function runCli(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return 0;
  }

  const options = parseOptions(args);
  switch (command) {
    case 'define': return commandDefine(options);
    case 'specify': return commandSpecify(options);
    case 'build': return commandBuild(options);
    case 'test': return commandTest(options);
    case 'evidence': return commandEvidence(options);
    case 'decide': return commandDecide(options);
    case 'defer': return commandDefer(options);
    case 'validate': return commandValidate(options);
    default: throw new Error(`Unknown Build Mode command: ${command}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
