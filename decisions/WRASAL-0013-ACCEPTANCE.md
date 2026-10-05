# WRASAL-0013 — Canonical Acceptance

- **Work order:** WRASAL-0013 — HeyGen Provider Contract Verification
- **Outcome:** **C — HEYGEN_BLOCKED**
- **Accepted on:** 2026-10-05
- **Accepted by:** canonical authority (Wray), explicit verbal verdict
- **Disposition:** **ACCEPTED AS BLOCKED — not failed.**

## The decision

WRASAL-0013 set out to verify the HeyGen provider contract against a live
endpoint. It could not, for two independent environmental reasons:

1. `CREDENTIAL_UNAVAILABLE` — no authorized HeyGen API key exists in this
   environment.
2. `NETWORK_EGRESS_BLOCKED` — DNS resolves and TCP 443 opens, but TLS is
   severed at SNI for every `heygen.com` host. Reproduced across three IPs,
   `--resolve`, and raw TCP+TLS. npm and GitHub return 200 from the same
   sandbox, so this is host-specific egress filtering, not a dead network.

Zero live observations were made. Nothing in the contract is marked `VERIFIED`.
`request_observations` and `response_observations` are deliberately empty
arrays rather than plausible-looking fabrications.

**This is accepted as a complete execution of the work order.** The objective
was to establish the contract's verification state, and it did: the state is
`DOCUMENTED_NOT_OBSERVED`, and that is a result, not a non-result.

## Why this is not a failure

The work order's real deliverable turned out to be architectural rather than
operational:

> WRAYVE can know HeyGen exists without letting HeyGen become an authority
> inside WRASAL.

That is now demonstrated and test-enforced. HeyGen can be unregistered
entirely and the identity loop runs byte-identically. No file under
`src/core/` except `config.js` names a provider at all.

A forced Outcome A — a mocked response relabelled as verification — would have
produced a worse system and a false record. The standing constraint holds:
**absence of evidence is a result.**

## What survives as binding constraint

- `evidence/HEYGEN-CONTRACT-001.json` — the v0.2 contract, verification state
  `DOCUMENTED_NOT_OBSERVED`.
- The **surface refusal**: `HEYGEN_API_SURFACE` ∈ `v2_legacy|v3`; unset means
  unverified, not "use the default". WRAYVE raises
  `PROVIDER_SURFACE_UNVERIFIED` *before any network call*.
- The **sunset finding**: v0.1's endpoints are documented LEGACY, retired
  2026-11-01. WRAYVE refuses to pick a surface on documentation alone.
- The **presigned-URL finding** — the documented output URL expires. This is
  the direct origin of WRASAL-0014 and the possession invariant.
- **HeyGen consent ≠ WRASAL AuthorityCheck.** A provider-side group-granularity
  gate is not a contextual, snapshot-versioned authority decision. Both gates
  must hold independently. Asserted by test.
- The 37-test suite (now 56) and the `§28` architecture regression.

## Conditions for revisiting

Return to live HeyGen verification only when **both** hold:

1. Network egress to `api.heygen.com` is available, and
2. An authorized HeyGen credential is present in the server environment.

Until then HeyGen remains an adapter, not a dependency. Do not add a fake
credential. Do not fabricate an avatar binding. Do not switch surfaces
automatically.

## Successor

**WRASAL-0014 — Durable Output & Provider Evidence**, which addresses the
presigned-URL discovery: an evidence record must never imply durable
possession of an artifact when WRASAL only possesses an expiring provider
reference.
