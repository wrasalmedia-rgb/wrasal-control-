# wrasal-control-

WRASAL portfolio-control repository.

## Purpose

This repository is an S2/S3 control surface for coordinating portfolio work recorded in this repository.

- S2 coordination: records work orders, dependencies, priorities, and routing context.
- S3 control/verification: records decisions and evidence used to verify acceptance without treating execution artifacts as project runtime state.

This repository is implementation-neutral. It does not contain product or runtime code for the listed projects.

## Current scaffold

- `projects.yml`: minimal project facts.
- `priorities.yml`: ordered portfolio priorities; initially empty.
- `dependencies.yml`: declared dependencies; initially empty.
- `work_orders/`: work-order records.
- `decisions/`: decision records.
- `evidence/`: evidence records.
- `concepts/`: non-runtime concept records.
- `templates/arena-work-order.md`: work-order intake template.

## Minimal data boundaries

`projects.yml` maps a project identifier to recorded facts only:

- `state`
- `objective`
- `parent`
- `organization`
- `repo`

Absence of a field means this control repository has no recorded fact for that field.

`priorities.yml` and `dependencies.yml` are empty collections until a work order establishes records.

This scaffold is not a source of project-specific runtime behavior.

## Control-plane validation

WRASAL S3 validation uses repository-pinned Node dependencies recorded in `package.json` and `package-lock.json`.

Install pinned dependencies:

```sh
npm ci
```

Validate current control-plane records:

```sh
npm run validate:control-plane
```

Run validator tests, including invalid fixture rejection:

```sh
npm test
```

Write machine-readable validation evidence:

```sh
npm run validate:control-plane -- --report evidence/WRASAL-0005-validation.json
```

The validator checks the control-plane YAML/JSON scaffold and work-order records. It is S3 tooling only; it is not WRASAL runtime/product code and does not promote canonical acceptance.

## Build Mode MVP

This repository also contains a deliberately small, file-backed **Build Mode** implementation. It is repository tooling, not runtime code for a listed portfolio project and not a workflow platform.

The only implemented loop is:

```text
DEFINE → SPECIFY → BUILD → TEST → EVIDENCE → DECIDE
```

| Loop stage | Build state | Required object recorded |
| --- | --- | --- |
| DEFINE | `DRAFT` | Build |
| SPECIFY | `SPECIFIED` | Build Spec |
| BUILD | `BUILDING` | Artifact |
| TEST | `TESTING` | Test |
| EVIDENCE | `EVIDENCE_REVIEW` | Evidence |
| DECIDE | `DECIDED` | Decision |

The implementation lives in:

- `scripts/build-mode.mjs` — state-transition CLI and record validator.
- `builds/BUILD-001-TEST.json` — the first complete auditable test build.
- `artifacts/BUILD-001-TEST.md` — its minimal artifact.
- `tests/build-mode.test.mjs` — lifecycle, authority, and anti-scope-drift checks.

Validate the shipped test build:

```sh
npm run validate:build-mode
npm run test:build-mode
```

Create another minimal build record from the repository root:

```sh
node scripts/build-mode.mjs define --file builds/BUILD-NEW.json --build-id BUILD-NEW --target "A bounded target"
node scripts/build-mode.mjs specify --file builds/BUILD-NEW.json --spec-id BUILD-NEW-SPEC --summary "Bounded implementation" --acceptance "Linked required objects and auditable events"
# Create the artifact file first, then record it:
node scripts/build-mode.mjs build --file builds/BUILD-NEW.json --artifact-id BUILD-NEW-ARTIFACT --path artifacts/BUILD-NEW.md --description "Minimal artifact"
node scripts/build-mode.mjs test --file builds/BUILD-NEW.json --test-id BUILD-NEW-TEST --artifact-id BUILD-NEW-ARTIFACT --command "node scripts/build-mode.mjs validate --file builds/BUILD-NEW.json"
node scripts/build-mode.mjs evidence --file builds/BUILD-NEW.json --evidence-id BUILD-NEW-EVIDENCE --class OBSERVED --claim "The test passed" --source "Test command output"
node scripts/build-mode.mjs decide --file builds/BUILD-NEW.json --decision-id BUILD-NEW-DECISION --state SHIP --rationale "Observed passing evidence supports shipment" --established-evidence-id BUILD-NEW-EVIDENCE
```

### Evidence authority and scope boundary

Evidence is classified as `OBSERVED`, `USER_SUPPLIED`, `THIRD_PARTY_SUPPORTED`, `INFERRED`, or `UNVERIFIED`. `INFERRED` and `UNVERIFIED` evidence is always routed as `NON_ESTABLISHING`; the validator rejects any attempt to reference it as `decision.established_evidence_id`. Other evidence is only `REVIEWABLE` until a decision explicitly references it.

The supported decision states are `SHIP`, `ITERATE`, `ARCHIVE`, `ABANDON`, and `BLOCKED`. A `SHIP` decision requires a passing Test and eligible established evidence.

A non-core proposal is recorded with the `defer` command and fixed disposition `DEFERRED`; no implementation command exists for such capabilities. `BUILD-001-TEST` records visual polish and expanded architecture this way.
