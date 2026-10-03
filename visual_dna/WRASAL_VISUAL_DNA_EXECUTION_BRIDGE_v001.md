# WRASAL Visual DNA Execution Bridge v001

The bridge is the boundary between intent and production planning. It compiles a human-readable request into one or more execution plans without allowing the renderer or image model to redefine WRASAL's civilization.

> The Visual DNA describes the world. The execution system describes how to render evidence of that world.

## Pipeline

```text
WorldSpec → SceneSpec → Visual Intent → Visual DNA Resolver →
Camera / Material / Lighting / Environment Grammar → Execution Plan → Artifact → Conformance Harness
```

Run it with:

```sh
node scripts/wrasal-visual-dna-execution-bridge.mjs \
  --input visual_dna/execution-fixtures/WRASAL-INTENT-ARCHIVAL-LAB.json \
  --output /tmp/wrasal-execution-plans.json
```

Or use:

```sh
npm run bridge:visual-dna
```

## Input boundary

An intent must declare `intent_id`, `request`, `subject_class`, `environment`, `cultural_context`, and `temporal_state`. It may request `image`, `object`, and/or `architecture` executions, plus material overrides. Missing operational context remains explicitly unresolved in the plan; the bridge does not invent it.

## Output boundary

Each plan contains:

- world and scene requirements
- resolved canonical tokens
- camera mode and lens role
- material and lighting grammar selections
- composition and environment evidence requirements
- modular prompt layers
- a downstream conformance manifest template

The output is a plan, not an image and not a canon change. Plans are non-canonical until an actual artifact passes the conformance harness and receives review.

## One intent, multiple executions

The same intent can compile into image, object, and architectural plans. Their subject, camera, material, and composition parameters change, but the world rules, cultural constraints, temporal logic, physical interface rule, negative DNA, and evidence requirements remain shared. This is the first production-pressure proof that continuity is structural rather than a repeated filter.

## Deliberate non-features

The bridge does not:

- generate pixels or claim that a prompt is an artifact
- assign a WRASAL aesthetic score
- promote inferred rules to canon
- add arbitrary technical labels
- use a model's style preferences as hidden authority
- replace human/vision evidence in the conformance manifest
