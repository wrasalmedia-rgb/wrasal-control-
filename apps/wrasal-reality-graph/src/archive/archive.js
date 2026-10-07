// Archive layer.
// An archive record freezes a complete, self-describing snapshot and hashes it.
// Re-archiving the same unchanged subject must produce the same hash.

import crypto from 'node:crypto';
import { governed } from '../authority/authority.js';
import { id } from '../persistence/db.js';
import { lineageOf } from '../provenance/provenance.js';

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export async function captureArtifactSnapshot(db, artifactId) {
  const artifact = (await db.query(`SELECT * FROM artifacts WHERE id = $1`, [artifactId])).rows[0];
  if (!artifact) throw new Error(`No such artifact: ${artifactId}`);

  const [versions, media, provenance, decisions, canonical, entity, evidence] = await Promise.all([
    db.query(`SELECT * FROM artifact_versions WHERE artifact_id = $1 ORDER BY version_number`, [artifactId]),
    db.query(`SELECT m.* FROM media_assets m
                JOIN artifact_versions v ON v.id = m.artifact_version_id
               WHERE v.artifact_id = $1`, [artifactId]),
    db.query(`SELECT * FROM provenance_records
               WHERE (subject_kind='artifact' AND subject_id=$1)
                  OR (related_kind='artifact' AND related_id=$1)
                  OR subject_id IN (SELECT id FROM artifact_versions WHERE artifact_id=$1)`, [artifactId]),
    db.query(`SELECT * FROM decisions WHERE subject_kind='artifact' AND subject_id=$1`, [artifactId]),
    db.query(`SELECT * FROM canonical_states WHERE subject_kind='artifact' AND subject_id=$1`, [artifactId]),
    artifact.entity_id
      ? db.query(`SELECT * FROM entities WHERE id = $1`, [artifact.entity_id])
      : Promise.resolve({ rows: [] }),
    artifact.entity_id
      ? db.query(`SELECT * FROM evidence WHERE entity_id = $1`, [artifact.entity_id])
      : Promise.resolve({ rows: [] }),
  ]);

  const lineage = await lineageOf(db, 'artifact', artifactId);

  return {
    artifact,
    entity_id: artifact.entity_id,
    entity: entity.rows[0] ?? null,
    versions: versions.rows,
    media_assets: media.rows,
    provenance: provenance.rows,
    lineage: { ancestors: lineage.ancestors, descendants: lineage.descendants },
    supporting_evidence: evidence.rows,
    decisions: decisions.rows,
    canonical_status: artifact.status,
    canonical_history: canonical.rows,
    created_at: artifact.created_at,
  };
}

export async function archiveArtifact(ctx, { artifact_id, reason, source }) {
  const snapshot = await captureArtifactSnapshot(ctx.db, artifact_id);
  const hash = crypto.createHash('sha256').update(stableStringify(snapshot)).digest('hex');

  return governed(ctx, {
    action: 'archive', subject_kind: 'artifact', subject_id: artifact_id,
    source: source ?? 'operator archive request',
    reason: reason ?? 'preserve artifact and its full context',
    previous_state: { archived: false, status: snapshot.artifact.status },
  }, async (tx) => {
    const archiveId = id('arc');
    await tx.query(
      `INSERT INTO archive_records (id, subject_kind, subject_id, snapshot, snapshot_hash, reason, archived_by)
       VALUES ($1,'artifact',$2,$3,$4,$5,$6)`,
      [archiveId, artifact_id, JSON.stringify({ ...snapshot, archived_hash_basis: true }),
       hash, reason ?? 'preserve artifact and its full context', ctx.actor.id],
    );
    await tx.query(`UPDATE artifacts SET archived_at = now() WHERE id = $1`, [artifact_id]);
    return {
      subject_id: artifact_id,
      archive_id: archiveId,
      snapshot_hash: hash,
      new_state: { archived: true, archive_id: archiveId, snapshot_hash: hash },
      description: `Artifact archived with full context (${snapshot.versions.length} version(s), ` +
                   `${snapshot.provenance.length} provenance record(s)). Hash ${hash.slice(0, 12)}.`,
    };
  });
}

export async function listArchive(db) {
  return (await db.query(
    `SELECT a.id, a.subject_kind, a.subject_id, a.snapshot_hash, a.reason, a.archived_at,
            u.display_name AS archived_by_name,
            a.snapshot->'artifact'->>'name' AS subject_name,
            jsonb_array_length(coalesce(a.snapshot->'versions','[]'::jsonb)) AS version_count
       FROM archive_records a JOIN users u ON u.id = a.archived_by
      ORDER BY a.archived_at DESC`)).rows;
}

export async function getArchiveRecord(db, archiveId) {
  return (await db.query(`SELECT * FROM archive_records WHERE id = $1`, [archiveId])).rows[0] ?? null;
}

export { stableStringify };
