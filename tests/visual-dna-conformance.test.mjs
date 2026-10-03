#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts', 'wrasal-visual-dna-conformance.mjs');
const fixture = (name) => path.join(root, 'visual_dna', 'conformance-fixtures', name);

const pass = spawnSync(process.execPath, [cli, '--input', fixture('WRASAL-CONFORMANCE-PASS.json'), '--strict'], { encoding: 'utf8' });
assert.equal(pass.status, 0, `${pass.stdout}\n${pass.stderr}`);
assert.match(pass.stdout, /PASS WRASAL Visual DNA conformance/);

const fail = spawnSync(process.execPath, [cli, '--input', fixture('WRASAL-CONFORMANCE-FAIL.json'), '--strict'], { encoding: 'utf8' });
assert.notEqual(fail.status, 0, 'failing fixture must fail strict conformance');
assert.match(fail.stdout, /canonical failures: 6/);
assert.match(fail.stdout, /negative violations: 5/);

console.log('PASS WRASAL Visual DNA conformance tests');
