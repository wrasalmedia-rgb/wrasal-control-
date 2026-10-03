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
