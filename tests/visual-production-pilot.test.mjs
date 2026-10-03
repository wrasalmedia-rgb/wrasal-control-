#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pilot = path.join(root, 'scripts', 'wrasal-visual-production-pilot.mjs');
const input = path.join(root, 'visual_dna', 'execution-fixtures', 'WRASAL-INTENT-ARCHIVAL-LAB.json');
const artifacts = path.join(root, 'visual_dna', 'pilot', 'WRASAL-0014', 'artifacts');
const run = spawnSync(process.execPath, [pilot, '--input', input, '--artifacts', artifacts], { encoding: 'utf8' });
assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
assert.match(run.stdout, /REVIEW WRASAL production pilot/);
assert.match(run.stdout, /rendered 0\/3/);
console.log('PASS WRASAL visual production pilot tests');
