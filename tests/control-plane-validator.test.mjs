#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testFile), '..');
const validator = path.join(repoRoot, 'scripts', 'validate-control-plane.mjs');

function runValidator(args = [], options = {}) {
  return spawnSync(process.execPath, [validator, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
  });
}

function copyValidControlPlane(targetRoot) {
  for (const file of ['projects.yml', 'priorities.yml', 'dependencies.yml']) {
    fs.copyFileSync(path.join(repoRoot, file), path.join(targetRoot, file));
  }

  fs.mkdirSync(path.join(targetRoot, 'work_orders'), { recursive: true });
  for (const file of fs.readdirSync(path.join(repoRoot, 'work_orders'))) {
    if (file.endsWith('.json')) {
      fs.copyFileSync(path.join(repoRoot, 'work_orders', file), path.join(targetRoot, 'work_orders', file));
    }
  }
}

function withTempControlPlane(callback) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wrasal-validator-'));
  try {
    copyValidControlPlane(tempRoot);
    callback(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const validRun = runValidator();
assert.equal(validRun.status, 0, `expected valid control plane to pass\nstdout:\n${validRun.stdout}\nstderr:\n${validRun.stderr}`);
assert.match(validRun.stdout, /PASS control-plane validation/);

withTempControlPlane((tempRoot) => {
  fs.copyFileSync(
    path.join(repoRoot, 'tests', 'fixtures', 'invalid', 'WRASAL-9999-invalid-status.json'),
    path.join(tempRoot, 'work_orders', 'WRASAL-9999.json'),
  );

  const result = runValidator(['--root', tempRoot]);
  assert.notEqual(result.status, 0, 'expected invalid work-order status fixture to fail validation');
  assert.match(`${result.stdout}\n${result.stderr}`, /implementation_result=.*not in allowed vocabulary/);
});

withTempControlPlane((tempRoot) => {
  fs.copyFileSync(
    path.join(repoRoot, 'tests', 'fixtures', 'invalid', 'projects-extra-field.yml'),
    path.join(tempRoot, 'projects.yml'),
  );

  const result = runValidator(['--root', tempRoot]);
  assert.notEqual(result.status, 0, 'expected invalid projects.yml fixture to fail validation');
  assert.match(`${result.stdout}\n${result.stderr}`, /unexpected keys: runtime/);
});

console.log('PASS control-plane validator tests');
