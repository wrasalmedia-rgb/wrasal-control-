#!/usr/bin/env node
/**
 * Deterministic conformance harness for WRASAL Visual DNA v001.
 * It evaluates structured observations made by a human or vision system; it
 * does not pretend that JSON metadata is visual evidence. `not_observed` is a
 * failure for required claims, not a pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CANONICAL_RULES = [
  ['C-001', 'independent_plausibility', 'artifact appears to exist independently of the image'],
  ['C-002', 'visible_function', 'major forms and decisions have an apparent function'],
  ['C-003', 'manufacturing_evidence', 'construction, joins, tolerances, or service evidence are present'],
  ['C-004', 'material_realism', 'surfaces respond to light and use physically credibly'],
  ['C-005', 'human_specificity', 'human subjects retain credible texture, diversity, asymmetry, and behavior when present'],
  ['C-006', 'cultural_context', 'cultural identity emerges from lived context rather than decoration'],
  ['C-007', 'temporal_residue', 'use, maintenance, revision, predecessor, or uncertainty is materially legible'],
  ['C-008', 'interface_physics', 'technical elements are anchored to an object, datum, or operation'],
  ['C-009', 'futuristic_not_cyberpunk', 'technical advancement is present without generic cyberpunk conventions'],
  ['C-010', 'human_scale', 'scale and interaction remain believable'],
];
const INFERRED_RULES = [
  ['I-001', 'cross_system_continuity', 'artifact could coexist with other WRASAL artifacts without metadata'],
  ['I-002', 'operational_environment', 'environment answers user, use, history, maintenance, active, obsolete, and building questions'],
  ['I-003', 'memory_stack', 'time is represented through aligned states and residue rather than nostalgia effects'],
];
const NEGATIVE_RULES = [
  ['generic_cyberpunk', 'generic cyberpunk or neon-noir conventions'], ['generic_sci_fi', 'unidentified spectacle with no function or provenance'],
  ['neon_excess', 'multiple saturated emissive colors with no state meaning'], ['hud_clutter', 'detached or meaningless HUD elements'],
  ['cgi_human', 'plastic skin, perfect symmetry, or beauty smoothing'], ['sterile_minimalism', 'pristine emptiness that removes use and maintenance'],
  ['luxury_advertising', 'surface-led luxury advertising language'], ['decorative_afrofuturism', 'generic cultural patterns, glowing masks, or costume cliché'],
  ['impossible_machine', 'unserviceable geometry, floating parts, or gravity violations'], ['post_processing', 'HDR halos, fake grain, excessive bloom, or synthetic material rendering'],
];
const REQUIRED_BLIND_REMOVALS = ['logo', 'typography', 'metadata', 'coordinates', 'gold_red_indicators'];

function usage() {
  console.log('Usage: node scripts/wrasal-visual-dna-conformance.mjs --input PATH [--report PATH] [--strict]');
  console.log('PATH may be one artifact JSON or a directory of artifact JSON files.');
}
function args(argv) {
  const out = { input: null, report: null, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') out.input = argv[++i];
    else if (argv[i] === '--report') out.report = argv[++i];
    else if (argv[i] === '--strict') out.strict = true;
    else if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!out.input) throw new Error('--input is required');
  return { ...out, input: path.resolve(out.input), report: out.report ? path.resolve(out.report) : null };
}
function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function loadInputs(input) {
  const files = fs.statSync(input).isDirectory() ? fs.readdirSync(input).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(input, f)) : [input];
  if (!files.length) throw new Error('input directory contains no .json artifact manifests');
  return files.map((file) => {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isObject(value)) throw new Error(`${file}: artifact must be a JSON object`);
    return { file: path.relative(process.cwd(), file), value };
  });
}
function statusForClaim(record) {
  return record?.status ?? 'not_observed';
}
function claimResult(record, id, key, domain) {
  const status = statusForClaim(record);
  const evidence = record?.evidence ?? null;
  const valid = ['satisfied', 'violated', 'not_observed'].includes(status) && typeof evidence === 'string' && evidence.trim().length > 0;
  return { id, domain, key, status: valid ? status : 'violated', evidence: valid ? evidence : 'missing structured evidence or invalid status', source_status: domain === 'canonical' ? 'CANON' : 'INFERRED' };
}
function evaluateArtifact({ file, value }) {
  const failures = [];
  const checks = [];
  const add = (check) => { checks.push(check); if (check.status !== 'satisfied' && check.status !== 'not_applicable') failures.push(check); };
  if (typeof value.artifact_id !== 'string' || !value.artifact_id) add({ id: 'INPUT-001', domain: 'input', key: 'artifact_id', status: 'violated', evidence: 'artifact_id is required' });
  if (!isObject(value.observations)) add({ id: 'INPUT-002', domain: 'input', key: 'observations', status: 'violated', evidence: 'observations object is required' });
  for (const [id, key,] of CANONICAL_RULES) add(claimResult(value.observations?.[key], id, key, 'canonical'));
  for (const [id, key,] of INFERRED_RULES) {
    const record = value.inferred_observations?.[key];
    checks.push(record ? claimResult(record, id, key, 'inferred') : { id, domain: 'inferred', key, status: 'not_observed', evidence: 'inferred rule not claimed', source_status: 'INFERRED' });
  }
  const blind = value.blind_test;
  const blindValid = isObject(blind) && REQUIRED_BLIND_REMOVALS.every((key) => blind[key] === true) && blind.evaluator_result === 'pass' && typeof blind.rationale === 'string' && blind.rationale.trim();
  add({ id: 'B-001', domain: 'blind', key: 'blind_wrasal_test', status: blindValid ? 'satisfied' : 'violated', evidence: blindValid ? blind.rationale : 'all metadata removals and a passing rationale are required' });
  const negativeFlags = Array.isArray(value.negative_flags) ? value.negative_flags : [];
  for (const [id, description] of NEGATIVE_RULES) add({ id: `N-${id}`, domain: 'negative', key: id, status: negativeFlags.includes(id) ? 'violated' : 'satisfied', evidence: negativeFlags.includes(id) ? description : `no ${id} flag recorded` });
  const cultural = value.cultural_review;
  add({ id: 'CULT-001', domain: 'cultural', key: 'cultural_review', status: isObject(cultural) && cultural.status === 'pass' && typeof cultural.evidence === 'string' && cultural.evidence.trim() ? 'satisfied' : 'violated', evidence: cultural?.evidence ?? 'cultural review with evidence is required' });
  if (isObject(cultural) && Array.isArray(cultural.cliche_flags) && cultural.cliche_flags.length) add({ id: 'CULT-002', domain: 'cultural', key: 'cliche_flags', status: 'violated', evidence: cultural.cliche_flags.join(', ') });
  const unsupported = Array.isArray(value.unsupported_decisions) ? value.unsupported_decisions : [];
  add({ id: 'GOV-001', domain: 'governance', key: 'unsupported_decisions', status: unsupported.length ? 'violated' : 'satisfied', evidence: unsupported.length ? unsupported.join(', ') : 'no unsupported decisions recorded' });
  const technical = value.technical_review;
  add({ id: 'TECH-001', domain: 'technical', key: 'technical_review', status: isObject(technical) && technical.status === 'pass' && typeof technical.evidence === 'string' && technical.evidence.trim() ? 'satisfied' : 'violated', evidence: technical?.evidence ?? 'technical review with evidence is required' });
  const canonical = checks.filter((c) => c.domain === 'canonical');
  const inferred = checks.filter((c) => c.domain === 'inferred');
  const blindCheck = checks.find((c) => c.id === 'B-001');
  const passed = failures.length === 0;
  return { artifact_id: value.artifact_id ?? path.basename(file), specimen_id: value.specimen_id ?? null, file, result: passed ? 'pass' : 'fail', canonical: { satisfied: canonical.filter((c) => c.status === 'satisfied').length, violated: canonical.filter((c) => c.status === 'violated').length, checks: canonical }, inferred: { claimed: inferred.filter((c) => c.status === 'satisfied' || c.status === 'violated').length, checks: inferred }, blind_wrasal_test: blindCheck, negative: { violations: checks.filter((c) => c.domain === 'negative' && c.status === 'violated').map((c) => c.key) }, cultural: checks.filter((c) => c.domain === 'cultural'), technical: checks.filter((c) => c.domain === 'technical'), unsupported_decisions: unsupported, failures, v002_candidate: false };
}
function buildReport(inputs) {
  const artifacts = inputs.map(evaluateArtifact);
  const failures = artifacts.flatMap((a) => a.failures.map((f) => ({ artifact_id: a.artifact_id, ...f })));
  const repeatCounts = new Map();
  for (const failure of failures) repeatCounts.set(failure.key, (repeatCounts.get(failure.key) ?? 0) + 1);
  const candidates = [...repeatCounts.entries()].filter(([, count]) => count >= 2).map(([key, count]) => ({ key, repeated_failures: count, disposition: 'candidate_for_review_only', promotion: 'not_promoted_to_v002' }));
  for (const artifact of artifacts) artifact.v002_candidate = artifact.failures.some((f) => candidates.some((c) => c.key === f.key));
  return { schema_version: 'WRASAL_VISUAL_DNA_CONFORMANCE_REPORT_v001', generated_at: new Date().toISOString(), authority: 'WRASAL Visual DNA v001', artifact_count: artifacts.length, result: artifacts.every((a) => a.result === 'pass') ? 'pass' : 'fail', blind_test: { required_removals: REQUIRED_BLIND_REMOVALS, rule: 'artifact must remain recognizable as WRASAL without metadata' }, artifacts, repeated_failures: candidates, governance: { specimens_do_not_become_canon: true, inferred_rules_do_not_promote_automatically: true, v002_changes_require_review: true } };
}
const options = args(process.argv.slice(2));
try {
  const report = buildReport(loadInputs(options.input));
  if (options.report) { fs.mkdirSync(path.dirname(options.report), { recursive: true }); fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`); }
  console.log(`${report.result === 'pass' ? 'PASS' : 'FAIL'} WRASAL Visual DNA conformance (${report.artifact_count} artifact${report.artifact_count === 1 ? '' : 's'})`);
  console.log(`canonical failures: ${report.artifacts.reduce((n, a) => n + a.canonical.violated, 0)}; negative violations: ${report.artifacts.reduce((n, a) => n + a.negative.violations.length, 0)}; repeated v002 candidates: ${report.repeated_failures.length}`);
  if (report.result !== 'pass' && (options.strict || !options.report)) process.exitCode = 1;
} catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 2; }
