# WRASAL Constitutional Principles

Principles frozen by canonical ruling. Each was **encountered** in the course
of a work order rather than designed up front, and each is recorded with the
work order that produced it.

These are not aspirations. Where a principle is enforced by a test, the test
is named; a principle with no enforcement is marked as such, so the gap
between what WRASAL believes and what WRASAL checks is itself visible.

---

## I. We cannot claim what reality did not establish

**Origin: WRASAL-0013.** Attempting live HeyGen verification with no credential
and no network egress.

Absence of evidence is a result. A blocked verification is a completed
investigation with an honest outcome, not a failure to be forced into a pass.

- **Provider documentation is not provider truth.** A documented field
  establishes `DOCUMENTED`. It can never establish `EXECUTED`.
- Never substitute a mock result and call it verification.
- Never convert a provider failure into a simulated success.
- `UNKNOWN` and `null` are legitimate recorded values. Inference is not.

*Enforced by:* `tests/provider-contract.test.mjs` — the contract may contain
no `"status":"VERIFIED"` and no `"source":"observed_live_response"`; the
surface refusal fires before any network call is attempted.

---

## II. A provider may participate without becoming authority

**Origin: WRASAL-0014.**

> **Providers render representations. WRASAL governs identity.**

Three identities, never collapsed:

| Identity | Record | Question |
| --- | --- | --- |
| Canonical | `Identity` | Who is this person inside WRASAL? |
| Representation | `IdentitySnapshot` | Which version is authorized to be represented? |
| Provider | `ProviderBinding` | What does an external renderer happen to call them? |

A provider's consent primitive and a WRASAL `AuthorityCheck` are not
interchangeable. Both gates must hold independently. A provider identifier is
never equivalent to a WRASAL identity.

*Enforced by:* `tests/architecture.test.mjs` — no file under `src/core/`
except `config.js` may name a provider, and the identity loop runs
byte-identically with every provider unregistered.

---

## III. A historical claim may survive even when present custody does not

**Origin: WRASAL-0015.** The environment destroyed the first artifact WRASAL
ever called `ARCHIVED`, while its frozen statement still claimed durable
possession in the present tense.

> **Past informs. Future cannot rewrite.**

A later observation never falsifies an earlier record. It is appended beside
it. What decays is not the claim but its *verifiability*.

The ledger may therefore contain claims later discovered to be
unsubstantiable **without becoming dishonest**. The dishonesty would be
rewriting history to make the ledger look cleaner.

- `INTEGRITY_UNVERIFIED` **does not mean false.** Uncertainty may remain
  uncertainty.
- Artifact *existence* and artifact *accessibility* are different facts.
- A hash surviving does not prove the bytes are still possessed.

*Enforced by:* `tests/custody.test.mjs` — after the bytes are deleted and
observed twice, the serialized `GenerationEvent` is byte-identical;
`assertNoRetroactiveRewrite()` throws on any attempted field change.

---

## IV. Observation time is not custody time

**Origin: WRASAL-0015. Frozen by canonical ruling.**

> **Checked recently ≠ possessed recently.**

Three clocks, never collapsed:

| Clock | Question |
| --- | --- |
| **Event time** | When did the thing happen? |
| **Evidence time** | When did WRASAL observe or record it? |
| **Custody time** | When could WRASAL last *substantiate* possession? |

Custody time advances **only** on substantiation. Looking and failing to find
the artifact advances `last_observed_at` and must leave `custody_time`
untouched.

This prevents a specific form of epistemic inflation, in which the diligence
of checking is silently laundered into a claim of possession. WRASAL may say
*"we checked at 23:40"* without thereby saying *"we possessed it at 23:40"*.

*Enforced by:* `tests/custody.test.mjs::custody time advances only on
substantiation, not merely on looking`.

---

## V. The claim determines the architecture, not the reverse

**Origin: ruling issued with WRASAL-0016.**

When an implementation cannot substantiate a claim the system makes, the
system must **admit it**, not redefine the claim until the implementation
qualifies.

WRASAL-0015 found `DURABLE` was inferred and never measured. It reported
`UNSUBSTANTIATED_DURABILITY_CLAIM` and deliberately did not downgrade
`DURABLE` to make the existing storage pass. The weakness was left standing as
the evidence that gives WRASAL-0016 permission to exist.

Accordingly WRASAL-0016 asks *what conditions must exist before WRASAL may
legitimately assert `DURABLE`* — not *how do we build storage*.

*Enforced by:* nothing yet. This principle governs how work orders are
scoped, and is held by the control layer rather than by a test.

---

## Standing prohibitions

Derived from the above and binding on every work order:

- Never fake successful external execution. Simulated output is visibly
  labelled `SIMULATED EXECUTION`.
- Never synthesize a provider job id, avatar id, voice id, asset id or
  character id. Refuse and report `PROVIDER_BINDING_REQUIRED`.
- Never invent provenance metadata a provider did not return.
- Never overwrite an identity snapshot, generation record or provenance
  entry. Corrections append; the log is append-only and hash-chained.
- Never claim Freebuff certification without a real Freebuff service
  confirming it.
- Never place credentials in logs, provenance, Freebuff payloads, the
  frontend, or the repository.
