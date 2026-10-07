// Graph layer. Read-only traversal and assembly of the Reality Graph.
// No writes happen here; this module answers "what is connected to what".

export async function listEntities(db, { world_id } = {}) {
  const { rows } = await db.query(
    `SELECT e.*, t.label AS type_label,
            (SELECT count(*)::int FROM relationships r
              WHERE r.source_entity_id = e.id OR r.target_entity_id = e.id) AS degree
       FROM entities e JOIN entity_types t ON t.id = e.entity_type_id
      WHERE ($1::text IS NULL OR e.world_id = $1)
      ORDER BY e.name`,
    [world_id ?? null],
  );
  return rows;
}

export async function listEntityTypes(db) {
  return (await db.query(`SELECT * FROM entity_types ORDER BY label`)).rows;
}

export async function listWorlds(db) {
  return (await db.query(`SELECT * FROM worlds ORDER BY name`)).rows;
}

/** Full dossier for one entity: everything reality holds about it. */
export async function entityDossier(db, entityId) {
  const entity = (await db.query(
    `SELECT e.*, t.label AS type_label, w.name AS world_name
       FROM entities e
       JOIN entity_types t ON t.id = e.entity_type_id
       LEFT JOIN worlds w ON w.id = e.world_id
      WHERE e.id = $1`, [entityId])).rows[0];
  if (!entity) return null;

  const [memories, evidence, claims, outgoing, incoming, artifacts, specifications,
         provenance, decisions, canonical, archives, timeline, authority] = await Promise.all([
    db.query(`SELECT m.*, u.display_name AS recorded_by_name FROM memories m
                JOIN users u ON u.id = m.recorded_by
               WHERE m.entity_id = $1 ORDER BY coalesce(m.occurred_at, m.created_at)`, [entityId]),
    db.query(`SELECT * FROM evidence WHERE entity_id = $1 ORDER BY recorded_at`, [entityId]),
    db.query(
      `SELECT c.*,
              coalesce(json_agg(json_build_object(
                'evidence_id', ce.evidence_id, 'stance', ce.stance, 'title', ev.title, 'source', ev.source
              ) ORDER BY ce.evidence_id) FILTER (WHERE ce.evidence_id IS NOT NULL), '[]') AS support
         FROM claims c
         LEFT JOIN claim_evidence ce ON ce.claim_id = c.id
         LEFT JOIN evidence ev ON ev.id = ce.evidence_id
        WHERE c.entity_id = $1
        GROUP BY c.id ORDER BY c.created_at`, [entityId]),
    db.query(`SELECT r.*, e.name AS target_name, e.status AS target_status
                FROM relationships r JOIN entities e ON e.id = r.target_entity_id
               WHERE r.source_entity_id = $1 ORDER BY r.predicate`, [entityId]),
    db.query(`SELECT r.*, e.name AS source_name, e.status AS source_status
                FROM relationships r JOIN entities e ON e.id = r.source_entity_id
               WHERE r.target_entity_id = $1 ORDER BY r.predicate`, [entityId]),
    db.query(
      `SELECT a.*, coalesce(json_agg(json_build_object(
                'id', v.id, 'version_number', v.version_number, 'change_summary', v.change_summary,
                'epistemic_status', v.epistemic_status, 'created_at', v.created_at, 'body', v.body
              ) ORDER BY v.version_number) FILTER (WHERE v.id IS NOT NULL), '[]') AS versions
         FROM artifacts a LEFT JOIN artifact_versions v ON v.artifact_id = a.id
        WHERE a.entity_id = $1 GROUP BY a.id ORDER BY a.created_at`, [entityId]),
    db.query(`SELECT * FROM specifications WHERE entity_id = $1 ORDER BY created_at`, [entityId]),
    db.query(`SELECT * FROM provenance_records
               WHERE (subject_kind = 'entity' AND subject_id = $1)
                  OR (related_kind = 'entity' AND related_id = $1)
               ORDER BY created_at`, [entityId]),
    db.query(`SELECT d.*, p.display_name AS proposed_by_name, s.display_name AS decided_by_name
                FROM decisions d JOIN users p ON p.id = d.proposed_by
                LEFT JOIN users s ON s.id = d.decided_by
               WHERE d.subject_kind = 'entity' AND d.subject_id = $1 ORDER BY d.proposed_at`, [entityId]),
    db.query(`SELECT cs.*, u.display_name AS declared_by_name FROM canonical_states cs
                JOIN users u ON u.id = cs.declared_by
               WHERE cs.subject_kind = 'entity' AND cs.subject_id = $1 ORDER BY cs.declared_at`, [entityId]),
    db.query(`SELECT id, subject_kind, subject_id, reason, archived_at, snapshot_hash
                FROM archive_records WHERE subject_id = $1 OR snapshot->>'entity_id' = $1
               ORDER BY archived_at`, [entityId]),
    db.query(`SELECT ev.*, u.display_name AS actor_name FROM events ev
                LEFT JOIN users u ON u.id = ev.actor_id
               WHERE ev.subject_id = $1 ORDER BY ev.occurred_at`, [entityId]),
    db.query(`SELECT ae.*, u.display_name AS actor_name FROM authority_events ae
                JOIN users u ON u.id = ae.actor_id
               WHERE ae.subject_id = $1 ORDER BY ae.occurred_at`, [entityId]),
  ]);

  return {
    entity,
    memories: memories.rows,
    evidence: evidence.rows,
    claims: claims.rows,
    relationships: { outgoing: outgoing.rows, incoming: incoming.rows },
    artifacts: artifacts.rows,
    specifications: specifications.rows,
    provenance: provenance.rows,
    decisions: decisions.rows,
    canonical_states: canonical.rows,
    archive_records: archives.rows,
    timeline: timeline.rows,
    authority_events: authority.rows,
  };
}

