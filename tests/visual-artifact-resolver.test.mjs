#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridge = path.join(root, 'scripts', 'wrasal-visual-dna-execution-bridge.mjs');
const resolver = path.join(root, 'scripts', 'wrasal-visual-artifact-resolver.mjs');
const intent = path.join(root, 'visual_dna', 'execution-fixtures', 'WRASAL-INTENT-ARCHIVAL-LAB.json');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wrasal-artifact-resolver-'));
try {
  const bridgeOutput = path.join(temp, 'bridge.json');
  const resolvedOutput = path.join(temp, 'resolved.json');
  const bridgeRun = spawnSync(process.execPath, [bridge, '--input', intent, '--output', bridgeOutput], { encoding: 'utf8' });
  assert.equal(bridgeRun.status, 0, `${bridgeRun.stdout}\n${bridgeRun.stderr}`);
  const resolveRun = spawnSync(process.execPath, [resolver, '--input', bridgeOutput, '--providers', 'provider-neutral,generic-image-model,blender', '--output', resolvedOutput], { encoding: 'utf8' });
  assert.equal(resolveRun.status, 0, `${resolveRun.stdout}\n${resolveRun.stderr}`);
  const report = JSON.parse(fs.readFileSync(resolvedOutput, 'utf8'));
  assert.equal(report.resolutions.length, 9);
  assert.equal(report.no_provider_canon, true);
  assert.ok(report.cross_renderer_invariance.every((entry) => entry.invariant === 'pass'));
  assert.ok(report.resolutions.every((entry) => entry.no_provider_canon === true));
  assert.notEqual(report.resolutions[0].adapter_payload.type, report.resolutions[1].adapter_payload.type);
  console.log('PASS WRASAL visual artifact resolver tests');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
