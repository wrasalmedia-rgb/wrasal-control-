# WRASAL V0.1 — Reality Graph

> **REALITY FIRST. TECHNOLOGY SECOND.**

The first executable layer of the wheel within the wheel: a persistent reality
substrate that knows what an entity is, what is connected to it, where its
information came from, what is supported, what is unknown, and what happened to
it over time.

This is the engine block, not the spaceship.

## Repository boundary

`wrasal-control-` is an S2/S3 **control-plane** repository and is
implementation-neutral. This application is quarantined under `apps/` as a
construction-lab build. It is **not** control-plane state, it is not referenced
by `projects.yml`, and the root control-plane validator (`npm test` at the
repository root) neither reads nor depends on anything in this directory.
Promotion of this substrate to a product repository is a separate decision.

Construction is recorded in `work_orders/WRASAL-0012.json`.

## Run

```sh
cd apps/wrasal-reality-graph
npm install
npm start            # http://localhost:4310
npm test             # 38 vertical-slice assertions
```

The database is **PostgreSQL**. V0.1 executes its standard Postgres DDL on
[PGlite](https://pglite.dev) (Postgres 18.x compiled to WASM) so the substrate
runs with no server and seeds itself on first boot. Set `WRASAL_DATA_DIR` to
persist to disk. Moving to a hosted Postgres means adding one adapter in
`src/persistence/db.js`; no SQL and no domain code changes.

## Architecture

Domain semantics live in the domain. Nothing below is buried in UI components,
and nothing model-specific reaches the domain model.

```
src/
  domain/        vocabulary.js   the words WRASAL may use about reality
                 reality.js      the only sanctioned write surface
  persistence/   schema.sql      standard Postgres DDL, construction-ordered
                 db.js           driver port (PGlite adapter)
  authority/     authority.js    the Authority Boundary, executable
  graph/         graph.js        read-only traversal and dossier assembly
  provenance/    provenance.js   lineage walking, version deltas
  archive/       archive.js      frozen, hashed snapshots
  reasoning/     ask.js          ASK WRASAL — retrieval, not generation
  seed/          seed.js         the DUST / Miss Celia demonstration
  http/          server.js       thin transport; no domain logic
web/                             the instrument
```

## The four load-bearing ideas

### 1. Every assertion carries how it came to be known

`epistemic_status` is on entities, relationships, memories, evidence, claims,
versions, specifications and media:

| status | meaning |
| --- | --- |
| `user_supplied` | a human stated it |
| `observed` | recorded from direct observation |
| `externally_supported` | backed by an external source record |
| `generated_interpretation` | machine output — **never fact by itself** |
| `unknown` | explicitly not known — a first-class value |

Only the first three are `FACTUAL_STATUSES`. The AI cannot silently convert
inference into fact because inference is stored in a different category and
every read path respects the distinction.

### 2. Intelligence may participate in reality without owning reality

Every mutation routes through `governed()`. There is no other write path, and a
mutation that cannot name its **actor, action, source and reason** will not run.

Actions marked `canonical` — `declare_canonical`, `accept_decision`, `release`,
`archive` — are closed to AI actors absolutely. This is enforced three times
over, so that no single bug can breach it:

1. the action registry refuses the call,
2. a `CHECK` constraint forbids an AI actor from ever being stored as the
   authority behind such an event,
3. a `CHECK` constraint forbids an AI user from holding steward authority at all.

An AI actor *can* still contribute: in the seed data the Perception Engine
proposes a relationship and renders an artifact version. Both are recorded, both
are marked `generated_interpretation`, and neither is canonical.

### 3. UNKNOWN is a result, not an error

`ASK WRASAL` is deliberately **not a language model**. Every sentence it emits is
either a fixed structural phrase or a value copied verbatim out of a record,
carried with that record's id and epistemic status. It is therefore structurally
incapable of fabricating a fact.

It answers nine intents (what is known, where it came from, what evidence
supports a claim, what changed, what is canonical, what remains unknown, what is
connected, which decisions, what can be released) and returns `UNKNOWN` with a
stated reason and a record count whenever the graph cannot support an answer.

### 4. Lineage is not ownership

Provenance records derivation: `derived_from`, `version_of`, `contains`,
`incorporates`, `adapts`, `supersedes`, `related_to`, `originates_from`. Every
lineage response carries `ownership: UNKNOWN` and the standing disclaimer.
Nothing in the system infers rights from derivation.

## The vertical slice

`CREATE → TRACE → UNDERSTAND → GENERATE → ARCHIVE`, proven by
`tests/vertical-slice.test.mjs` (38 assertions, all passing):

create an entity · assign a type · relate entities · add memories · add evidence
· add claims · compute claim status from evidence links · record provenance ·
create an artifact · version it · view the graph · ask questions · receive
UNKNOWN when unsupported · archive with full context · read the complete lineage
and event history.

## Seed data

The DUST world: **Miss Celia**, the Porch House, the Pell Road Ledger, and Wray.
Four memories (one with an unknown time), three evidence records, three claims —
one supported by two independent records, one drawn from testimony, and one
deliberately left unsupported. An artifact, the *Porch Portrait*, in three
versions: a human composition, a machine render marked as interpretation, and a
human correction that supersedes it. A steward decision promotes Miss Celia to
canon; the authority event records `provisional → canonical` and who did it.

Ask *"What do I actually know about Miss Celia?"* and the unsupported ledger
claim appears under **NOT ESTABLISHED**, never among the facts.

## Not implemented in V0.1

Simulation, Memory Walker, Perception Compiler, model routing, Release World,
external integrations. The substrate reserves structure for them —
`media_assets.generation_context` is opaque JSONB precisely so the Perception
Engine can define its own semantics without the domain model learning what a
"model" is.

The Simulation screen says `UNKNOWN`. WRASAL does not display a capability it
does not have.
