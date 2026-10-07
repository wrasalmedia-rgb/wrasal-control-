import crypto from 'node:crypto';
import nodeFs from 'node:fs';
import { CUSTODY_RESULT } from './custody.js';
import { REFERENCE_CLASS } from './artifact.js';

/**
 * ARCHIVE STEWARD (WRASAL-0015).
 *
 * Constitutional role, deliberately narrow:
 *
 *   It protects the distinction between what WRASAL once possessed, what
 *   WRASAL currently possesses, and what WRASAL can currently prove.
 *
 * It is the custodian of time, not an authority over reality. Its entire
 * mandate is: observe -> append -> fold -> report.
 *
 * WHAT IT MAY DO
 *   - read bytes from storage WRASAL already controls
 *   - recompute a digest and compare it to the one recorded
 *   - report that it could not establish something
 *
 * WHAT IT MAY NOT DO — and is structurally incapable of doing, because this
 * module takes no fetch implementation, imports no network module, and is
 * never handed a credential:
 *   - fetch a provider URL
 *   - refresh or resurrect a presigned reference
 *   - poll provider storage or establish provider liveness
 *   - download a remote artefact
 *
 * It also has no access to the methods that would let it create provider
 * bindings, select providers, claim execution, alter ledger history, repair
 * evidence, or promote DOCUMENTED to OBSERVED. It receives an artefact record
 * and a read-only store, and returns an observation. Nothing else.
 *
 * A remote reference therefore remains NOT_ATTEMPTED forever, which folds to
 * INTEGRITY_UNVERIFIED. That is not a useless state. It is an honest one.
 */

/** References the Steward is permitted to read: local storage WRASAL owns. */
const LOCAL_SCHEME = 'wrasal-local://';

export const OBSERVATION_METHOD = Object.freeze({
  LOCAL_BYTE_READ: 'LOCAL_BYTE_READ',
  NONE: 'NONE',
});

export const NOT_ATTEMPTED_REASON = Object.freeze({
  REMOTE_REFERENCE_FETCH_FORBIDDEN: 'REMOTE_REFERENCE_FETCH_FORBIDDEN',
  NO_REFERENCE: 'NO_REFERENCE',
  NO_RECORDED_HASH: 'NO_RECORDED_HASH',
});

export class ArchiveSteward {
  /**
   * @param {object} options
   * @param {{resolve: (fileName: string) => string|null}} options.mediaStore
   *   Read-only local resolution. No writer is accepted.
   * @param {() => string} [options.clock]
   * @param {{readFileSync: Function}} [options.fs]  injectable for tests only
   */
  constructor({ mediaStore, clock = () => new Date().toISOString(), fs = null }) {
    this.mediaStore = mediaStore;
    this.clock = clock;
    this.fs = fs;
  }

  /**
   * Take one look at an artefact and report what was found.
   *
   * Returns a plain observation object. It does NOT append it, does not touch
   * the ledger, and does not modify the artefact record it was given — the
   * caller owns persistence. This keeps the Steward incapable of rewriting
   * history even by accident.
   */
  observe(artifactRecord, { actor = 'archive.steward' } = {}) {
    const observedAt = this.clock();
    const base = {
      observed_at: observedAt,
      observed_by: actor,
      reference_class: artifactRecord?.reference_class ?? null,
      reference: artifactRecord?.reference ?? null,
      recorded_hash: artifactRecord?.content_hash ?? null,
      recomputed_hash: null,
      bytes_present: null,
      byte_length: null,
    };

    // No artefact to look at. Correct, and not a failure.
    if (!artifactRecord?.reference || artifactRecord.reference_class === REFERENCE_CLASS.ARTIFACT_UNAVAILABLE) {
      return Object.freeze({
        ...base,
        method: OBSERVATION_METHOD.NONE,
        result: CUSTODY_RESULT.NOT_ATTEMPTED,
        reason: NOT_ATTEMPTED_REASON.NO_REFERENCE,
        note: 'There is no retrievable reference on this record to observe.',
      });
    }

    // THE BOUNDARY. A remote reference is not examined, by constitutional
    // rule, not by inability to write the code. Liveness of a provider URL is
    // observable only by requesting it, and the Steward may not request it.
    if (!String(artifactRecord.reference).startsWith(LOCAL_SCHEME)) {
      return Object.freeze({
        ...base,
        method: OBSERVATION_METHOD.NONE,
        result: CUSTODY_RESULT.NOT_ATTEMPTED,
        reason: NOT_ATTEMPTED_REASON.REMOTE_REFERENCE_FETCH_FORBIDDEN,
        note: 'This reference is not held in storage WRASAL controls. The Archive Steward is forbidden from fetching provider references, so no observation is possible and none is simulated.',
      });
    }

    const fileName = String(artifactRecord.reference).slice(LOCAL_SCHEME.length).split('/').pop();
    let filePath = null;
    try {
      filePath = this.mediaStore?.resolve?.(fileName) ?? null;
    } catch (error) {
      return Object.freeze({
        ...base,
        method: OBSERVATION_METHOD.LOCAL_BYTE_READ,
        result: CUSTODY_RESULT.INACCESSIBLE,
        reason: error.code ?? 'RESOLVE_FAILED',
        note: 'The reference could not be resolved. This establishes nothing about whether the artefact exists.',
      });
    }

    if (!filePath) {
      return Object.freeze({
        ...base,
        method: OBSERVATION_METHOD.LOCAL_BYTE_READ,
        result: CUSTODY_RESULT.ABSENT,
        bytes_present: false,
        note: 'WRASAL looked in storage it controls and did not find this artefact. This does NOT establish that the artefact ceased to exist.',
      });
    }

    let bytes;
    try {
      bytes = (this.fs ?? nodeFs).readFileSync(filePath);
    } catch (error) {
      return Object.freeze({
        ...base,
        method: OBSERVATION_METHOD.LOCAL_BYTE_READ,
        result: CUSTODY_RESULT.INACCESSIBLE,
        reason: error.code ?? 'READ_FAILED',
        note: 'The artefact was located but could not be read. Integrity is neither confirmed nor denied.',
      });
    }

    // Bytes exist. Presence is recorded as its own fact, separately from
    // integrity, because they are different findings.
    const recomputed = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;

    if (!artifactRecord.content_hash) {
      return Object.freeze({
        ...base,
        method: OBSERVATION_METHOD.LOCAL_BYTE_READ,
        result: CUSTODY_RESULT.NOT_ATTEMPTED,
        reason: NOT_ATTEMPTED_REASON.NO_RECORDED_HASH,
        bytes_present: true,
        byte_length: bytes.length,
        recomputed_hash: recomputed,
        note: 'Bytes are present, but the original record carries no digest to compare against, so integrity cannot be established. Presence is recorded; integrity is not claimed.',
      });
    }

    const matches = recomputed === artifactRecord.content_hash;
    return Object.freeze({
      ...base,
      method: OBSERVATION_METHOD.LOCAL_BYTE_READ,
      result: matches ? CUSTODY_RESULT.PRESENT_HASH_MATCH : CUSTODY_RESULT.PRESENT_HASH_MISMATCH,
      bytes_present: true,
      byte_length: bytes.length,
      recomputed_hash: recomputed,
      note: matches
        ? 'The bytes WRASAL holds now are the bytes WRASAL recorded. This establishes integrity, not authenticity.'
        : 'The bytes at this reference differ from those recorded. This is a positive finding of corruption.',
    });
  }
}
