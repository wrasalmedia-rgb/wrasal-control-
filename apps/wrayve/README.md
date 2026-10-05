# WRAYVE

**WRASAL Identity Execution System** — Arena Build Specification v0.1, vertical slice.

> WRASAL does not generate a person. WRASAL governs how an identity is represented.
>
> HeyGen generates media. WRASAL governs the identity. Freebuff preserves the evidence.

This is a self-contained prototype of one loop and nothing else:

```
IDENTITY → SNAPSHOT → LIKENESS POLICY → SCENE → EXECUTION REQUEST
  → AUTHORITY CHECK → APPROVAL → PROVIDER EXECUTION → MEDIA
  → REVIEW → PROVENANCE → FREEBUFF HANDOFF
```

## Run

```sh
cd apps/wrayve
node src/server/server.js      # or: npm start
npm test                       # 31 tests, no dependencies
```

No dependencies, no build step, no package installs. Node ≥ 20.11.

Open the console and work left to right down the rail: **IDENTITY → SCENES → EXECUTIONS → PROVENANCE → SETTINGS**.

## Layout

```
src/core/        identity, snapshot, policy, scene, authority, approval,
                 provenance, freebuff — knows nothing about any provider
src/adapters/    IdentityExecutionAdapter + MockExecutionAdapter,
                 HeyGenAdapter, RunwayAdapter, registry
src/server/      HTTP surface. The only place a provider call can originate.
public/          the cinematic console (vanilla, no framework)
tests/           §25 test scenarios 01–08 + §28 architectural test
data/            append-only event ledger + private media (git-ignored)
```

## The four concepts are never collapsed

| Concept | Lives in | Owns |
|---|---|---|
| **Identity** | `core/service.js`, `core/projection.js` | who the representation refers to |
| **Authority** | `core/authority.js` | whether WRASAL may create it |
| **Execution** | `adapters/*` | which external system generates media |
| **Evidence** | `core/event-log.js`, `GenerationEvent` | what actually happened |

## Truthfulness rules this build actually enforces

These are tested, not just documented.

1. **No invented provider behaviour.** `HeyGenAdapter` works against a *declared* contract
   (`adapters/heygen-contract.json`) that is explicitly marked
   `UNVERIFIED_IN_THIS_ENVIRONMENT`. Before any real execution it runs a live preflight.
   If the credential, the provider binding, the endpoint or a required response field is
   missing, it throws `ProviderContractError` and the run is recorded as `FAILED` with the
   missing contract element named. It never falls back to a simulated success.
2. **No synthesised identifiers.** If HeyGen answers without `data.video_id`, WRAYVE refuses
   rather than making one up.
3. **No inferred metadata.** Fields the provider does not return are recorded as `UNKNOWN`
   or `null` and listed in `unresolved_contract_fields` on the GenerationEvent.
4. **No silent dropping of direction.** SceneSpec fields the declared contract cannot express
   (camera, wardrobe, environment, performance, voice direction) are recorded on the
   GenerationEvent as `carried_but_unexecuted` — carried intent, not executed instruction.
5. **Simulation is never disguised.** A SIMULATION cannot be routed to an external provider,
   a REAL execution cannot be served by the simulation adapter, the GenerationEvent carries
   `simulated: true`, the provider is recorded as `MOCK` (never `HEYGEN`), the job id is
   prefixed `SIM-`, and the artefact itself says `SIMULATED EXECUTION — NO EXTERNAL PROVIDER
   WAS CONTACTED` on its face.
6. **No certification claims.** The Freebuff handoff is labelled `FREEBUFF HANDOFF: SIMULATED`
   and carries `certified: false` with an explicit non-certification statement.
7. **Runway is registered but honest.** No Runway contract has been established, so the
   adapter refuses at the boundary instead of guessing an API shape.

## Authority

`core/authority.js` is a pure function. It evaluates:

