import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Append-only event log.
 *
 * §21/§22: history is never edited. The only write operation is append().
 * Each record carries the hash of the previous record, so any retroactive edit
 * to the file is detectable by verifyChain().
 */
export class EventLog {
  /**
   * @param {object} options
   * @param {string|null} options.file  Path to a .jsonl file, or null for memory-only.
   * @param {() => string} [options.clock] ISO timestamp source.
   */
  constructor({ file = null, clock = () => new Date().toISOString() } = {}) {
    this.file = file;
    this.clock = clock;
    this.records = [];
    this.listeners = new Set();

    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      if (fs.existsSync(this.file)) this.#load();
    }
  }

  #load() {
    const text = fs.readFileSync(this.file, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.records.push(JSON.parse(trimmed));
    }
  }

  get head() {
    return this.records.length ? this.records[this.records.length - 1] : null;
  }

  static hashRecord(record) {
    const canonical = JSON.stringify({
      sequence: record.sequence,
      type: record.type,
      recorded_at: record.recorded_at,
      actor: record.actor,
      subject: record.subject,
      payload: record.payload,
      previous_hash: record.previous_hash,
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Append one immutable event.
   * @param {string} type    one of EVENT.*
   * @param {object} payload event body
   * @param {object} meta    { actor, subject }
   */
  append(type, payload, { actor = 'system', subject = null } = {}) {
    const previous = this.head;
    const record = {
      id: `EVT-${String(this.records.length + 1).padStart(4, '0')}`,
      sequence: this.records.length + 1,
      type,
      recorded_at: this.clock(),
      actor,
      subject,
      payload,
      previous_hash: previous ? previous.hash : null,
    };
    record.hash = EventLog.hashRecord(record);

    Object.freeze(record.payload);
    Object.freeze(record);
    this.records.push(record);

    if (this.file) {
      fs.appendFileSync(this.file, `${JSON.stringify(record)}\n`, 'utf8');
    }
    for (const listener of this.listeners) listener(record);
    return record;
  }

  all() {
    return this.records.slice();
  }

  byType(type) {
    return this.records.filter((record) => record.type === type);
  }

  forSubject(subjectId) {
    return this.records.filter((record) => record.subject === subjectId);
  }

  /** Detect any retroactive edit to recorded history. */
  verifyChain() {
    const problems = [];
    let previousHash = null;
    for (const record of this.records) {
      if (record.previous_hash !== previousHash) {
        problems.push({ id: record.id, problem: 'previous_hash mismatch' });
      }
      if (EventLog.hashRecord(record) !== record.hash) {
        problems.push({ id: record.id, problem: 'record hash mismatch' });
      }
      previousHash = record.hash;
    }
    return { intact: problems.length === 0, problems, length: this.records.length };
  }

  onAppend(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
