import fs from 'node:fs';
import path from 'node:path';
import { VISIBILITY } from './vocabulary.js';
import { hashBytes } from './artifact.js';

/**
 * Local private asset store.
 *
 * §23: generated assets default to PRIVATE. Nothing here is served without
 * going through the authenticated-by-session media route in the server, and
 * nothing is written to a public directory.
 */
export class MediaStore {
  constructor({ directory }) {
    this.directory = directory;
    fs.mkdirSync(this.directory, { recursive: true });
  }

  /**
   * Write a visibly-labelled simulation artefact.
   * It is an SVG, not a video, precisely so it cannot be mistaken for provider
   * output. Nothing here claims a renderer produced it.
   */
  writeSimulatedPlaceholder({ execution_request_id, job_id, scene_title, identity_label, snapshot_version, dialogue }) {
    const fileName = `${job_id}.svg`;
    const filePath = path.join(this.directory, fileName);
    const bytes = Buffer.from(simulationSvg({
      job_id, scene_title, identity_label, snapshot_version, dialogue, execution_request_id,
    }), 'utf8');
    fs.writeFileSync(filePath, bytes);
    return {
      reference: `wrasal-local://media/${fileName}`,
      file_name: fileName,
      visibility: VISIBILITY.PRIVATE,
      media_type: 'image/svg+xml',
      // WRASAL wrote these bytes, so it can hash them. This is the one path in
      // the system that legitimately reaches ARCHIVED on the evidence ladder.
      content_hash: hashBytes(bytes),
      byte_length: bytes.length,
    };
  }

  resolve(fileName) {
    const safe = path.basename(fileName);
    const filePath = path.join(this.directory, safe);
    if (!fs.existsSync(filePath)) return null;
    return filePath;
  }
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap(text, max) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((`${line} ${word}`).trim().length > max) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 4);
}

function simulationSvg({ job_id, scene_title, identity_label, snapshot_version, dialogue, execution_request_id }) {
  const dialogueLines = wrap(dialogue, 46)
    .map((line, index) => `<text x="80" y="${372 + index * 34}" class="dialogue">${escapeXml(line)}</text>`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" role="img" aria-label="Simulated execution placeholder">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07070a"/>
      <stop offset="60%" stop-color="#0d0e12"/>
      <stop offset="100%" stop-color="#121016"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.5">
      <stop offset="0%" stop-color="#1b2a2c" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#07070a" stop-opacity="0"/>
    </radialGradient>
    <pattern id="hatch" width="28" height="28" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="28" height="28" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="28" stroke="#c8a24a" stroke-opacity="0.10" stroke-width="10"/>
    </pattern>
    <style>
      .label { font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.32em; font-size: 15px; fill: #7d8488; }
      .value { font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.14em; font-size: 26px; fill: #efe9dd; }
      .stamp { font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.44em; font-size: 40px; fill: #c8a24a; }
      .dialogue { font-family: Georgia, serif; font-size: 25px; fill: #9fb4b4; font-style: italic; }
      .fine { font-family: 'Courier New', monospace; font-size: 15px; fill: #5e666a; letter-spacing: 0.08em; }
    </style>
  </defs>

  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect width="1280" height="720" fill="url(#glow)"/>
  <rect width="1280" height="720" fill="url(#hatch)"/>
  <rect x="36" y="36" width="1208" height="648" fill="none" stroke="#c8a24a" stroke-opacity="0.35" stroke-width="1"/>

  <text x="80" y="128" class="stamp">SIMULATED EXECUTION</text>
  <text x="80" y="166" class="fine">NO EXTERNAL PROVIDER WAS CONTACTED — NO MEDIA WAS RENDERED</text>

  <line x1="80" y1="198" x2="1200" y2="198" stroke="#2a2d33"/>

  <text x="80" y="246" class="label">IDENTITY</text>
  <text x="80" y="282" class="value">${escapeXml(identity_label)} / ${escapeXml(snapshot_version)}</text>

  <text x="640" y="246" class="label">SCENE</text>
  <text x="640" y="282" class="value">${escapeXml(scene_title)}</text>

  <text x="80" y="336" class="label">DIALOGUE AS DIRECTED</text>
  ${dialogueLines}

  <line x1="80" y1="560" x2="1200" y2="560" stroke="#2a2d33"/>
  <text x="80" y="600" class="fine">PROVIDER        MOCK (WRASAL simulation adapter)</text>
  <text x="80" y="626" class="fine">JOB             ${escapeXml(job_id)}</text>
  <text x="80" y="652" class="fine">REQUEST         ${escapeXml(execution_request_id)}</text>
  <text x="840" y="652" class="fine">VISIBILITY PRIVATE</text>
</svg>
`;
}
