// HTTP layer. Thin. It translates requests into domain calls and nothing else:
// no domain semantics live here.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabase, migrate } from '../persistence/db.js';
import { seed } from '../seed/seed.js';
import * as reality from '../domain/reality.js';
import * as graph from '../graph/graph.js';
import { lineageOf, versionDelta } from '../provenance/provenance.js';
import { archiveArtifact, listArchive, getArchiveRecord } from '../archive/archive.js';
import { ask, SUGGESTED_QUESTIONS } from '../reasoning/ask.js';
import { loadActor, capabilitiesOf, AuthorityError, ACTIONS } from '../authority/authority.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(here, '..', '..', 'web');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
               '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
               '.json': 'application/json; charset=utf-8' };

export async function buildServer({ dataDir = null } = {}) {
  const db = await createDatabase({ dataDir });
  await migrate(db);
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM users`);
  if (rows[0].n === 0) await seed(db);

  const ctxFor = async (req, body) => {
    const actorId = body?.actor_id || req.headers['x-wrasal-actor'] || 'usr_wray';
    return { db, actor: await loadActor(db, actorId) };
  };

  const routes = [
    ['GET', /^\/api\/bootstrap$/, async () => ({
      worlds: await graph.listWorlds(db),
      entity_types: await graph.listEntityTypes(db),
      entities: await graph.listEntities(db),
      actors: (await db.query(`SELECT id, display_name, kind, authority_level FROM users ORDER BY kind, handle`)).rows,
      actions: ACTIONS,
      suggested_questions: SUGGESTED_QUESTIONS,
    })],
    ['GET', /^\/api\/graph$/, async (_m, url) => graph.graphProjection(db, {
      world_id: url.searchParams.get('world_id'),
      focus: url.searchParams.get('focus'),
      depth: Number(url.searchParams.get('depth') ?? 2),
    })],
    ['GET', /^\/api\/entities$/, async () => graph.listEntities(db)],
    ['GET', /^\/api\/entities\/([^/]+)$/, async (m) => {
      const d = await graph.entityDossier(db, m[1]);
      if (!d) throw httpError(404, `No such entity: ${m[1]}`);
      return d;
    }],
    ['GET', /^\/api\/worlds\/([^/]+)$/, async (m) => graph.worldOverview(db, m[1])],
    ['GET', /^\/api\/lineage\/([^/]+)\/([^/]+)$/, async (m) => lineageOf(db, m[1], m[2])],
    ['GET', /^\/api\/artifacts\/([^/]+)\/versions$/, async (m) => versionDelta(db, m[1])],
    ['GET', /^\/api\/archive$/, async () => listArchive(db)],
    ['GET', /^\/api\/archive\/([^/]+)$/, async (m) => getArchiveRecord(db, m[1])],
    ['GET', /^\/api\/authority$/, async (_m, url) => {
      const actor = await loadActor(db, url.searchParams.get('actor_id') ?? 'usr_wray');
      const events = await db.query(
        `SELECT ae.*, u.display_name AS actor_name FROM authority_events ae
           JOIN users u ON u.id = ae.actor_id ORDER BY ae.occurred_at DESC LIMIT 200`);
      return { actor, capabilities: capabilitiesOf(actor), events: events.rows };
    }],
    ['GET', /^\/api\/provenance$/, async () => (await db.query(
      `SELECT p.*, u.display_name AS recorded_by_name FROM provenance_records p
         JOIN users u ON u.id = p.recorded_by ORDER BY p.created_at DESC`)).rows],
    ['GET', /^\/api\/decisions$/, async () => (await db.query(
      `SELECT d.*, p.display_name AS proposed_by_name, s.display_name AS decided_by_name
         FROM decisions d JOIN users p ON p.id = d.proposed_by
         LEFT JOIN users s ON s.id = d.decided_by ORDER BY d.proposed_at DESC`)).rows],
    ['GET', /^\/api\/evidence$/, async () => (await db.query(
      `SELECT ev.*, e.name AS entity_name FROM evidence ev
         LEFT JOIN entities e ON e.id = ev.entity_id ORDER BY ev.recorded_at DESC`)).rows],
    ['GET', /^\/api\/memories$/, async () => (await db.query(
      `SELECT m.*, e.name AS entity_name, u.display_name AS recorded_by_name FROM memories m
         JOIN entities e ON e.id = m.entity_id JOIN users u ON u.id = m.recorded_by
        ORDER BY m.created_at DESC`)).rows],

    ['POST', /^\/api\/ask$/, async (_m, _u, body) =>
      ask(db, body.question ?? '', { entity_id: body.entity_id ?? null, artifact_id: body.artifact_id ?? null })],

    ['POST', /^\/api\/entities$/,      mut(reality.createEntity)],
    ['POST', /^\/api\/relationships$/, mut(reality.createRelationship)],
    ['POST', /^\/api\/memories$/,      mut(reality.recordMemory)],
    ['POST', /^\/api\/evidence$/,      mut(reality.recordEvidence)],
    ['POST', /^\/api\/claims$/,        mut(reality.assertClaim)],
    ['POST', /^\/api\/claims\/link$/,  mut(reality.linkClaimEvidence)],
    ['POST', /^\/api\/provenance$/,    mut(reality.recordProvenance)],
    ['POST', /^\/api\/artifacts$/,     mut(reality.createArtifact)],
    ['POST', /^\/api\/artifact-versions$/, mut(reality.createArtifactVersion)],
    ['POST', /^\/api\/specifications$/, mut(reality.createSpecification)],
    ['POST', /^\/api\/decisions$/,     mut(reality.proposeDecision)],
    ['POST', /^\/api\/canonical$/,     mut(reality.declareCanonical)],
    ['POST', /^\/api\/archive$/,       mut(archiveArtifact)],
  ];

  function mut(fn) {
    return async (_m, _u, body, req) => fn(await ctxFor(req, body), body);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/')) {
        const body = req.method === 'POST' ? await readJson(req) : null;
        for (const [method, pattern, handler] of routes) {
          if (req.method !== method) continue;
          const m = url.pathname.match(pattern);
          if (!m) continue;
          const result = await handler(m, url, body, req);
          return send(res, 200, result);
        }
        return send(res, 404, { error: 'No such endpoint', path: url.pathname });
      }
      return serveStatic(url.pathname, res);
    } catch (err) {
      if (err instanceof AuthorityError) {
        return send(res, 403, { error: err.message, code: err.code, detail: err.detail });
      }
      return send(res, err.status ?? 400, { error: err.message });
    }
  });

  return { server, db };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function send(res, status, payload) {
  const text = JSON.stringify(payload, null, 2);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(text);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) reject(new Error('Payload too large')); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.join(WEB_DIR, rel);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  return res.end(fs.readFileSync(file));
}
