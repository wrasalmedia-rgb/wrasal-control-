# WRASAL // Wish Machine Agent Stack v0.2 — Redacted Concept Record

10 paste-ready system prompts (1 orchestrator + 9 wave agents) + master config + empty Evidence Locker templates + first work order.

These are **non-runtime concept records**: prompts and empty templates only. They are implementation-neutral and validator-safe (the control-plane validator only checks `projects.yml`, `priorities.yml`, `dependencies.yml`, `work_orders/*.json`).

## Public-repo safety (read first)

- This repo is **PUBLIC**. These files contain prompts and **EMPTY** templates only.
- No real names (`Governor`), no account numbers (`[REDACTED]`), no real balances, no real payment rows.
- The **REAL** Evidence Locker lives in a local encrypted folder **OUTSIDE** this repo and must never be committed.
- Repo `evidence/` is S3 validator evidence (e.g. `WRASAL-0005-validation.json`) — **NOT** personal financial evidence. Never mix the two.

## Waves

| Wave | Agents | Purpose |
|------|--------|---------|
| 1 — TRUTH | 01 Anchor → 02 Forensic → 03 Reconciliation | Establish verifiable present + reconstruct history + check the math |
| 2 — OPTIONS | 04 Legal → 05 Resource → 06 Revenue | Map lawful routes, inventory real resources, find fastest legitimate revenue |
| 3 — FIELD + DOING + TRUTH | 07 Opportunity → 08 Execution → 09 Auditor | Find real opportunities, execute with authorization, audit everything |

**Activate ONLY Wave 1 at start.** Wave 1 advances ONLY when `AUDIT_REPORT` verdict = `SYSTEM INTEGRITY VERIFIED` **AND** the Governor's acknowledgment is recorded as a signed line in `EXECUTION_QUEUE_001.md`. Gating is evidence-driven, not time-driven.

## File index

- `agents/00_orchestrator.md` … `agents/09_auditor.md` — the 10 system prompts
- `config/wish-machine-stack.json` — master stack config (waves, gates, principles)
- `evidence-locker-templates/` — 9 EMPTY templates (header/columns/skeleton only)
- `work-orders/FORENSIC-001.md` — first work order: start only 02 Forensic with this

## First run

1. Create separate Custom GPTs / Claude Projects per agent; paste each prompt as system instructions.
2. Give each access to the Evidence Locker (real locker outside repo; templates here show the schemas).
3. Start **only** `02_forensic` with `work-orders/FORENSIC-001.md`.
4. Do not advance waves until the Wave 1 gate is met.

## Version history

- **v0.1**: original 10-prompt pack (unredacted working draft; not committed here).
- **v0.2** (this tree): redacted for public repo; filenames normalized (`*_001.md`, `SLB_LEDGER_001.csv`); Wave 1 completion gate defined; forensic hypothesis period bounded + exhausted-evidence termination rule; reconciliation specs flagged `GOVERNOR DECISION REQUIRED`; legal leads marked `UNVERIFIED LEAD`; resource truncation repaired + basis requirement added; revenue scoring fixed (`FIT * SPEED * EVIDENCE`); opportunity scoring fixed (product rule); execution consequential/non-consequential boundary + authorization recording defined; auditor integrity rubric defined.

## Open Governor decisions

- `03_reconciliation`: compounding method, rate-change handling, day-count convention, JMD rounding rule.
- `02_forensic` / `FORENSIC-001`: bound the hypothesis test period (`YYYY-MM` to `YYYY-MM`).
- All legal mechanisms: require live source verification + qualified Jamaican attorney review before any consequential action.
