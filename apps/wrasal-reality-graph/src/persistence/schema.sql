-- WRASAL V0.1 — Reality Graph substrate
-- PostgreSQL DDL. Authored for standard Postgres; executed in V0.1 on PGlite (Postgres 18.x, WASM).
--
-- Construction order enforced by this file:
--   1. vocabularies  2. actors/authority  3. reality  4. graph  5. evidence/claims
--   6. provenance    7. artifacts         8. narrative 9. governance 10. archive 11. audit spine
--
-- Governing rule: REALITY FIRST. TECHNOLOGY SECOND.
-- No table in this file encodes a model, vendor, or UI concern.

-- ---------------------------------------------------------------------------
-- 1. VOCABULARIES
-- ---------------------------------------------------------------------------

-- How a given piece of information came to be known. This is the spine of the
-- "AI must never silently convert inference into fact" principle. Every record
-- that asserts something about reality carries one of these.
CREATE TYPE epistemic_status AS ENUM (
  'user_supplied',            -- a human stated it
  'observed',                 -- recorded from direct observation/capture
  'externally_supported',     -- backed by an external source record
  'generated_interpretation', -- produced by a machine; NEVER fact by itself
  'unknown'                   -- explicitly not known; a first-class value
);

-- Whether the reality layer treats a record as settled.
CREATE TYPE canonical_status AS ENUM (
  'canonical',
  'provisional',
  'disputed',
  'superseded',
  'unknown'
);

-- Resolution state of a claim.
CREATE TYPE claim_status AS ENUM (
  'supported',
  'disputed',
  'unresolved',
  'refuted',
  'unknown'
);

-- Kind of actor. Used by the authority model, not for display.
CREATE TYPE actor_kind AS ENUM (
  'human',
  'ai',
  'system'
);

-- What an actor is permitted to do to canonical reality.
CREATE TYPE authority_level AS ENUM (
  'observer',   -- read only
  'contributor',-- may add non-canonical records
  'author',     -- may add records and propose canonical change
  'steward'     -- may declare canonical state
);

-- Lifecycle of a proposal that would change authoritative state.
CREATE TYPE decision_status AS ENUM (
  'proposed',
  'accepted',
  'rejected',
  'deferred'
);

-- ---------------------------------------------------------------------------
-- 2. ACTORS
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  handle          TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  kind            actor_kind NOT NULL DEFAULT 'human',
  authority_level authority_level NOT NULL DEFAULT 'contributor',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- An AI actor may never hold steward authority. Enforced in the database so
  -- the rule survives any application bug.
  CONSTRAINT ai_may_not_be_steward
    CHECK (NOT (kind = 'ai' AND authority_level = 'steward'))
);

-- ---------------------------------------------------------------------------
-- 3. REALITY
-- ---------------------------------------------------------------------------

CREATE TABLE entity_types (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT
);

