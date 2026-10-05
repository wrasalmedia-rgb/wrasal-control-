# wrasal-control-

WRASAL portfolio-control repository.

## Purpose

This repository is an S2/S3 control surface for coordinating portfolio work recorded in this repository.

- S2 coordination: records work orders, dependencies, priorities, and routing context.
- S3 control/verification: records decisions and evidence used to verify acceptance without treating execution artifacts as project runtime state.

This repository is implementation-neutral with one recorded exception: `apps/wrayve/`. It otherwise does not contain product or runtime code for the listed projects.

## Recorded exception: `apps/wrayve/`

`apps/wrayve/` holds the WRAYVE identity-authority and execution vertical slice built under
work order `WRASAL-0012`. It is a bounded prototype, not canon, and its presence here is a
deliberate deviation from implementation neutrality rather than a change of policy.

- It is self-contained: no runtime dependencies, no build step, no coupling to the control-plane records.
- It does not read, write or validate anything under `projects.yml`, `work_orders/`, `decisions/` or `evidence/`.
- Root `npm test` continues to run control-plane validation only. The slice has its own `npm test`.
- `canonical_acceptance` for `WRASAL-0012` is `pending`.

See `apps/wrayve/README.md`.

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
