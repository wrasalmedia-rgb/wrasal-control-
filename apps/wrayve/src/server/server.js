import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../core/config.js';
import { EventLog } from '../core/event-log.js';
import { MediaStore } from '../core/media-store.js';
import { WrayveService } from '../core/service.js';
import { buildDefaultRegistry } from '../adapters/registry.js';
import { seedIfEmpty, bootstrapProviderBindings } from '../core/seed.js';
import { buildRoutes, notFound } from './api.js';
import { WrayveError } from '../core/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '..', '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
};

export function createApp(env = process.env) {
  const config = loadConfig(env);
  const mediaStore = new MediaStore({ directory: config.mediaDir });
  const eventLog = new EventLog({ file: config.eventLogFile });
  const registry = buildDefaultRegistry({ mediaStore, config });
  const service = new WrayveService({ eventLog, registry, mediaStore });

  if (config.seed) seedIfEmpty(service);
  bootstrapProviderBindings(service, config.declaredProviderBindings);

  const routes = buildRoutes({ service, config });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname.startsWith('/api/')) {
        const match = routes
          .map((candidate) => ({ candidate, params: candidate.pattern.exec(pathname) }))
          .find((item) => item.params && item.candidate.method === req.method);

        if (!match) throw notFound(pathname);

        const body = req.method === 'POST' ? await readJson(req) : null;
        const result = await match.candidate.handler(match.params.slice(1), body ?? {});
        return sendJson(res, 200, result);
      }

      // §23: private media is served only through the server process. It is not
      // in the public directory and is never listed or linked anonymously.
      if (pathname.startsWith('/media/')) {
        const filePath = mediaStore.resolve(pathname.slice('/media/'.length));
        if (!filePath) return sendJson(res, 404, { code: 'NOT_FOUND', message: 'media asset not found' });
        res.writeHead(200, {
          'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
          'x-wrasal-visibility': 'PRIVATE',
        });
        return fs.createReadStream(filePath).pipe(res);
      }

      return serveStatic(pathname, res);
    } catch (error) {
      if (error instanceof WrayveError) {
        return sendJson(res, error.httpStatus, { error: error.toJSON() });
      }
      // Unexpected errors are reported, not smoothed over.
      return sendJson(res, 500, {
        error: { code: 'UNEXPECTED_ERROR', message: error.message, detail: null },
      });
    }
  });

  return { server, service, config, registry, mediaStore };
}

function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(publicDir, relative);
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  return fs.createReadStream(filePath).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { server, config } = createApp();
  server.listen(config.port, config.host, () => {
    console.log(`WRAYVE — WRASAL Identity Execution System`);
    console.log(`listening on http://${config.host}:${config.port}`);
    console.log(`data: ${config.dataDir}`);
    console.log(`HEYGEN_API_KEY present: ${Boolean(config.heygenApiKey)}`);
  });
}