CREATE TABLE worlds (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  summary     TEXT,
  status      canonical_status NOT NULL DEFAULT 'provisional',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The central primitive. Deliberately small.
CREATE TABLE entities (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  entity_type_id TEXT NOT NULL REFERENCES entity_types(id),
  world_id      TEXT REFERENCES worlds(id),
  status        canonical_status NOT NULL DEFAULT 'provisional',
  summary       TEXT,
  summary_epistemic_status epistemic_status NOT NULL DEFAULT 'user_supplied',
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

CREATE INDEX entities_world_idx ON entities(world_id);
CREATE INDEX entities_type_idx  ON entities(entity_type_id);
CREATE INDEX entities_name_idx  ON entities(lower(name));

-- ---------------------------------------------------------------------------
-- 4. GRAPH
-- ---------------------------------------------------------------------------
-- Relationships are typed, directed, and themselves epistemically qualified:
-- a connection asserted by a machine is not the same fact as one asserted by a
-- human, and the graph must be able to tell you which it is.

CREATE TABLE relationships (
  id               TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  predicate        TEXT NOT NULL,
  epistemic_status epistemic_status NOT NULL DEFAULT 'user_supplied',
  status           canonical_status NOT NULL DEFAULT 'provisional',
  note             TEXT,
  created_by       TEXT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_relationship CHECK (source_entity_id <> target_entity_id),
  CONSTRAINT unique_edge UNIQUE (source_entity_id, target_entity_id, predicate)
);

CREATE INDEX relationships_source_idx ON relationships(source_entity_id);
CREATE INDEX relationships_target_idx ON relationships(target_entity_id);

-- ---------------------------------------------------------------------------
-- 5. MEMORY, EVIDENCE, CLAIMS
-- ---------------------------------------------------------------------------

CREATE TABLE memories (
  id               TEXT PRIMARY KEY,
  entity_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  occurred_at      TIMESTAMPTZ,       -- NULL means: when it happened is unknown
  epistemic_status epistemic_status NOT NULL DEFAULT 'user_supplied',
  confidence       NUMERIC(3,2),      -- NULL means: confidence is unknown
  recorded_by      TEXT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX memories_entity_idx ON memories(entity_id);

CREATE TABLE evidence (
  id               TEXT PRIMARY KEY,
  entity_id        TEXT REFERENCES entities(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  source           TEXT NOT NULL,     -- where it came from, verbatim
  source_kind      TEXT NOT NULL,     -- document | photograph | testimony | file | external_record
  observed_result  TEXT NOT NULL,     -- what the evidence actually shows
  epistemic_status epistemic_status NOT NULL DEFAULT 'externally_supported',
  recorded_by      TEXT NOT NULL REFERENCES users(id),
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evidence_is_not_generated
    CHECK (epistemic_status <> 'generated_interpretation')
);

CREATE INDEX evidence_entity_idx ON evidence(entity_id);

CREATE TABLE claims (
  id               TEXT PRIMARY KEY,
  entity_id        TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  statement        TEXT NOT NULL,
  status           claim_status NOT NULL DEFAULT 'unresolved',
  epistemic_status epistemic_status NOT NULL DEFAULT 'user_supplied',
  asserted_by      TEXT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX claims_entity_idx ON claims(entity_id);

-- A claim is supported only through explicit links to evidence records.
-- Support is never implied by proximity, similarity, or model output.
CREATE TABLE claim_evidence (
  claim_id    TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  stance      TEXT NOT NULL DEFAULT 'supports', -- supports | contradicts
  linked_by   TEXT NOT NULL REFERENCES users(id),
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, evidence_id),
  CONSTRAINT stance_vocabulary CHECK (stance IN ('supports', 'contradicts'))
);

-- ---------------------------------------------------------------------------
-- 6. PROVENANCE
-- ---------------------------------------------------------------------------
-- Lineage relationships describe derivation. They do NOT imply ownership.

CREATE TABLE provenance_records (
  id             TEXT PRIMARY KEY,
  subject_kind   TEXT NOT NULL,   -- entity | artifact | artifact_version | media_asset
  subject_id     TEXT NOT NULL,
  origin         TEXT NOT NULL,   -- human statement of where it came from
  creator        TEXT,            -- NULL means: creator unknown
  source         TEXT,
  relation       TEXT NOT NULL,   -- derived_from | version_of | contains | incorporates |
                                  -- adapts | supersedes | related_to | originates_from
  related_kind   TEXT,
  related_id     TEXT,
  note           TEXT,
  recorded_by    TEXT NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provenance_relation_vocabulary CHECK (relation IN (
    'derived_from','version_of','contains','incorporates',
    'adapts','supersedes','related_to','originates_from'
  )),
  CONSTRAINT provenance_subject_vocabulary CHECK (subject_kind IN (
    'entity','artifact','artifact_version','media_asset'
  ))
);

CREATE INDEX provenance_subject_idx ON provenance_records(subject_kind, subject_id);
CREATE INDEX provenance_related_idx ON provenance_records(related_kind, related_id);

-- ---------------------------------------------------------------------------
-- 7. ARTIFACTS & MEDIA
-- ---------------------------------------------------------------------------

CREATE TABLE artifacts (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT REFERENCES entities(id) ON DELETE SET NULL,
  world_id    TEXT REFERENCES worlds(id),
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,  -- prose | image | specification | document | sequence
  status      canonical_status NOT NULL DEFAULT 'provisional',
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX artifacts_entity_idx ON artifacts(entity_id);

CREATE TABLE artifact_versions (
  id               TEXT PRIMARY KEY,
  artifact_id      TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_number   INTEGER NOT NULL,
  body             TEXT,
  change_summary   TEXT NOT NULL,
  epistemic_status epistemic_status NOT NULL DEFAULT 'user_supplied',
  created_by       TEXT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_version UNIQUE (artifact_id, version_number)
);

CREATE TABLE media_assets (
  id                  TEXT PRIMARY KEY,
  artifact_version_id TEXT REFERENCES artifact_versions(id) ON DELETE CASCADE,
  uri                 TEXT NOT NULL,
  media_type          TEXT NOT NULL,
  -- Generation context is stored as an opaque record. The domain model does not
  -- know what a "model" is; the Perception Engine will interpret this later.
  generation_context  JSONB,
  epistemic_status    epistemic_status NOT NULL DEFAULT 'observed',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 8. NARRATIVE & SPECIFICATION
-- ---------------------------------------------------------------------------

CREATE TABLE stories (
  id         TEXT PRIMARY KEY,
  world_id   TEXT REFERENCES worlds(id),
  title      TEXT NOT NULL,
  logline    TEXT,
  status     canonical_status NOT NULL DEFAULT 'provisional',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE specifications (
  id               TEXT PRIMARY KEY,
  entity_id        TEXT REFERENCES entities(id) ON DELETE CASCADE,
  artifact_id      TEXT REFERENCES artifacts(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  body             JSONB NOT NULL,  -- structured description of a creative object
  epistemic_status epistemic_status NOT NULL DEFAULT 'user_supplied',
  status           canonical_status NOT NULL DEFAULT 'provisional',
  created_by       TEXT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 9. GOVERNANCE
-- ---------------------------------------------------------------------------

CREATE TABLE decisions (
  id            TEXT PRIMARY KEY,
  subject_kind  TEXT NOT NULL,
  subject_id    TEXT NOT NULL,
  question      TEXT NOT NULL,
  resolution    TEXT,
  status        decision_status NOT NULL DEFAULT 'proposed',
  rationale     TEXT,
  proposed_by   TEXT NOT NULL REFERENCES users(id),
  decided_by    TEXT REFERENCES users(id),
  proposed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at    TIMESTAMPTZ
);

CREATE INDEX decisions_subject_idx ON decisions(subject_kind, subject_id);

-- The record of what reality currently holds to be true, and under whose hand.
CREATE TABLE canonical_states (
  id            TEXT PRIMARY KEY,
  subject_kind  TEXT NOT NULL,
  subject_id    TEXT NOT NULL,
  status        canonical_status NOT NULL,
  decision_id   TEXT REFERENCES decisions(id),
  declared_by   TEXT NOT NULL REFERENCES users(id),
  declared_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ
);

CREATE INDEX canonical_states_subject_idx ON canonical_states(subject_kind, subject_id);

CREATE TABLE releases (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  world_id    TEXT REFERENCES worlds(id),
  notes       TEXT,
  released_by TEXT NOT NULL REFERENCES users(id),
  released_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. ARCHIVE
-- ---------------------------------------------------------------------------
-- An archive record is a frozen, self-contained snapshot. It stores the full
-- captured context as JSONB so the archive remains readable even if the live
-- graph later changes or loses rows.

CREATE TABLE archive_records (
  id             TEXT PRIMARY KEY,
  subject_kind   TEXT NOT NULL,
  subject_id     TEXT NOT NULL,
  snapshot       JSONB NOT NULL,
  snapshot_hash  TEXT NOT NULL,
  reason         TEXT NOT NULL,
  archived_by    TEXT NOT NULL REFERENCES users(id),
  archived_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX archive_subject_idx ON archive_records(subject_kind, subject_id);

-- ---------------------------------------------------------------------------
-- 11. AUDIT SPINE
-- ---------------------------------------------------------------------------

-- Narrative timeline: what happened, in order, to a thing.
CREATE TABLE events (
  id           TEXT PRIMARY KEY,
  subject_kind TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  kind         TEXT NOT NULL,
  description  TEXT NOT NULL,
  actor_id     TEXT REFERENCES users(id),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_subject_idx ON events(subject_kind, subject_id);

-- Authority spine: every meaningful state transition, with the authority under
-- which it was made. Append-only by convention and by the revoke below.
CREATE TABLE authority_events (
  id              TEXT PRIMARY KEY,
  actor_id        TEXT NOT NULL REFERENCES users(id),
  actor_kind      actor_kind NOT NULL,
  authority_level authority_level NOT NULL,
  action          TEXT NOT NULL,
  subject_kind    TEXT NOT NULL,
  subject_id      TEXT NOT NULL,
  previous_state  JSONB,
  new_state       JSONB,
  source          TEXT NOT NULL,
  reason          TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- An AI actor can never be the authority behind a canonical declaration.
  CONSTRAINT ai_may_not_declare_canon
    CHECK (NOT (actor_kind = 'ai' AND action IN ('declare_canonical', 'accept_decision', 'release')))
);

CREATE INDEX authority_subject_idx ON authority_events(subject_kind, subject_id);
CREATE INDEX authority_actor_idx   ON authority_events(actor_id);
