#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts', 'wrasal-visual-dna-execution-bridge.mjs');
const input = path.join(root, 'visual_dna', 'execution-fixtures', 'WRASAL-INTENT-ARCHIVAL-LAB.json');
const run = spawnSync(process.execPath, [cli, '--input', input], { encoding: 'utf8' });
assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
assert.match(run.stdout, /compiled 3 execution plan/);

const invalid = spawnSync(process.execPath, [cli, '--input', path.join(root, 'visual_dna', 'conformance-fixtures', 'WRASAL-CONFORMANCE-PASS.json')], { encoding: 'utf8' });
assert.notEqual(invalid.status, 0, 'conformance manifest must not be accepted as an intent');
assert.match(invalid.stderr, /intent\.intent_id must be a non-empty string/);

console.log('PASS WRASAL Visual DNA execution bridge tests');