- identity exists and is ACTIVE
- snapshot exists and is ACTIVE
- a LikenessPolicy exists and is bound to *that* snapshot
- every context the scene **declares** is permitted by the policy
- approval is present

It returns `AUTHORIZED` or `DENIED` with a per-rule reason list.

The UI cannot bypass it: there is no API route that sets an authority or approval field, and
`service.execute()` re-runs the check server-side immediately before touching an adapter.

**The approval gate — and only the approval gate — may be waived for an execution explicitly
marked `SIMULATION`.** A policy prohibition is never waived, in any mode.

## State machine

```
DRAFT → READY_FOR_REVIEW → PENDING_APPROVAL → APPROVED → EXECUTING
      → GENERATED → REVIEWED → ARCHIVED
terminal alternatives: REJECTED · CANCELLED · FAILED
```

`lifecycle_state` is the single stored truth. `approval_status` and `execution_status` are
*derived* from it, so they can never contradict each other. Illegal transitions throw.

## Data integrity

The event log is append-only and hash-chained: every record stores the SHA-256 of the
previous record, so a retroactive edit to `data/events.jsonl` is detectable
(`GET /api/integrity`, shown bottom-left in the console). The read model is a disposable
projection rebuilt from history. Snapshots and policies are versioned, never mutated.
GenerationEvents are frozen on write.

## HeyGen configuration

Server-side environment only — see `.env.example`:

```sh
HEYGEN_API_SURFACE=v3    # or v2_legacy. No default: unset means "unverified"
HEYGEN_API_KEY=...
HEYGEN_AVATAR_ID=...     # provider binding; WRAYVE will not invent one
HEYGEN_VOICE_ID=...      # optional on v3 (avatar's default voice is used)
```

Keys are never sent to the browser. `SETTINGS` reports presence, never values. With no key
configured, real HeyGen execution fails truthfully at the adapter boundary — which is the
intended behaviour, not a bug.

### Contract status (WRASAL-0013)

Verification outcome: **HEYGEN_BLOCKED**. Nothing in `heygen-contract.json` is marked
`VERIFIED` — the whole artifact is `DOCUMENTED_NOT_OBSERVED`, because this environment has
neither a credential nor network egress to `api.heygen.com` (TLS is severed at SNI). Two
findings matter regardless:

- **The v0.1 endpoints are legacy.** HeyGen documents `POST /v2/video/generate` and
  `GET /v1/video_status.get` as sunset on **2026-10-31**, replaced by `POST /v3/videos` and
  `GET /v3/videos/{video_id}`. Both surfaces are now implemented, and **neither is
  pre-selected** — WRAYVE refuses to pick an API version on documentation alone and stops
  with `PROVIDER_SURFACE_UNVERIFIED` until an operator sets `HEYGEN_API_SURFACE`.
- **HeyGen has its own consent primitive** (`POST /v3/avatars/{group_id}/consent`, a
  24-hour browser flow at avatar-*group* granularity). It is a provider-side rendering gate.
  It evaluates no context, is not versioned against a WRASAL snapshot, and **neither
  satisfies nor is satisfied by** a WRASAL AuthorityCheck. Both gates must hold
  independently. An automated test asserts this is never collapsed.

Full record: `evidence/HEYGEN-CONTRACT-001.json`.

## Tests

```
TEST 01  valid identity + snapshot + approved scene   → AUTHORIZED
TEST 02  no approval                                  → DENIED
TEST 03  political scene                              → DENIED
TEST 04  sexualized scene                             → DENIED (not waivable by simulation)
TEST 05  inactive identity snapshot                   → DENIED
TEST 06  simulation execution                         → SIMULATED
TEST 07  real HeyGen execution (faked transport)      → provider=HEYGEN, job id non-null
TEST 08  provider failure                             → FAILED + auditable failure event
```

Plus §22 integrity tests, §27 end-to-end definition of done, and the §28 architectural test:
HeyGen is unregistered entirely and the application keeps working, with identical
Identity / Snapshot / Policy / Scene / AuthorityCheck / Provenance output. Static assertions
enforce that `src/core/**` contains no provider name and the browser bundle contains no
endpoint or credential.

