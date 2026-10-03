# WRASAL Visual Production Pilot v001

The pilot is the first complete-loop control surface. It does not claim production success until external renderer outputs and human observations are archived.

## Pipeline

```text
intent → execution bridge → artifact resolver → provider → render → artifact manifest → conformance → human review → archive
```

The pilot runner compiles the archival laboratory fixture into image, object, and architecture plans, resolves provider-neutral plans across three adapters, inventories supplied artifact manifests, runs conformance on rendered manifests, and records human review plus manual overrides.

## Pilot gates

- **Intent preservation:** human review records whether the artifact retains the source request.
- **Visual DNA preservation:** canonical conformance checks pass.
- **Provider independence:** resolver invariant hashes remain equal across adapters.
- **Conformance:** every rendered artifact is submitted to the existing harness.
- **Human interpretation:** a reviewer recognizes intended function and world without implementation details.
- **Manual intervention:** every override has a reason and suspected system layer.

A pilot with missing render outputs is explicitly `incomplete_or_review`; the system never fabricates evidence.

## Override density

```text
override_density = human_interventions / execution_decisions
```

This is a diagnostic, not a quality score. Repeated intervention reasons are evidence about a possible gap in WorldSpec, Visual DNA, Execution Bridge, Artifact Resolver, provider adapter, or Conformance Harness. They are not automatic v002 changes.
