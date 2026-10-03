# WRASAL-0014 — Visual Production Pilot

**Status:** execution scaffold / awaiting external renderer outputs

This pilot uses the archival laboratory intent and compiles all three manifestations:

1. Image
2. Physical object
3. Architectural environment

The repository does not claim rendered output that has not been supplied by a provider. Place provider artifact observation manifests in `artifacts/`, then run:

```sh
node scripts/wrasal-visual-production-pilot.mjs \
  --input visual_dna/execution-fixtures/WRASAL-INTENT-ARCHIVAL-LAB.json \
  --artifacts visual_dna/pilot/WRASAL-0014/artifacts \
  --review visual_dna/pilot/WRASAL-0014/review.json \
  --overrides visual_dna/pilot/WRASAL-0014/overrides.json \
  --output evidence/WRASAL-0014-production-pilot.json
```

A complete run requires three rendered artifact manifests, conformance observations for each, a human review record, and an override record. Until then the pilot reports `incomplete_or_review`, not pass.

## Evidence separation

- **Canonical:** Visual DNA rules and grammars.
- **Execution:** provider plans, renderer outputs, artifact manifests.
- **Observational:** human review, interpretation, manual overrides, and reasons.

These records must not be merged. Provider output and a successful pilot do not modify canon.
