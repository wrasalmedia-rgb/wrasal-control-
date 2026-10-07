# Overlays

Portable governance documents that sit **above** a build contract for a system
that is **not** WRASAL.

An overlay constrains how an agent executes someone else's contract. It adds no
scope to that contract and no scope to WRASAL.

Nothing in this directory is part of the WRASAL control plane:

- not listed in `projects.yml`, `priorities.yml` or `dependencies.yml`
- not a work order, and not read by `scripts/validate-control-plane.mjs`
- not a constitutional record — see `decisions/CONSTITUTIONAL-PRINCIPLES.md`
  for those, which bind WRASAL only

| Overlay | Governs | Version |
| --- | --- | --- |
| `RUNTIMESHOP-PROTECTION-LAYER.md` | RuntimeShop MVP build contract | v0.1 |
