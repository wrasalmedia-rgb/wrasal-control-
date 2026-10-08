# BUILD-001-TEST — Build Mode Loop Artifact

**Target:** Create a minimal artifact demonstrating the WRASAL Build Mode loop itself.

This artifact is intentionally small. Its companion record, `builds/BUILD-001-TEST.json`, links each required object and preserves the auditable event sequence:

1. **DEFINE** — a Build records this target in `DRAFT`.
2. **SPECIFY** — a Build Spec records the acceptance criteria in `SPECIFIED`.
3. **BUILD** — this Artifact is recorded in `BUILDING`.
4. **TEST** — a Test validates the in-progress build record in `TESTING`.
5. **EVIDENCE** — classified Evidence is routed for review in `EVIDENCE_REVIEW`.
6. **DECIDE** — a Decision records a permitted decision state in `DECIDED`.

The implementation deliberately does not add a visual interface, multi-build orchestration, or extra architecture. Those proposed capabilities are recorded as `DEFERRED` in the test build rather than implemented.

To inspect the final record:

```sh
npm run validate:build-mode
cat builds/BUILD-001-TEST.json
```
