# WRASAL Visual DNA Conformance Harness v001

The conformance harness is the execution boundary between Visual DNA v001 and rendered or photographed artifacts. It does not promote a good-looking specimen to canon. It evaluates structured observations made by a human reviewer or vision system and records evidence, failures, negative violations, and repeat failures.

## Pipeline

```text
VISUAL DNA → GRAMMAR → SPECIMEN → EXECUTION → OBSERVATION MANIFEST → CONFORMANCE REPORT
                                                        │
                                          canonical / inferred / negative
                                                        │
                                      blind test → failure recurrence → v002 review
```

Run:

```sh
npm run conformance:visual-dna
node scripts/wrasal-visual-dna-conformance.mjs \
  --input path/to/artifact-or-directory \
  --report evidence/WRASAL-visual-dna-conformance.json \
  --strict
```

The input may be one artifact manifest or a directory of JSON manifests. The harness is deliberately deterministic and dependency-free. It does not claim to see pixels from a filename or metadata field: every claim requires a status and human/vision evidence string. `not_observed` is not a pass.

## Manifest contract

Each artifact provides:

- `artifact_id`, optional `specimen_id`, and `source_type`
- `observations` for the ten canonical checks
- optional `inferred_observations` for the three non-canonical checks
- `blind_test`, requiring removal of logo, typography, metadata, coordinates, and gold/red indicators plus an evaluator result and rationale
- `negative_flags` from the negative DNA vocabulary
- `cultural_review` with evidence and cliché flags
- `technical_review` with evidence
- `unsupported_decisions`

The blind test is not a visual classifier. It is a forced review record for the decisive question: **does the artifact still belong to WRASAL without metadata?**

## Governance rules

1. Canonical failures are failures even when the artifact is attractive.
2. Inferred rules are tracked separately and never silently become canonical.
3. Unsupported decisions are failures until justified by function or evidence.
4. Cultural cliché flags fail cultural conformance.
5. Negative DNA flags fail conformance.
6. A specimen does not become canon because it passes. It remains a specimen.
7. A v002 candidate is only emitted when the same failure key repeats across at least two artifacts. It is a **candidate for review**, never an automatic rule promotion.
8. v002 changes require explicit review against the source archive and existing canon.

## Audit interpretation

A report can pass only when all canonical checks, blind test, cultural review, technical review, governance checks, and negative checks pass. Inferred checks are visible in the report but do not silently change v001. Use `--strict` in CI or acceptance workflows; exploratory reports may be generated without it.

The repository includes one passing and one intentionally failing fixture under `conformance-fixtures/`, demonstrating both the blind test and rejection path.
