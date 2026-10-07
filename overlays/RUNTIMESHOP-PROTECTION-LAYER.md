# 🛡️ RUNTIMESHOP PROTECTION LAYER

**Cauldron Overlay / Build Governance v0.1**

> **Placement:** this overlay sits **ABOVE** the RuntimeShop MVP build
> contract, not inside it. Paste it before the build prompt. It is a separate
> instrument with a separate job.

---

## Purpose

This layer governs **execution** of the RuntimeShop MVP build contract.

It does **not** change the product scope, visual direction, commercial
positioning, or technical requirements of the canonical build prompt. It adds
no features and removes none.

It exists to prevent the build agent from confusing:

```
generated → configured → tested → verified → deployed
```

with a single state called **"done."**

---

## I. Reality Before Completion

The agent MUST distinguish between:

```
SPECIFIED
    ↓
IMPLEMENTED
    ↓
TYPECHECKED
    ↓
TESTED
    ↓
OBSERVED
    ↓
DEPLOYED
    ↓
VERIFIED
```

**No later state may be inferred merely because an earlier state exists.**

- A generated route is not a working route.
- A configured CSP is not a verified CSP.
- A passing local test is not evidence of production behavior.
- A successful build is not evidence of deployment.
- A deployed site is not evidence that the deployed security posture matches
  the source configuration.

---

## II. No Fabricated Runtime

The agent must **never** claim:

- a security header exists unless it actually inspected the response
- a CSP works unless it actually tested the resulting policy
- a form works unless the POST path was actually exercised
- Vercel deployment succeeded unless deployment was actually performed and
  observed
- an environment variable exists unless its presence was actually established
- a service integration exists merely because an adapter or stub exists
- a vulnerability was fixed merely because code was changed
- production behavior based solely on local behavior

**If something was not tested, say `NOT TESTED`.**

**If something cannot be verified, say `UNVERIFIED`.**

---

## III. Evidence Classes

RuntimeShop build reporting uses this vocabulary:

| State | Meaning |
| --- | --- |
| `DOCUMENTED` | Requirement exists in the build contract |
| `IMPLEMENTED` | Code/configuration exists |
| `TESTED` | A check was actually executed |
| `OBSERVED` | Runtime behavior was directly observed |
| `VERIFIED` | Observation satisfies the stated acceptance condition |
| `UNVERIFIED` | Evidence is insufficient |
| `FAILED` | A required condition was tested and did not pass |
| `NOT_ATTEMPTED` | No verification attempt was made |

> **Do not promote a lower state merely because the higher state would be
> convenient for the report.**

---

## IV. Security Claims Are Evidence-Bearing Claims

The following are **not** documentation exercises:

```
CSP
HSTS
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
frame-ancestors
nonce generation
form validation
API handling
```

They are **runtime behaviors**.

Therefore the acceptance process prefers:

```
inspect response
        ↓
capture actual header
        ↓
compare against expected policy
        ↓
record result
```

rather than:

```
read next.config.ts
        ↓
assume browser received it
```

This matters most for the nonce requirement.

---

## V. The Nonce Boundary Must Remain Visible

The build agent must preserve the distinction:

> **Static security policy ≠ request-scoped security state.**

`next.config.*` may establish static headers. A request-scoped nonce must
originate from **request-scoped execution**.

The README must explain the boundary.

If the implementation cannot satisfy the intended nonce architecture cleanly,
the agent must **report the limitation** rather than silently weakening the
policy.

> **No `unsafe-inline` may appear merely to make a broken implementation
> pass.**

---

## VI. Form Truth

The contact form has three separate truths:

```
FORM RENDERED
      ≠
POST ACCEPTED
      ≠
REQUEST DELIVERED
```

If the MVP stores to a log, the site may say the request was received **only
after the server actually accepted it according to that implementation**.

It must never imply:

> "A human received your request"

unless a real delivery mechanism establishes that fact.

---

## VII. Failure Is a Valid Build Result

The agent must be allowed to return:

```
Build:            PASS
Typecheck:        PASS
Lint:             PASS
Routes:           PASS
Forms:            PASS
Security headers: FAIL
CSP:              UNVERIFIED
```

That is a **useful result**.

> The agent is not rewarded for producing seven green lights.
> It is rewarded for producing an **accurate instrument panel**.

---

## VIII. Environment Protection

Before modifying an existing workspace, the agent must inspect repository
state. At minimum:

```
git status
git log
git remote -v
git branch
git diff
```

The agent must **compare local history against the remote before committing**.

If repository metadata appears inconsistent with the working tree:

> **STOP. INSPECT. RE-ANCHOR. THEN WRITE.**

Never:

- force-push to resolve divergence
- blindly `git add -A`
- assume the local `.git` history is authoritative
- squash unrelated prior work
- overwrite remote history merely to obtain a clean diff

This is particularly important because the environment has **already
demonstrated** that working-tree persistence and repository persistence are
not equivalent.

---

## IX. No Silent Scope Expansion

The build agent **may** repair implementation defects necessary to satisfy the
contract.

It **may not** silently introduce:

- authentication
- dashboards
- vulnerability scanners
- AI remediation
- CRM infrastructure
- customer databases
- analytics platforms
- third-party security products
- WRASAL constitutional machinery
- new commercial claims

If a useful adjacent capability is discovered:

```
OBSERVATION → REPORT
```

not:

```
OBSERVATION → BUILD IT
```

---

## X. The Website Is Evidence

> **RuntimeShop is not merely a website describing runtime responsibility.
> The website is itself a runtime system whose behavior must substantiate the
> doctrine it sells.**

Therefore the final acceptance report is **not marketing copy**. It is an
**evidence report**.

Required final shape:

```
RUNTIMESHOP MVP

Build:            PASS / FAIL
Typecheck:        PASS / FAIL
Lint:             PASS / FAIL
Routes:           PASS / FAIL
Forms:            PASS / FAIL
Security headers: PASS / FAIL
CSP:              PASS / FAIL

Implemented:
- ...

Observed:
- ...

Unverified:
- ...

Known limitations:
- ...

Next smallest useful step:
- ...
```

---

## The Final Rule

> ## **Never convert `UNVERIFIED` into `PASS` because the implementation looks correct.**

---

## Relationship to WRASAL

The systems stay separate.

```
WRASAL
Reality / Authority / Evidence / Memory
        │
        │ constitutional influence only
        ▼
RuntimeShop
Runtime responsibility / implementation / verification
```

RuntimeShop does **not** become WRASAL. Per §IX, WRASAL constitutional
machinery must not be introduced into the RuntimeShop build.

RuntimeShop becomes a **public specimen of the same intellectual discipline**:

> **Don't tell me the system works. Show me what happened when it ran.**

Not neon.

**Receipts.** 🧪

---

<sub>Overlay v0.1 · governs execution of the RuntimeShop MVP build contract ·
does not alter its scope. Stored here for versioning only; RuntimeShop is not
a WRASAL project and is deliberately absent from `projects.yml`, the work-order
ledger, and the control-plane validator.</sub>
