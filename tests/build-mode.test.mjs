#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DECISION_STATES, EVIDENCE_CLASSES, evidenceRoute } from '../scripts/build-mode.mjs';

const testFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testFile), '..');
const cli = path.join(repoRoot, 'scripts', 'build-mode.mjs');
const demoRecordPath = path.join(repoRoot, 'builds', 'BUILD-001-TEST.json');
const demoArtifactPath = path.join(repoRoot, 'artifacts', 'BUILD-001-TEST.md');

function runCli(args, { cwd = repoRoot } = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function outputOf(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function expectPass(result, message) {
  assert.equal(result.status, 0, `${message}\n${outputOf(result)}`);
}

function expectFail(result, expression, message) {
  assert.notEqual(result.status, 0, `${message}\n${outputOf(result)}`);
  assert.match(outputOf(result), expression, `${message}\n${outputOf(result)}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function withTempRoot(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wrasal-build-mode-'));
  try {
    callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

const checkedDemo = runCli(['validate', '--file', 'builds/BUILD-001-TEST.json']);
expectPass(checkedDemo, 'expected BUILD-001-TEST record to validate');

const demo = readJson(demoRecordPath);
assert.equal(demo.build.id, 'BUILD-001-TEST');
assert.equal(demo.build.state, 'DECIDED');
assert.equal(demo.build_spec.build_id, demo.build.id);
assert.equal(demo.artifact.build_spec_id, demo.build_spec.id);
assert.equal(demo.test.artifact_id, demo.artifact.id);
assert.equal(demo.test.result, 'PASS');
assert.equal(demo.evidence.test_id, demo.test.id);
assert.equal(demo.evidence.evidence_class, 'OBSERVED');
assert.equal(demo.evidence.route, 'REVIEWABLE');
assert.equal(demo.decision.state, 'SHIP');
assert.equal(demo.decision.established_evidence_id, demo.evidence.id);
assert.ok(demo.deferred_capabilities.length >= 2, 'expected non-core scope to be explicitly deferred');
assert.ok(demo.deferred_capabilities.every((capability) => capability.disposition === 'DEFERRED'));
assert.match(fs.readFileSync(demoArtifactPath, 'utf8'), /DEFINE.*SPECIFY.*BUILD.*TEST.*EVIDENCE.*DECIDE/s);

const lifecycleEvents = demo.events
  .filter((event) => !['CAPABILITY_DEFERRED', 'TEST_COMPLETED'].includes(event.type))
  .map((event) => event.type);
assert.deepEqual(lifecycleEvents, [
  'BUILD_DEFINED',
  'BUILD_SPECIFIED',
  'ARTIFACT_RECORDED',
  'TEST_STARTED',
  'EVIDENCE_RECORDED',
  'DECISION_RECORDED',
]);
assert.deepEqual(
  demo.events.map((event) => event.sequence),
  Array.from({ length: demo.events.length }, (_, index) => index + 1),
);

withTempRoot((root) => {
  const record = 'builds/BUILD-TEST-TEMP.json';
  const artifact = 'artifacts/BUILD-TEST-TEMP.md';
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, artifact), '# Temporary Build Artifact\n\nSmall but non-empty.\n', 'utf8');

  expectPass(runCli([
    'define',
    '--file', record,
    '--build-id', 'BUILD-TEST-TEMP',
    '--target', 'Exercise every Build Mode core-loop command.',
  ], { cwd: root }), 'expected define to create a DRAFT build');

  expectFail(runCli([
    'test',
    '--file', record,
    '--test-id', 'BUILD-TEST-TEMP-TEST',
    '--artifact-id', 'BUILD-TEST-TEMP-ARTIFACT',
    '--command', 'true',
  ], { cwd: root }), /test requires state BUILDING/, 'expected out-of-order test to be rejected');

  expectPass(runCli([
    'defer',
    '--file', record,
    '--capability-id', 'DEFER-TEST-TEMP-UI',
    '--description', 'A visual dashboard',
    '--reason', 'It is outside the core loop.',
  ], { cwd: root }), 'expected non-core capability to be deferred');

  expectPass(runCli([
    'specify',
    '--file', record,
    '--spec-id', 'BUILD-TEST-TEMP-SPEC',
    '--summary', 'Connect one target to one auditable loop.',
    '--acceptance', 'The record reaches a valid decision with every required object.',
  ], { cwd: root }), 'expected specify to move build to SPECIFIED');

  expectPass(runCli([
    'build',
    '--file', record,
    '--artifact-id', 'BUILD-TEST-TEMP-ARTIFACT',
    '--path', artifact,
    '--description', 'Temporary artifact for CLI lifecycle coverage.',
  ], { cwd: root }), 'expected build to record an existing artifact');

  const selfValidationCommand = [
    shellQuote(process.execPath),
    shellQuote(cli),
    'validate',
    '--file',
    shellQuote(record),
  ].join(' ');
  expectPass(runCli([
    'test',
    '--file', record,
    '--test-id', 'BUILD-TEST-TEMP-TEST',
    '--artifact-id', 'BUILD-TEST-TEMP-ARTIFACT',
    '--command', selfValidationCommand,
  ], { cwd: root }), 'expected test to execute and record a passing result');

  expectPass(runCli([
    'evidence',
    '--file', record,
    '--evidence-id', 'BUILD-TEST-TEMP-EVIDENCE',
    '--class', 'OBSERVED',
    '--claim', 'The temporary build validated during TESTING.',
    '--source', 'Temporary Test command output.',
  ], { cwd: root }), 'expected evidence to move build to EVIDENCE_REVIEW');

  expectPass(runCli([
    'decide',
    '--file', record,
    '--decision-id', 'BUILD-TEST-TEMP-DECISION',
    '--state', 'SHIP',
    '--rationale', 'Passing observed evidence supports the temporary test build.',
    '--established-evidence-id', 'BUILD-TEST-TEMP-EVIDENCE',
  ], { cwd: root }), 'expected eligible observed evidence to support SHIP');

  expectPass(runCli(['validate', '--file', record], { cwd: root }), 'expected completed temporary loop to validate');
  const completed = readJson(path.join(root, record));
  assert.equal(completed.build.state, 'DECIDED');
  assert.equal(completed.test.result, 'PASS');
  assert.match(completed.test.output, /PASS BUILD-TEST-TEMP validation \(TESTING\)/);
  assert.equal(completed.evidence.route, 'REVIEWABLE');
  assert.equal(completed.events.at(-1).type, 'DECISION_RECORDED');
});

withTempRoot((root) => {
  const invalidRecordPath = path.join(root, 'inferred-promotion.json');
  const invalid = readJson(demoRecordPath);
  invalid.evidence.evidence_class = 'INFERRED';
  invalid.evidence.route = 'NON_ESTABLISHING';
  writeJson(invalidRecordPath, invalid);

  expectFail(
    runCli(['validate', '--file', invalidRecordPath]),
    /may not promote INFERRED evidence as established reality/,
    'expected inferred evidence promotion to be rejected',
  );
});

withTempRoot((root) => {
  const invalidRecordPath = path.join(root, 'unverified-promotion.json');
  const invalid = readJson(demoRecordPath);
  invalid.evidence.evidence_class = 'UNVERIFIED';
  invalid.evidence.route = 'NON_ESTABLISHING';
  writeJson(invalidRecordPath, invalid);

  expectFail(
    runCli(['validate', '--file', invalidRecordPath]),
    /may not promote UNVERIFIED evidence as established reality/,
    'expected unverified evidence promotion to be rejected',
  );
});

withTempRoot((root) => {
  const invalidRecordPath = path.join(root, 'implemented-capability.json');
  const invalid = readJson(demoRecordPath);
  invalid.deferred_capabilities[0].disposition = 'IMPLEMENTED';
  writeJson(invalidRecordPath, invalid);

  expectFail(
    runCli(['validate', '--file', invalidRecordPath]),
    /disposition must be DEFERRED/,
    'expected a non-deferred proposed capability to be rejected',
  );
});

for (const decisionState of DECISION_STATES) {
  withTempRoot((root) => {
    const recordPath = path.join(root, `${decisionState.toLowerCase()}.json`);
    const variant = readJson(demoRecordPath);
    variant.decision.state = decisionState;
    writeJson(recordPath, variant);
    expectPass(
      runCli(['validate', '--file', recordPath]),
      `expected ${decisionState} to be a supported decision state`,
    );
  });
}

for (const evidenceClass of EVIDENCE_CLASSES) {
  withTempRoot((root) => {
    const recordPath = path.join(root, `${evidenceClass.toLowerCase()}.json`);
    const variant = readJson(demoRecordPath);
    variant.evidence.evidence_class = evidenceClass;
    variant.evidence.route = evidenceRoute(evidenceClass);
    variant.decision.state = 'ITERATE';
    variant.decision.established_evidence_id = (
      evidenceClass === 'INFERRED' || evidenceClass === 'UNVERIFIED'
    ) ? null : variant.evidence.id;
    writeJson(recordPath, variant);
    expectPass(
      runCli(['validate', '--file', recordPath]),
      `expected ${evidenceClass} to be a recordable evidence class`,
    );
  });
}

console.log('PASS Build Mode MVP tests');