/** Node/edge projection for the graph view. */
export async function graphProjection(db, { world_id = null, focus = null, depth = 2 } = {}) {
  const entities = await listEntities(db, { world_id });
  const { rows: edges } = await db.query(
    `SELECT r.id, r.source_entity_id, r.target_entity_id, r.predicate, r.epistemic_status, r.status
       FROM relationships r`,
  );

  let nodes = entities;
  let links = edges;

  if (focus) {
    const keep = new Set([focus]);
    for (let d = 0; d < depth; d += 1) {
      for (const e of edges) {
        if (keep.has(e.source_entity_id)) keep.add(e.target_entity_id);
        else if (keep.has(e.target_entity_id)) keep.add(e.source_entity_id);
      }
    }
    nodes = entities.filter((n) => keep.has(n.id));
    links = edges.filter((e) => keep.has(e.source_entity_id) && keep.has(e.target_entity_id));
  }

  // Satellite nodes: the attached record classes, so the graph shows reality
  // rather than only entity-to-entity wiring.
  const ids = nodes.map((n) => n.id);
  const satellites = [];
  if (ids.length) {
    const counts = await db.query(
      `SELECT e.id,
              (SELECT count(*)::int FROM memories m WHERE m.entity_id = e.id) AS memories,
              (SELECT count(*)::int FROM evidence v WHERE v.entity_id = e.id) AS evidence,
              (SELECT count(*)::int FROM claims c WHERE c.entity_id = e.id) AS claims,
              (SELECT count(*)::int FROM artifacts a WHERE a.entity_id = e.id) AS artifacts
         FROM entities e WHERE e.id = ANY($1)`, [ids],
    );
    for (const row of counts.rows) {
      for (const kind of ['memories', 'evidence', 'claims', 'artifacts']) {
        if (row[kind] > 0) satellites.push({ entity_id: row.id, kind, count: row[kind] });
      }
    }
  }

  return { nodes, links, satellites };
}

/** Everything attached to a world. */
export async function worldOverview(db, worldId) {
  const world = (await db.query(`SELECT * FROM worlds WHERE id = $1`, [worldId])).rows[0];
  if (!world) return null;
  const [entities, stories, artifacts] = await Promise.all([
    db.query(`SELECT id, name, status, entity_type_id FROM entities WHERE world_id = $1 ORDER BY name`, [worldId]),
    db.query(`SELECT * FROM stories WHERE world_id = $1 ORDER BY created_at`, [worldId]),
    db.query(`SELECT * FROM artifacts WHERE world_id = $1 ORDER BY created_at`, [worldId]),
  ]);
  return { world, entities: entities.rows, stories: stories.rows, artifacts: artifacts.rows };
}
