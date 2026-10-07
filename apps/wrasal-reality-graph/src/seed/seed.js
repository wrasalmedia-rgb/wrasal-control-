// Demonstration dataset.
//
// Fictional. Chosen so that a reader can watch information travel through the
// graph: an entity, its memories, the evidence behind one claim, the absence of
// evidence behind another, an artifact that versions and acquires lineage, a
// steward decision that promotes it to canon, and one thing that stays UNKNOWN.

import { id } from '../persistence/db.js';
import * as reality from '../domain/reality.js';
import { EPISTEMIC_STATUS as ES, CANONICAL_STATUS as CS, CLAIM_STATUS } from '../domain/vocabulary.js';

export async function seed(db) {
  const steward = { id: 'usr_wray', handle: 'wray', display_name: 'Wray', kind: 'human', authority_level: 'steward' };
  const archivist = { id: 'usr_archivist', handle: 'archivist', display_name: 'R. Ellison',
                      kind: 'human', authority_level: 'contributor' };
  const machine = { id: 'usr_perception', handle: 'perception', display_name: 'Perception Engine',
                    kind: 'ai', authority_level: 'author' };

  for (const u of [steward, archivist, machine]) {
    await db.query(
      `INSERT INTO users (id, handle, display_name, kind, authority_level) VALUES ($1,$2,$3,$4,$5)`,
      [u.id, u.handle, u.display_name, u.kind, u.authority_level]);
  }

  for (const t of [
    ['character', 'Character', 'A person within a world.'],
    ['person', 'Person', 'A real person of record.'],
    ['place', 'Place', 'A location.'],
    ['object', 'Object', 'A physical or depicted thing.'],
    ['work', 'Work', 'A creative work.'],
    ['event', 'Event', 'Something that happened.'],
  ]) {
    await db.query(`INSERT INTO entity_types (id, label, description) VALUES ($1,$2,$3)`, t);
  }

  const S = { db, actor: steward };
  const A = { db, actor: archivist };
  const M = { db, actor: machine };

  // --- World ---------------------------------------------------------------
  const world = await reality.createWorld(S, {
    name: 'DUST', summary: 'A Delta county in the long heat, told through what people kept.',
    source: 'Wray, founding note', reason: 'establish the DUST world as a container for reality',
  });

  // --- Entities ------------------------------------------------------------
  const celia = await reality.createEntity(S, {
    name: 'Miss Celia', entity_type_id: 'character', world_id: world.subject_id,
    summary: 'A keeper of the porch house on Pell Road; remembered as the person who held the ledger.',
    summary_epistemic_status: ES.USER_SUPPLIED,
    source: 'Wray, character bible v1', reason: 'Miss Celia is the central figure of DUST',
  });

  const wrayEnt = await reality.createEntity(S, {
    name: 'Wray', entity_type_id: 'person', world_id: world.subject_id,
    summary: 'Author of record for the DUST world.',
    source: 'self-recorded', reason: 'the author is part of the provenance chain and must exist in the graph',
  });

  const porch = await reality.createEntity(A, {
    name: 'The Porch House', entity_type_id: 'place', world_id: world.subject_id,
    summary: 'A four-room house on Pell Road with a deep front porch.',
    source: 'county plat description', reason: 'locate Miss Celia in a place',
  });

  const ledger = await reality.createEntity(A, {
    name: 'The Pell Road Ledger', entity_type_id: 'object', world_id: world.subject_id,
    summary: 'A hand-ruled account book kept at the porch house.',
    source: 'archivist intake', reason: 'the ledger is referenced by multiple claims',
  });

  // --- Relationships -------------------------------------------------------
  const rels = [
    [celia, porch, 'resides_at', ES.USER_SUPPLIED, 'Stated in the character bible.'],
    [celia, ledger, 'keeper_of', ES.USER_SUPPLIED, 'Stated in the character bible.'],
    [wrayEnt, celia, 'author_of', ES.USER_SUPPLIED, 'Authorship of the character.'],
    [ledger, porch, 'located_at', ES.EXTERNALLY_SUPPORTED, 'Placed by the county inventory sheet.'],
  ];
  for (const [a, b, predicate, es, note] of rels) {
    await reality.createRelationship(S, {
      source_entity_id: a.subject_id, target_entity_id: b.subject_id, predicate,
      epistemic_status: es, note, source: 'DUST world notes', reason: 'connect related entities',
    });
  }

  // A machine-proposed edge. Present in the graph, but marked as interpretation
  // and left provisional — the AI participated without owning anything.
  await reality.createRelationship(M, {
    source_entity_id: porch.subject_id, target_entity_id: wrayEnt.subject_id,
    predicate: 'possibly_photographed_by', epistemic_status: ES.GENERATED_INTERPRETATION,
    status: CS.PROVISIONAL,
    note: 'Proposed by similarity between the porch photograph and other images attributed to Wray. Not verified.',
    source: 'Perception Engine similarity pass', reason: 'surface a candidate connection for human review',
  });

  // --- Memories ------------------------------------------------------------
  const memories = [
    ['She kept the porch light burning through the whole of the dry season, and never once said why.',
     '1974-08-01T00:00:00Z', ES.USER_SUPPLIED, 0.9],
    ['The ledger was written in two hands. The second hand begins partway down a page, mid-entry.',
     null, ES.OBSERVED, 1.0],
    ['Neighbours recalled her reading aloud from the ledger on Sunday evenings.',
     '1976-01-01T00:00:00Z', ES.EXTERNALLY_SUPPORTED, 0.6],
    ['She may have left the county before the flood. This has not been established.',
     null, ES.UNKNOWN, null],
  ];
  for (const [body, occurred_at, epistemic_status, confidence] of memories) {
    await reality.recordMemory(A, {
      entity_id: celia.subject_id, body, occurred_at, epistemic_status, confidence,
      source: 'archivist intake interview series', reason: 'preserve recollection attached to Miss Celia',
    });
  }

  // --- Evidence ------------------------------------------------------------
  const ev1 = await reality.recordEvidence(A, {
    entity_id: celia.subject_id, title: 'Pell Road Ledger, pages 31–34',
    source: 'County Archive, box 12, folder 3', source_kind: 'document',
    observed_result: 'Four pages of ruled accounts signed "C." at the foot of each page; second hand begins on page 33.',
    epistemic_status: ES.EXTERNALLY_SUPPORTED,
    reason: 'primary document behind the ledger claims',
  });

  const ev2 = await reality.recordEvidence(A, {
    entity_id: celia.subject_id, title: 'Porch photograph, undated',
    source: 'Family holding, donated 1998', source_kind: 'photograph',
    observed_result: 'A woman seated on a deep porch, ledger-sized book on her lap. No inscription, no date.',
    epistemic_status: ES.OBSERVED,
    reason: 'the only image associated with Miss Celia',
  });

  const ev3 = await reality.recordEvidence(A, {
    entity_id: celia.subject_id, title: 'Interview transcript, M. Boyd',
    source: 'Oral history programme, tape 7', source_kind: 'testimony',
    observed_result: 'Boyd states the Sunday readings happened "most weeks, as I remember it."',
    epistemic_status: ES.EXTERNALLY_SUPPORTED,
    reason: 'testimony concerning the Sunday readings',
  });

  // --- Claims --------------------------------------------------------------
  const claim1 = await reality.assertClaim(S, {
    entity_id: celia.subject_id, statement: 'Miss Celia kept the Pell Road Ledger.',
    source: 'Wray, character bible v1', reason: 'central claim of the character',
  });
  await reality.linkClaimEvidence(A, { claim_id: claim1.subject_id, evidence_id: ev1.subject_id,
    stance: 'supports', source: 'archivist review', reason: 'the ledger signature supports the claim' });
  await reality.linkClaimEvidence(A, { claim_id: claim1.subject_id, evidence_id: ev2.subject_id,
    stance: 'supports', source: 'archivist review', reason: 'the photograph depicts her holding a ledger-sized book' });

  const claim2 = await reality.assertClaim(S, {
    entity_id: celia.subject_id, statement: 'Miss Celia wrote the second hand in the ledger.',
    source: 'Wray, working hypothesis', reason: 'open question about authorship of the ledger',
  });
  // Deliberately left with no evidence links. This is the UNKNOWN specimen.

  const claim3 = await reality.assertClaim(A, {
    entity_id: celia.subject_id, statement: 'Miss Celia read aloud from the ledger on Sunday evenings.',
    source: 'oral history programme', reason: 'claim drawn from testimony',
  });
  await reality.linkClaimEvidence(A, { claim_id: claim3.subject_id, evidence_id: ev3.subject_id,
    stance: 'supports', source: 'archivist review', reason: 'Boyd testimony' });

  // --- Story ---------------------------------------------------------------
  await reality.createStory(S, {
    world_id: world.subject_id, title: 'DUST', logline: 'What a county keeps, and who is allowed to read it.',
    source: 'Wray', reason: 'record the governing story of the world',
  });

  // --- Specification -------------------------------------------------------
  await reality.createSpecification(S, {
    entity_id: celia.subject_id, title: 'Miss Celia — depiction specification',
    body: {
      age_range: '60s', wardrobe: 'dark cotton dress, collar buttoned', setting: 'deep porch, late afternoon',
      must_include: ['ledger-sized book', 'porch light'],
      must_not_include: ['modern objects'],
      unresolved: ['eye colour — no evidence of record'],
    },
    source: 'Wray, depiction notes', reason: 'constrain any future depiction of Miss Celia',
  });

  // --- Artifact + versions + provenance ------------------------------------
  const artifact = await reality.createArtifact(S, {
    entity_id: celia.subject_id, world_id: world.subject_id,
    name: 'Porch Portrait', kind: 'image',
    source: 'Wray, production plan', reason: 'produce a depiction of Miss Celia for DUST',
  });

  await reality.recordProvenance(A, {
    subject_kind: 'artifact', subject_id: artifact.subject_id,
    origin: 'Composed from the undated porch photograph held in the county archive.',
    creator: 'Wray', source: 'Family holding, donated 1998',
    relation: 'derived_from', related_kind: 'evidence', related_id: ev2.subject_id,
    note: 'Derivation recorded for lineage. This does not establish rights in the source photograph.',
    source_statement: 'archivist intake', reason: 'record where the artifact came from',
  });

  const v1 = await reality.createArtifactVersion(S, {
    artifact_id: artifact.subject_id, change_summary: 'Initial composition from the porch photograph.',
    body: 'Seated figure, porch, late afternoon. Ledger on lap.', epistemic_status: ES.USER_SUPPLIED,
    source: 'Wray', reason: 'first version',
  });

  const v2 = await reality.createArtifactVersion(M, {
    artifact_id: artifact.subject_id,
    change_summary: 'Rendering pass. Lighting resolved to late-afternoon west light; porch depth increased.',
    body: 'Seated figure, porch, late afternoon, west light raking across the boards. Ledger on lap.',
    epistemic_status: ES.GENERATED_INTERPRETATION,
    source: 'Perception Engine render request', reason: 'produce a rendered interpretation of version 1',
  });

  await reality.registerMedia(M, {
    artifact_version_id: v2.subject_id, uri: 'wrasal://media/porch-portrait-v2',
    media_type: 'image/png',
    generation_context: {
      requested_by: 'usr_wray', resolved_by: 'perception_engine',
      specification_applied: 'Miss Celia — depiction specification',
      renderer: 'external model (identity not asserted by the domain model)',
      note: 'WRASAL decided what should be generated. The external renderer decided how it was drawn.',
    },
    source: 'Perception Engine', reason: 'register the rendered asset against its version',
  });

  const v3 = await reality.createArtifactVersion(S, {
    artifact_id: artifact.subject_id,
    change_summary: 'Human correction: collar buttoned per depiction specification; modern lamp removed.',
    body: 'Seated figure, porch, late afternoon, west light. Collar buttoned. Ledger on lap.',
    epistemic_status: ES.USER_SUPPLIED,
    source: 'Wray, review against depiction specification', reason: 'correct the rendered version against the spec',
  });

  await reality.recordProvenance(S, {
    subject_kind: 'artifact_version', subject_id: v3.subject_id,
    origin: 'Human correction of the rendered version.', creator: 'Wray',
    relation: 'supersedes', related_kind: 'artifact_version', related_id: v2.subject_id,
    note: 'Version 3 is the authoritative depiction; version 2 remains in the record.',
    source_statement: 'Wray', reason: 'record that v3 supersedes v2',
  });

  // --- Governed canonical promotion ---------------------------------------
  const decision = await reality.proposeDecision(S, {
    subject_kind: 'entity', subject_id: celia.subject_id,
    question: 'Is Miss Celia canonical within DUST?',
    rationale: 'Two independent evidence records support the central claim; the depiction specification is settled.',
    source: 'Wray', reason: 'open a governed decision before changing authoritative state',
  });

  await reality.declareCanonical(S, {
    subject_kind: 'entity', subject_id: celia.subject_id, status: CS.CANONICAL,
    decision_id: decision.new_state.decision_id,
    resolution: 'Accepted. Miss Celia is canonical within DUST.',
    source: 'steward declaration by Wray',
    reason: 'the central claim is supported by two evidence records and the decision was accepted',
  });

  await reality.declareCanonical(S, {
    subject_kind: 'artifact', subject_id: artifact.subject_id, status: CS.CANONICAL,
    source: 'steward declaration by Wray',
    reason: 'version 3 conforms to the depiction specification and supersedes the rendered version',
  });

  return {
    world_id: world.subject_id,
    celia_id: celia.subject_id,
    artifact_id: artifact.subject_id,
    unresolved_claim_id: claim2.subject_id,
    users: { steward, archivist, machine },
  };
}
