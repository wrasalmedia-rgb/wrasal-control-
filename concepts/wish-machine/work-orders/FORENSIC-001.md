# FORENSIC-001 WORK ORDER (redacted template — v0.2)

Issued by: WRASAL Orchestrator
Governor: the Governor (human)
Priority: P0 — First Door

**FORENSIC-001:** Reconstruct the Governor's Student Loan Bureau account from January 2010 through present using ONLY recoverable evidence. List every VERIFIED payment, every UNVERIFIED claimed payment, every DISPUTED row (bank shows payment, SLB shows no credit). Do not infer. Produce the ledger + the next 3 pieces of evidence required.

## Mission

Reconstruct the SLB account from Jan 1, 2010 to present using ONLY recoverable evidence. Identify every verified payment, every unsupported claimed payment, every balance change, every fee/interest component, and every unresolved discrepancy. Do not infer missing payments. Do not alter current balance.

## Scope

Jan 1, 2010 → present (~16 years). Note: banks typically retain ~7 years and the SLB portal may not retain 2010-era statements — follow the agent's exhausted-evidence rule and terminate with a gap list.

## Evidence checklist (search in order)

1. SLB Portal / Statements
   - Download all available statements 2010–present from slbja.com
   - Request certified statement if portal is incomplete
2. Bank Records
   - All JMD accounts used for SLB payments
   - Paymaster / Bill Pay confirmations
   - Standing orders
3. Personal Archive
   - Email: search "SLB" / "Student Loan Bureau" / "Paymaster"
   - Receipts, SMS, WhatsApp confirmations
4. Guarantor Docs
   - Guarantor agreement, any correspondence
5. SLB correspondence

Real documents stay OUTSIDE this public repo. Reference them by link/description, never paste account numbers or full statements into repo-bound outputs.

## Deliverables

1. SLB_LEDGER_001.csv populated with VERIFIED flags (real version outside repo; header-only template in repo):
   - VERIFIED = receipt or bank debit matched to SLB credit
   - UNVERIFIED = memory only (including monthly-payment hypothesis)
   - DISPUTED = bank shows payment but SLB shows no credit
   - UNAVAILABLE = retention expired or no portal record, after request attempted
2. List of NEXT 3 PIECES OF EVIDENCE REQUIRED, e.g.:
   - Bank statement [BANK] [REDACTED] [YYYY-MM to YYYY-MM]
   - SLB statement [YYYY Q#]
   - Paymaster receipt ref [REDACTED]
3. Hypothesis test result:
   - Claim: JMD [AMOUNT]/month paid [PERIOD TO BE SET — GOVERNOR DECISION REQUIRED: bound period, e.g. YYYY-MM to YYYY-MM]
   - Evidence found: [list, or NONE]
   - Status: CLAIM NOT ESTABLISHED / PARTIALLY VERIFIED / VERIFIED

## Forbidden

- No manifestation language
- No "should have been"
- No inferred payments
- No balance alteration
- No real payment rows, account numbers, or balances in public repo outputs

## Success criteria

Auditor can reproduce the ledger from sources alone.

## After completion

Trigger RECONCILIATION-001, then LEGAL-001 to map legitimate mechanisms — including the two UNVERIFIED LEADS (Debt Reset Programme; rescheduling / grants / waivers), each requiring live source verification + qualified Jamaican attorney review before any consequential action.
