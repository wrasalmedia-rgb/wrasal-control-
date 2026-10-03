#!/usr/bin/env node
/**
 * WRASAL Visual Production Pilot v001.
 * Orchestrates the first production loop without fabricating renderer output.
 * Rendered artifacts and human observations remain external evidence inputs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BRIDGE = path.join(ROOT, 'scripts', 'wrasal-visual-dna-execution-bridge.mjs');
const RESOLVER = path.join(ROOT, 'scripts', 'wrasal-visual-artifact-resolver.mjs');
const CONFORMANCE = path.join(ROOT, 'scripts', 'wrasal-visual-dna-conformance.mjs');
const EXPECTED_KINDS = ['image', 'object', 'architecture'];
function usage() { console.log('Usage: node scripts/wrasal-visual-production-pilot.mjs --input INTENT.json --artifacts PATH [--review REVIEW.json] [--overrides OVERRIDES.json] [--output REPORT.json]'); }
function args(argv) {
  const out = { input: null, artifacts: null, review: null, overrides: null, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') out.input = argv[++i];
    else if (argv[i] === '--artifacts') out.artifacts = argv[++i];
    else if (argv[i] === '--review') out.review = argv[++i];
    else if (argv[i] === '--overrides') out.overrides = argv[++i];
    else if (argv[i] === '--output') out.output = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!out.input || !out.artifacts) throw new Error('--input and --artifacts are required');
  return Object.fromEntries(Object.entries(out).map(([key, value]) => [key, value && (key === 'output' || key === 'review' || key === 'overrides' || key === 'artifacts' || key === 'input' ? path.resolve(value) : value)]));
}
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function run(command, argv, cwd = ROOT) {
  const result = spawnSync(process.execPath, [command, ...argv], { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed: ${result.stdout}${result.stderr}`);
  return result.stdout;
}
function listArtifacts(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`artifact directory does not exist: ${dir}`);
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort().map((file) => ({ file: path.join(dir, file), value: json(path.join(dir, file)) }));
}
function reviewValue(file) { return file && fs.existsSync(file) ? json(file) : { status: 'pending', interventions: [], notes: 'Human review has not been recorded.' }; }
function overridesValue(file) { return file && fs.existsSync(file) ? json(file) : { execution_decisions: 0, interventions: [] }; }
function metric(overrides) {
  const decisions = Number(overrides.execution_decisions ?? 0);
  const interventions = Array.isArray(overrides.interventions) ? overrides.interventions : [];
  return { execution_decisions: decisions, human_interventions: interventions.length, override_density: decisions > 0 ? interventions.length / decisions : null, diagnostic: 'Override density is diagnostic, not a quality score.', interventions };
}
function compile(input, temp) {
  const bridgeFile = path.join(temp, 'bridge.json');
  const resolvedFile = path.join(temp, 'resolved.json');
  run(BRIDGE, ['--input', input, '--output', bridgeFile]);
  run(RESOLVER, ['--input', bridgeFile, '--providers', 'provider-neutral,generic-image-model,blender', '--output', resolvedFile]);
  return { bridge: json(bridgeFile), resolver: json(resolvedFile) };
}
function pilot(options) {
  const artifacts = listArtifacts(options.artifacts);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wrasal-pilot-'));
  try {
    const input = json(options.input);
    const compiled = compile(options.input, temp);
    const kinds = [...new Set(artifacts.map(({ value }) => value.execution_kind).filter(Boolean))];
    const missing = EXPECTED_KINDS.filter((kind) => !kinds.includes(kind));
    const rendered = artifacts.filter(({ value }) => value.render_status === 'rendered');
    const artifactReport = artifacts.map(({ file, value }) => ({ file: path.relative(ROOT, file), artifact_id: value.artifact_id ?? null, execution_kind: value.execution_kind ?? null, provider: value.provider ?? null, render_status: value.render_status ?? 'unmarked', observation_status: value.observation_status ?? 'unmarked' }));
    let conformance = { status: 'pending', reason: 'No rendered artifact manifests were supplied.' };
    if (rendered.length) {
      const conformanceDir = path.join(temp, 'conformance'); fs.mkdirSync(conformanceDir);
      for (const { file, value } of rendered) fs.copyFileSync(file, path.join(conformanceDir, path.basename(file)));
      const reportFile = path.join(temp, 'conformance-report.json');
      const result = spawnSync(process.execPath, [CONFORMANCE, '--input', conformanceDir, '--report', reportFile, '--strict'], { cwd: ROOT, encoding: 'utf8' });
      conformance = result.status === 0 ? { status: 'pass', report: json(reportFile) } : { status: 'fail', report: fs.existsSync(reportFile) ? json(reportFile) : null, stderr: result.stderr };
    }
    const review = reviewValue(options.review);
    const overrides = overridesValue(options.overrides);
    const report = { schema_version: 'WRASAL_VISUAL_PRODUCTION_PILOT_v001', pilot_id: 'WRASAL-0014', generated_at: new Date().toISOString(), intent_id: input.intent_id, scope: { required_execution_kinds: EXPECTED_KINDS, compiled_execution_kinds: compiled.bridge.execution_plans.map((plan) => plan.execution_kind), artifact_count: artifacts.length, rendered_artifact_count: rendered.length, missing_execution_kinds: missing }, pipeline: ['intent', 'execution_bridge', 'artifact_resolver', 'provider', 'render', 'artifact_manifest', 'conformance', 'human_review', 'archive'], execution: { bridge_schema: compiled.bridge.schema_version, resolver_schema: compiled.resolver.schema_version, provider_invariance: compiled.resolver.cross_renderer_invariance, artifacts: artifactReport }, evidence_separation: { canonical: 'declared WRASAL rules and grammars', execution: 'provider and artifact output observations', observational: 'human review and override records' }, conformance, human_review: review, override_density: metric(overrides), result: missing.length || rendered.length < EXPECTED_KINDS.length || conformance.status !== 'pass' || review.status !== 'pass' ? 'incomplete_or_review' : 'pass', governance: { no_provider_canon: true, artifact_is_not_canon: true, manual_overrides_require_reason: true, repeated_overrides_are_system_diagnostics: true, v002_promotion: 'not automatic' } };
    return report;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
try { const options = args(process.argv.slice(2)); const report = pilot(options); if (options.output) { fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`); } console.log(`${report.result === 'pass' ? 'PASS' : 'REVIEW'} WRASAL production pilot: ${report.intent_id}; rendered ${report.scope.rendered_artifact_count}/${report.scope.required_execution_kinds.length}; override density ${report.override_density.override_density ?? 'n/a'}`); if (options.output) console.log(`wrote ${options.output}`); } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
