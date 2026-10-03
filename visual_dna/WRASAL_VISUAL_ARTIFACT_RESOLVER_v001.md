# WRASAL Visual Artifact Resolver v001

The resolver is the provider-neutral boundary between an execution plan and a renderer. It does not generate images, assign a WRASAL score, or make provider behavior canonical.

```text
WRASAL WORLD
  ↓
VISUAL DNA v001
  ↓
CONFORMANCE HARNESS ← verifies artifacts
  ↓
EXECUTION BRIDGE ← resolves production parameters
  ↓
ARTIFACT RESOLVER ← provider-neutral plan + adapter payload
  ↓
PROVIDER / RENDERER
  ↓
ARTIFACT + OBSERVATION MANIFEST
  ↓
CONFORMANCE HARNESS
```

## Usage

```sh
node scripts/wrasal-visual-dna-execution-bridge.mjs \
  --input visual_dna/execution-fixtures/WRASAL-INTENT-ARCHIVAL-LAB.json \
  --output /tmp/bridge-plans.json

node scripts/wrasal-visual-artifact-resolver.mjs \
  --input /tmp/bridge-plans.json \
  --providers provider-neutral,generic-image-model,blender \
  --output /tmp/artifact-plans.json \
  --invariance-report /tmp/invariance.json
```

Or run the checked fixture path:

```sh
npm run resolve:visual-artifact
```

## Provider-neutral contract

Every resolution preserves a shared `world_invariants` object containing world specification, visual intent, canonical tokens, materials, interface rules, cultural rules, temporal rules, negative invariants, and evidence requirements. Provider adapters may translate transport syntax only.

Supported adapter profiles in v001 are deliberately illustrative and non-networked:

- `provider-neutral`: structured artifact plan
- `generic-image-model`: modular prompt transport
- `blender`: scene-build specification
- `unreal`: scene-build specification
- `figma`: component-specification transport

No adapter calls an external service. A later integration may add a provider, but the adapter must preserve the invariant hash and remain explicitly non-canonical.

## Cross-renderer invariance

The resolver hashes each plan's shared `world_invariants` and compares that hash across providers. Provider payloads may differ radically; the invariant hash must remain identical. This is not an aesthetic similarity score. It tests whether the same declared reality survived translation.

After rendering, each provider output must be converted into an artifact observation manifest and submitted to the conformance harness. A provider's attractive material response or stylistic default is evidence about that execution, not a new WRASAL rule.

## NO_PROVIDER_CANON

The output carries an explicit `no_provider_canon: true` flag and governance statements:

- renderer output is evidence, not canon
- provider-specific material behavior is not automatically promoted
- conformance remains mandatory after render

Only governance and repeated evidence can propose a v002 change.
