// Provenance / lineage layer.
// Walks derivation chains in both directions. Reports ownership as UNKNOWN
// unless an explicit creator was recorded — derivation is never ownership.

import { PROVENANCE_DISCLAIMER, UNKNOWN } from '../domain/vocabulary.js';

export async function lineageOf(db, subjectKind, subjectId, { maxDepth = 8 } = {}) {
  const seen = new Set();
  const ancestors = [];
  const descendants = [];

  async function walkUp(kind, sid, depth) {
    if (depth > maxDepth) return;
    const key = `${kind}:${sid}:up`;
    if (seen.has(key)) return;
    seen.add(key);
    const { rows } = await db.query(
      `SELECT * FROM provenance_records WHERE subject_kind = $1 AND subject_id = $2`, [kind, sid],
    );
    for (const r of rows) {
      ancestors.push({ depth, ...r });
      if (r.related_kind && r.related_id) await walkUp(r.related_kind, r.related_id, depth + 1);
    }
  }

  async function walkDown(kind, sid, depth) {
    if (depth > maxDepth) return;
    const key = `${kind}:${sid}:down`;
    if (seen.has(key)) return;
    seen.add(key);
    const { rows } = await db.query(
      `SELECT * FROM provenance_records WHERE related_kind = $1 AND related_id = $2`, [kind, sid],
    );
    for (const r of rows) {
      descendants.push({ depth, ...r });
      await walkDown(r.subject_kind, r.subject_id, depth + 1);
    }
  }

  await walkUp(subjectKind, subjectId, 0);
  await walkDown(subjectKind, subjectId, 0);

  const creators = [...new Set(ancestors.map((a) => a.creator).filter(Boolean))];

  return {
    subject: { kind: subjectKind, id: subjectId },
    ancestors,
    descendants,
    recorded_creators: creators.length ? creators : UNKNOWN,
    ownership: UNKNOWN,
    note: PROVENANCE_DISCLAIMER,
  };
}

/** Version-to-version difference, reported structurally, never summarised by a model. */
export async function versionDelta(db, artifactId) {
  const { rows } = await db.query(
    `SELECT v.*, u.display_name AS author FROM artifact_versions v
       JOIN users u ON u.id = v.created_by
      WHERE v.artifact_id = $1 ORDER BY v.version_number`, [artifactId],
  );
  const deltas = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const cur = rows[i];
    deltas.push({
      from: prev.version_number,
      to: cur.version_number,
      change_summary: cur.change_summary,
      author: cur.author,
      at: cur.created_at,
      body_changed: (prev.body ?? '') !== (cur.body ?? ''),
      epistemic_status: cur.epistemic_status,
    });
  }
  return { artifact_id: artifactId, versions: rows, deltas };
}
