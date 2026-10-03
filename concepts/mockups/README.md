# FUNUJĒ — Non-runtime mockups

**Work order:** FUNUJE-UXUI-BRAND-INTERFACE-PULL-001 · Pass 1R
**Status:** illustrative artifact. **Not** a runtime implementation, not an approved design.

---

## `funuje-the-console-mockup.png`

**Surface:** The Console (artist/producer dashboard) — the first-surface recommendation from the
reconciliation. **The Signal was deliberately not rendered**, per the work-order boundary.

### Decisions this mockup embodies (all still pending human approval)

| Conflict | Rendered as | Alternative not shown |
|---|---|---|
| **A** palette | Guidelines v001 — `#050505` / `#171717` / `#E31B23` / `#F4E6C8` / `#28D7E8` / `#C8A34A` | Brand Kit `#FF2A23`, + Electric Pink, Burnt Orange, no gold/cyan |
| **B** navigation | Zone vocabulary, all nine | Sitemap's Home / Discover / Studio / Library |
| **C** typography | Heavyweight display + grotesk UI + mono for codes | Satoshi as the single body face |

### VERIFIED elements correctly expressed

- Nine zones in the rail; **The Console** active, marked by a red indicator bar (S1 §9).
- Graphite cards on obsidian ground — the verified "app UI" usage rule (S1 §5 table).
- **Cyan Signal on the analytics chart** — matches the verified role: "analytics, futuristic data,
  dashboard highlights" (S1 §5).
- **Frequency Ring** around the artist avatar + **Red Dot** for live (S1 §11, both verified functions).
- **Waveform** as a section divider (S1 §11).
- **Soft Gold** carrying the premium tier badge (S1 §5: "premium: black + gold + cream").
- Mono release codes (S1 §6: mono for "metadata, IDs, release codes").
- Primary CTA red fill + **white** label; secondary = black glass + red outline (S1 §9).
- Rounded black-glass cards, soft shadows, subtle red glow (S1 §9, verbatim).

### Deviations from the verified system — corrections required

1. **Casting contradicts a VERIFIED instruction.** S1 §10 requires imagery "rich in melanin detail";
   FUNUJĒ is a Caribbean cultural OS. The rendered portrait does not meet this. **Must be corrected.**
2. **Signal Bar motif absent.** The macron-as-status-bar is the single most implementable verified idea
   in the corpus (S1 §11: "loading bar, status indicator, audio pulse, campaign marker"). Not present.
3. **No FUNUJĒ wordmark** anywhere in the frame.
4. **Verified Console modules incomplete.** Analytics, Releases and Payouts are present; **Audience** and
   **Rights Management** (S1 §14, S6 Studio branch) are missing. "Push to Distribution" and
   "Export Report" are **invented labels, not source-derived**.
5. **Display face is a grotesk, not Anton-style condensed heavyweight** (Conflict C preferred reading).
6. **Red glow reads closer to uniform ambient** than the verified two-tier model (ambient-subtle on
   default cards, intensified only on active). The premium card carries a red edge glow where **gold**
   should be the premium signal — a role collision.
7. Composition occupies only the upper third; lower two-thirds unresolved.

### Measured contrast, as rendered

| Pair | Ratio | Verdict |
|---|---|---|
| White on Signal Red (primary CTA label) | **4.72:1** | **PASS** AA normal text — the accessibility-correct choice over cream (3.82:1) |
| Warm Cream on Graphite (card titles) | 14.51:1 | PASS AAA |
| Cyan Signal on Graphite (chart) | 10.22:1 | PASS AAA |
| Soft Gold on Graphite (tier badge) | 7.51:1 | PASS AAA |
| Smoke Gray on Graphite (release codes) | 5.19:1 | PASS AA, fails AAA |
| **Signal Red on Graphite ("LIVE" label)** | **3.80:1** | **FAILS AA normal text.** Passes as a non-text indicator (≥3:1), so the red *dot* is compliant but the red *word* is not. Set LIVE in cream or enlarge it. |

### Still UNRESOLVED

The mockup *depicts* radius, spacing, glow falloff, shadow and type scale. **None of those values are
source-established.** Reading them off this image would convert an illustration into a specification.
They remain UNRESOLVED pending design authority — see §7 of the reconciliation.