## Deliberately not built (§26)

No likeness scanner, no takedown system, no biometric database, no marketplace, no social
layer, no full Freebuff, no native renderer, no tokens, no agents, no multi-user permissions,
no analytics. The objective is to prove the core loop.

## Artifact custody and the evidence ladder (WRASAL-0014)

WRASAL-0013 found that the provider's documented output URL is **presigned and
expiring**. A provenance chain that stores only that URL silently decays from
"here is the generated video" into "here is evidence that there was a video" —
while still looking like the former. WRASAL-0014 makes that difference
explicit and machine-checkable.

**The invariant:**

> An evidence record must never imply durable possession of an artifact when
> WRASAL only possesses an expiring provider reference.

It is enforced by `assertNoFalsePossessionClaim()` in `src/core/artifact.js`,
called before any Freebuff payload is emitted.

### Six reference classes

| Class | Possession | Durability | Holds bytes | Evidence ceiling |
| --- | --- | --- | --- | --- |
| `PROVIDER_REFERENCE` | NONE | UNKNOWN | no | EXECUTED |
| `PRESIGNED_REFERENCE` | NONE | EXPIRING | no | EXECUTED |
| `DURABLE_ARTIFACT` | REFERENCE_ONLY | DURABLE | no | EXECUTED |
| `CONTENT_HASH` | REFERENCE_ONLY | UNKNOWN | no | VERIFIED |
| `ARCHIVED_ARTIFACT` | BYTES_HELD | DURABLE | **yes** | ARCHIVED |
| `ARTIFACT_UNAVAILABLE` | NONE | UNKNOWN | no | OBSERVED |

### The evidence ladder

`UNKNOWN → DOCUMENTED → OBSERVED → EXECUTED → VERIFIED → ARCHIVED`

From `OBSERVED` upward the burden is strictly cumulative:
`observed_response` → `+provider_reported_completion` → `+content_hash` →
`+durable_possession`.

`DOCUMENTED` deliberately sits **off** that chain. Reading a document is a
different and weaker *kind* of evidence than watching the system behave; a
live observation must never be gated on someone having filed a documentation
reference, as that would rank "the docs say so" above "we saw it happen".

> **Provider documentation is not provider truth.** A documented field
> establishes `DOCUMENTED`. It can never establish `EXECUTED`.

The practical contrast: a local simulated run reaches `ARCHIVED`, because
WRASAL wrote and hashed the bytes itself. A *completed* real provider run
returning a presigned URL is capped at `EXECUTED`, with possession `NONE`.
Possession is not authenticity — the archived simulated artefact is still
labelled `SIMULATED EXECUTION`.

### Three identities, never collapsed

> **Providers render representations. WRASAL governs identity.**

| Identity | Record | Question it answers |
| --- | --- | --- |
| Canonical | `Identity` | Who is this person inside WRASAL? |
| Representation | `IdentitySnapshot` | Which version is authorized to be represented? |
| Provider | `ProviderBinding` | What does an external renderer happen to call them? |

`ProviderBinding{provider, provider_object_type, provider_subject_id,
binding_status, verified_at, evidence_ref}` is append-only and joins a
snapshot to a provider subject. `binding_status` is `DECLARED` when an
operator asserts it and only becomes `VERIFIED` when WRASAL has observed the
provider confirm it — `verifyProviderBinding()` refuses without an
`evidence_ref`. `HEYGEN_AVATAR_ID` therefore bootstraps a **DECLARED** binding
and never a verified one. A binding is revoked by appending, never deleted.

This gives provider portability without identity fragmentation. The dangerous
mistake — treating a HeyGen `avatar_id` as a WRASAL identity — is structurally
unavailable.

### Not built on purpose

No archival downloader. Modelling the epistemic state correctly comes first;
deciding what WRASAL *does* about expiring references is WRASAL-0015.
