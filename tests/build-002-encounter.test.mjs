#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testFile), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const specification = read('artifacts/BUILD-002-ENCOUNTER-SPEC.md');
const participantEncounter = read('artifacts/BUILD-002-PARTICIPANT-ENCOUNTER.md');
const facilitatorRunsheet = read('artifacts/BUILD-002-FACILITATOR-RUNSHEET.md');
const buildRecord = JSON.parse(read('builds/BUILD-002-WRAYVOLUTION-ENCOUNTER.json'));

assert.match(specification, /one consenting participant/i);
assert.match(specification, /25 minutes/i);
assert.match(specification, /30 minutes maximum/i);
assert.match(specification, /no participant has been run and no participant outcome is recorded/i);
assert.match(specification, /participant outcome remains \*\*Unknown\*\*/i);
assert.match(specification, /perception/i);
assert.match(specification, /interpretation/i);
assert.match(specification, /decision/i);
assert.match(specification, /action/i);

for (const heading of ['## 1. Before', '## 2. Work with the situation', '## 3. After', '## 4. One follow-up']) {
  assert.ok(participantEncounter.includes(heading), `participant encounter is missing ${heading}`);
}
assert.match(participantEncounter, /It is completely okay if nothing changes/i);
assert.match(participantEncounter, /skip any question or stop at any time/i);
assert.doesNotMatch(participantEncounter, /WRASAL|WRAYvolution/i, 'participant material must not require architecture vocabulary');

assert.match(facilitatorRunsheet, /Do \*\*not\*\* explain WRASAL, WRAYvolution/i);
assert.match(facilitatorRunsheet, /Never exceed 30 minutes/i);
assert.match(facilitatorRunsheet, /Unknown remains Unknown/i);
for (const evidenceClass of ['OBSERVED', 'USER_SUPPLIED', 'THIRD_PARTY_SUPPORTED', 'INFERRED', 'UNVERIFIED']) {
  assert.match(facilitatorRunsheet, new RegExp(`\`${evidenceClass}\``));
}

assert.equal(buildRecord.build.id, 'BUILD-002-WRAYVOLUTION-ENCOUNTER');
assert.ok(['TESTING', 'DECIDED'].includes(buildRecord.build.state), 'record must be at test execution or final decision');
assert.equal(buildRecord.artifact.path, 'artifacts/BUILD-002-ENCOUNTER-SPEC.md');
assert.equal(buildRecord.test?.command, 'node tests/build-002-encounter.test.mjs');

console.log('PASS BUILD-002 encounter packet tests');
