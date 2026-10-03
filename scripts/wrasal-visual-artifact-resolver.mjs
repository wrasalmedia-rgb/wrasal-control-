#!/usr/bin/env node
/**
 * WRASAL Visual Artifact Resolver v001.
 * Resolves an execution plan into provider-neutral artifact instructions and
 * provider adapter payloads. It never calls a renderer and never edits canon.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PROVIDERS = {
  'provider-neutral': { family: 'reference', transport: 'structured_artifact_plan' },
  'generic-image-model': { family: 'image', transport: 'modular_prompt' },
  blender: { family: '3d', transport: 'scene_build_spec' },
  unreal: { family: 'realtime', transport: 'scene_build_spec' },
  figma: { family: 'layout', transport: 'component_spec' },
};
const REQUIRED_PLAN_FIELDS = ['plan_id', 'execution_kind', 'world_spec', 'visual_dna_resolution', 'execution_parameters', 'prompt_modules', 'build_evidence_requirements'];

function usage() {
  console.log('Usage: node scripts/wrasal-visual-artifact-resolver.mjs --input BRIDGE-PLANS.json [--providers LIST] [--output PATH] [--invariance-report PATH]');
}
function parseArgs(argv) {
  const out = { input: null, output: null, invarianceReport: null, providers: ['provider-neutral', 'generic-image-model', 'blender'] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') out.input = argv[++i];
    else if (argv[i] === '--providers') out.providers = argv[++i].split(',').map((v) => v.trim()).filter(Boolean);
    else if (argv[i] === '--output') out.output = argv[++i];
    else if (argv[i] === '--invariance-report') out.invarianceReport = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!out.input) throw new Error('--input is required');
  return { ...out, input: path.resolve(out.input), output: out.output ? path.resolve(out.output) : null, invarianceReport: out.invarianceReport ? path.resolve(out.invarianceReport) : null };
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function load(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function validateBridge(input) {
  if (!object(input) || input.schema_version !== 'WRASAL_VISUAL_DNA_EXECUTION_BRIDGE_v001') throw new Error('input must be a WRASAL_VISUAL_DNA_EXECUTION_BRIDGE_v001 output');
  if (!Array.isArray(input.execution_plans) || !input.execution_plans.length) throw new Error('bridge input must contain execution_plans');
  input.execution_plans.forEach((plan) => {
    const missing = REQUIRED_PLAN_FIELDS.filter((field) => !Object.hasOwn(plan, field));
    if (missing.length) throw new Error(`${plan.plan_id ?? 'plan'} is missing: ${missing.join(', ')}`);
  });
}
function invariants(plan) {
  return {
    world_spec: plan.world_spec,
    visual_intent: plan.visual_intent,
    canonical_tokens: plan.visual_dna_resolution.canonical_tokens,
    material_tokens: plan.visual_dna_resolution.material_tokens,
    interface_rule: plan.visual_dna_resolution.interface_rule,
    cultural_rule: plan.visual_dna_resolution.cultural_rule,
    temporal_rule: plan.visual_dna_resolution.temporal_rule,
    negative_invariants: plan.visual_dna_resolution.negative_invariants,
    evidence_requirements: plan.build_evidence_requirements,
  };
}
function resolveProvider(plan, provider) {
  const profile = PROVIDERS[provider];
  const invariantSet = invariants(plan);
  const base = {
    artifact_plan_id: `${plan.plan_id}--${provider}`,
    source_plan_id: plan.plan_id,
    provider,
    provider_family: profile.family,
    provider_transport: profile.transport,
    execution_kind: plan.execution_kind,
    authority: {
      visual_dna: 'canonical source of world rules',
      execution_bridge: 'source of resolved production parameters',
      provider: 'transport adapter only; cannot add or modify WRASAL rules',
    },
    no_provider_canon: true,
    world_invariants: invariantSet,
    technical_parameters: {
      camera: plan.execution_parameters.camera,
      materials: plan.execution_parameters.materials.map((m) => m.token),
      lighting: plan.execution_parameters.lighting,
      composition: plan.execution_parameters.composition,
      environment_requirements: plan.execution_parameters.environment_requirements,
    },
    conformance_handoff: plan.conformance_manifest_template,
  };
  if (provider === 'provider-neutral') {
    return { ...base, adapter_payload: { type: 'provider_neutral_artifact_plan', modules: plan.prompt_modules, construction: plan.execution_parameters.environment_requirements } };
  }
  if (provider === 'generic-image-model') {
    return { ...base, adapter_payload: { type: 'modular_prompt_adapter', prompt_modules: plan.prompt_modules, instruction: 'Provider may translate modules into its syntax; do not add style rules, tokens, or canon.', output: 'rendered image plus observation manifest' } };
  }
  if (provider === 'blender' || provider === 'unreal') {
    return { ...base, adapter_payload: { type: 'scene_build_spec_adapter', scene_graph: { environment: plan.world_spec.environment, subject: plan.world_spec.subject_class, camera: plan.execution_parameters.camera, materials: plan.execution_parameters.materials.map((m) => ({ token: m.token, response: m.response, evidence: m.evidence })), lighting: plan.execution_parameters.lighting }, instruction: 'Implement geometry and shading from evidence requirements; provider defaults cannot become WRASAL rules.' } };
  }
  return { ...base, adapter_payload: { type: 'component_spec_adapter', components: ['environment', 'subject', 'evidence annotations'], instruction: 'Map plan to provider components without inventing canon.' } };
}
function compile(input, providers) {
  const supported = providers.filter((provider) => PROVIDERS[provider]);
  const unknown = providers.filter((provider) => !PROVIDERS[provider]);
  if (unknown.length) throw new Error(`unknown provider adapter(s): ${unknown.join(', ')}`);
  if (!supported.length) throw new Error('at least one provider adapter is required');
  const resolutions = input.execution_plans.flatMap((plan) => supported.map((provider) => resolveProvider(plan, provider)));
  const groups = new Map();
  for (const resolution of resolutions) {
    const key = resolution.source_plan_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(resolution);
  }
  const invariance = [...groups.entries()].map(([sourcePlanId, entries]) => {
    const hashes = entries.map((entry) => ({ provider: entry.provider, hash: digest(entry.world_invariants) }));
    const first = hashes[0]?.hash;
    return { source_plan_id: sourcePlanId, providers: hashes.map((v) => v.provider), invariant_hashes: hashes, invariant: hashes.every((v) => v.hash === first) ? 'pass' : 'fail', rule: 'Provider adapters may change transport syntax, never the underlying world invariants.' };
  });
  return { schema_version: 'WRASAL_VISUAL_ARTIFACT_RESOLVER_v001', resolved_at: new Date().toISOString(), authority_boundary: 'Renderer interprets. Provider adapter transports. Neither defines WRASAL reality.', no_provider_canon: true, source_bridge_schema: input.schema_version, provider_adapters: supported, resolutions, cross_renderer_invariance: invariance, governance: { provider_output_is_evidence_not_canon: true, provider_specific_material_behavior_is_not_automatically_promoted: true, conformance_required_after_render: true } };
}
const options = parseArgs(process.argv.slice(2));
try {
  const result = compile(load(options.input), options.providers);
  if (options.output) { fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`); }
  if (options.invarianceReport) { fs.mkdirSync(path.dirname(options.invarianceReport), { recursive: true }); fs.writeFileSync(options.invarianceReport, `${JSON.stringify(result.cross_renderer_invariance, null, 2)}\n`); }
  const failed = result.cross_renderer_invariance.filter((entry) => entry.invariant === 'fail');
  console.log(`${failed.length ? 'FAIL' : 'PASS'} WRASAL artifact resolver: ${result.resolutions.length} provider resolution(s); invariance groups: ${result.cross_renderer_invariance.length}`);
  if (options.output) console.log(`wrote ${options.output}`);
  if (options.invarianceReport) console.log(`wrote ${options.invarianceReport}`);
  if (failed.length) process.exitCode = 1;
} catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
