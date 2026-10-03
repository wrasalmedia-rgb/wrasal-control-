#!/usr/bin/env node
/**
 * WRASAL Visual DNA Execution Bridge v001.
 * Resolves intent into reproducible execution plans. It does not generate an
 * image, invent canon, or score aesthetics; it compiles evidence requirements
 * for a downstream image/object/architecture executor.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DNA = path.join(ROOT, 'visual_dna');
const MODES = {
  image: { mode: 'B_cinematic_portrait', lens: '85mm', subject: 'human or scene evidence' },
  object: { mode: 'C_technical_specimen', lens: '100mm_macro', subject: 'manufactured object evidence' },
  architecture: { mode: 'D_architectural_documentation', lens: '24mm', subject: 'buildable spatial evidence' },
};
const MATERIAL_DEFAULTS = {
  image: ['engineered_polymer', 'precision_composite'],
  object: ['matte_anodized_aluminum', 'dark_PVD_titanium', 'frosted_optical_surface'],
  architecture: ['ceramic', 'precision_composite'],
};
const REQUIRED_INTENT = ['intent_id', 'request', 'subject_class', 'environment', 'cultural_context', 'temporal_state'];

function usage() { console.log('Usage: node scripts/wrasal-visual-dna-execution-bridge.mjs --input INTENT.json [--output PLANS.json]'); }
function parseArgs(argv) {
  const out = { input: null, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') out.input = argv[++i];
    else if (argv[i] === '--output') out.output = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') { usage(); process.exit(0); }
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!out.input) throw new Error('--input is required');
  return { input: path.resolve(out.input), output: out.output ? path.resolve(out.output) : null };
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function requireString(input, key) {
  if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`intent.${key} must be a non-empty string`);
}
function loadGrammar(name) { return readJson(path.join(DNA, name)); }
function chooseMode(intent, kind) {
  const requested = intent.execution_modes ?? Object.keys(MODES);
  if (!Array.isArray(requested) || requested.length === 0) throw new Error('intent.execution_modes must be a non-empty array when present');
  if (!requested.includes(kind)) throw new Error(`unsupported execution mode: ${kind}`);
  return MODES[kind];
}
function resolveLighting(kind, lighting) {
  const selected = kind === 'architecture' ? 'architectural_daylight' : kind === 'object' ? 'diagnostic_state' : 'cool_edge_local_warm';
  const pattern = lighting.patterns.find((entry) => entry.id === selected);
  return { pattern_id: selected, ...pattern, required_state_logic: 'Accents communicate state only; neutral material and void field carry most of the frame.' };
}
function resolveMaterials(kind, materialGrammar, requested) {
  const names = requested ?? MATERIAL_DEFAULTS[kind];
  if (!Array.isArray(names) || names.length === 0) throw new Error('materials must be a non-empty array when present');
  const unknown = names.filter((name) => !materialGrammar.materials[name]);
  if (unknown.length) throw new Error(`unknown material token(s): ${unknown.join(', ')}`);
  return names.map((name) => ({ token: name, ...materialGrammar.materials[name] }));
}
function makePlan(intent, kind, camera, materials, lighting, tokens) {
  const mode = chooseMode(intent, kind);
  const cameraMode = camera.modes[mode.mode];
  if (!cameraMode) throw new Error(`camera grammar is missing mode ${mode.mode}`);
  const accentPolicy = {
    gold: 'active, selected, valuable, ceremonial, or high-priority state only',
    red: 'boundary, warning, transition, or abnormal state only',
    steel_blue: 'construction, diagnostics, or technical activity only',
  };
  const planId = `${intent.intent_id}-${kind}`;
  return {
    plan_id: planId,
    intent_id: intent.intent_id,
    execution_kind: kind,
    authority_boundary: 'The Visual DNA describes the world; this plan describes how to render evidence of that world.',
    source_request: intent.request,
    world_spec: {
      subject_class: intent.subject_class,
      environment: intent.environment,
      cultural_context: intent.cultural_context,
      temporal_state: intent.temporal_state,
      users_and_function: intent.users_and_function ?? 'must be resolved before execution',
      active_obsolete_building: intent.active_obsolete_building ?? 'must be resolved before execution',
    },
    visual_intent: intent.visual_intent ?? 'make the subject independently plausible, functional, human-scaled, and historically situated',
    visual_dna_resolution: {
      canonical_tokens: ['void_black', 'surface_black', 'primary_information', 'archival_information', 'wrasal_gold', 'signal_red', 'diagnostic_steel_blue'],
      color_hierarchy: tokens.colors,
      material_tokens: materials.map((material) => material.token),
      interface_rule: 'Every technical element must measure, identify, align, or report an operation on a real subject anchor.',
      cultural_rule: 'Use naming, language, architecture, social behavior, memory, music, materials, and geography; do not use generic cultural ornament as shorthand.',
      temporal_rule: 'Show revision, residue, maintenance, disappearance, or reconstruction as material evidence; do not use nostalgia filters.',
      negative_invariants: ['generic cyberpunk', 'detached HUD', 'synthetic material response', 'plastic skin', 'impossible machinery', 'decorative cultural cliché'],
    },
    execution_parameters: {
      camera: { lens: mode.lens, role: mode.subject, ...camera.lens_roles[mode.lens], mode: mode.mode, ...cameraMode },
      materials,
      lighting,
      composition: kind === 'architecture' ? ['strict perspective', 'architectural scale', 'human scale anchor', 'service and circulation evidence'] : kind === 'object' ? ['datum-aligned specimen view', 'negative space for construction reading', 'scale reference'] : ['human/environment relationship', 'specific gesture or interaction', 'context retained'],
      environment_requirements: ['who uses this', 'what it is used for', 'what happened here', 'maintenance evidence', 'previous version evidence', 'currently operational element', 'obsolete element', 'what is being built'],
    },
    prompt_modules: {
      WORLD_DNA: `Existing WRASAL operational world; ${intent.environment}; function, use, maintenance, revision, and future development are physically present.`,
      SUBJECT_DNA: `${intent.subject_class}; ${intent.request}; make major forms and behavior independently plausible.`,
      MATERIAL_DNA: materials.map((material) => `${material.token}: ${material.response}; show ${material.evidence.join(', ')}.`).join(' '),
      LIGHTING_DNA: `${lighting.purpose}; ${lighting.sources.join(', ')}; ${lighting.behavior}.`,
      CAMERA_DNA: `${mode.lens} for ${mode.subject}; ${cameraMode.aperture}; ${cameraMode.composition}; ${cameraMode.density}.`,
      COMPOSITION_DNA: 'Controlled negative space, construction readable, no spectacle that hides function.',
      INTERFACE_DNA: 'Anchored reticles, registration marks, calibration ticks, coordinates, nodes, diagnostics, or labels only when their operation is apparent.',
      CULTURAL_DNA: `${intent.cultural_context}; identity emerges through lived context, not generic pattern or costume.`,
      TEMPORAL_DNA: `${intent.temporal_state}; show residue, predecessor, maintenance, disappearance, reconstruction, or future state materially.`,
      OUTPUT_SPECIFICATION: `Produce a ${kind} execution plan, not a canon change. Preserve evidence for downstream conformance review.`,
      NEGATIVE_DNA: 'Reject generic cyberpunk, arbitrary neon, holographic clutter, plastic skin, sterile emptiness, generic luxury advertising, decorative Afrofuturist cliché, impossible machinery, HDR/bloom/fake grain, and unsupported labels.',
    },
    build_evidence_requirements: ['function', 'construction/manufacture', 'material response', 'human or scale relationship', 'cultural context', 'temporal residue', 'interface purpose if present', 'blind WRASAL recognizability'],
    conformance_manifest_template: {
      artifact_id: planId,
      specimen_id: intent.specimen_id ?? null,
      source_type: 'execution_bridge_output_pending_artifact',
      required_after_execution: ['observations', 'blind_test', 'negative_flags', 'cultural_review', 'technical_review', 'unsupported_decisions'],
      harness_command: 'node scripts/wrasal-visual-dna-conformance.mjs --input ARTIFACT.json --strict',
    },
  };
}
function compile(intent) {
  for (const key of REQUIRED_INTENT) requireString(intent, key);
  const camera = loadGrammar('WRASAL_CAMERA_GRAMMAR_v001.json');
  const materialGrammar = loadGrammar('WRASAL_MATERIAL_GRAMMAR_v001.json');
  const lighting = loadGrammar('WRASAL_LIGHTING_GRAMMAR_v001.json');
  const tokens = loadGrammar('WRASAL_VISUAL_TOKENS_v001.json');
  const kinds = intent.execution_modes ?? Object.keys(MODES);
  if (!Array.isArray(kinds) || kinds.some((kind) => !Object.hasOwn(MODES, kind))) throw new Error('execution_modes must contain only image, object, architecture');
  return {
    schema_version: 'WRASAL_VISUAL_DNA_EXECUTION_BRIDGE_v001',
    compiled_at: new Date().toISOString(),
    intent_id: intent.intent_id,
    invariant: 'The Visual DNA describes the world. The execution system describes how to render evidence of that world.',
    execution_plans: kinds.map((kind) => makePlan(intent, kind, camera, resolveMaterials(kind, materialGrammar, intent.materials?.[kind]), resolveLighting(kind, lighting), tokens)),
    promotion_policy: 'Execution output is non-canonical until artifact conformance and review; no plan can modify Visual DNA v001.',
  };
}
const options = parseArgs(process.argv.slice(2));
try {
  const intent = readJson(options.input);
  if (!object(intent)) throw new Error('intent must be a JSON object');
  const result = compile(intent);
  if (options.output) { fs.mkdirSync(path.dirname(options.output), { recursive: true }); fs.writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`); }
  console.log(`PASS WRASAL execution bridge compiled ${result.execution_plans.length} execution plan(s) for ${result.intent_id}`);
  if (options.output) console.log(`wrote ${options.output}`);
} catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
