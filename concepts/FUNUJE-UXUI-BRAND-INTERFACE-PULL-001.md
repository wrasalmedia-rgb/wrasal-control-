# FUNUJĒ — UX / UI / Brand Interface Pull

**WORK_ORDER_ID:** FUNUJE-UXUI-BRAND-INTERFACE-PULL-001
**PROJECT:** FUNUJĒ
**RECORD TYPE:** Non-runtime concept record (S2 intelligence package)
**RECORDED ON:** 2026-10-03
**RECORDED BY:** Arena bounded S1 execution agent
**RESULT:** **PARTIAL**

---

> ## ⚠️ SUPERSEDED IN PART — read the reconciliation first
>
> This is the **Pass-1 provisional** record, retained **unmodified below this banner** for provenance.
> It was written before the FUNUJĒ source corpus was located.
>
> **Current record:** [`FUNUJE-UXUI-BRAND-INTERFACE-PULL-001-RECONCILIATION.md`](./FUNUJE-UXUI-BRAND-INTERFACE-PULL-001-RECONCILIATION.md) (Pass 1R)
>
> **Withdrawn — do not cite as evidence:**
> - "No FUNUJĒ source material exists in the connected Drive." — **false.** Folder
>   `1nbyg-Fq0q1uELNlv-Q4-lDxuDQjSodwi` ("Funujē", 134 files, owner `wrayveart@gmail.com`) was opened
>   directly by ID. It was missed because it is *shared-with-me*, so name/fullText search and
>   `corpora=allDrives` enumeration did not surface it.
> - §12 "no source found" and the all-missing source table.
> - The truth state **`DECLARED`** used throughout this document. It is retired: it conflated provenance
>   with evidential status. The reconciliation uses VERIFIED / INFERRED / UNRESOLVED, with `source_origin`
>   tracked as a separate field.
>
> **Reversed in Pass 1R:** the first-surface recommendation. This document recommends **The Signal**;
> the reconciliation recommends **The Console**, on evidentiary grounds.
>
> **Rejected in Pass 1R:** `ZoneShell`, the persistent mini-player, "stroke as the primary elevation
> signal", and "red glow is state, never ambient" — all agent-origin, none source-grounded.
>
> 61 claims from this document were re-adjudicated individually: 34 RETAIN, 19 REVISE, 8 REJECT.

---

## 0. TRUTH MODEL USED IN THIS DOCUMENT

The work order specifies three labels: VERIFIED / INFERRED / UNRESOLVED, where VERIFIED means
"directly grounded in source materials."

**No FUNUJĒ source material was found in any connected system.** Under the work order's own
definition, nothing in the visual system can therefore be labeled VERIFIED. However, the work order
body itself carries a dense, specific canonical input set (hex values, zone names, type stacks,
motifs). Collapsing that into "UNRESOLVED" would destroy usable signal; promoting it to "VERIFIED"
would fabricate evidence.

A fourth label is therefore used and declared openly:

| Label | Meaning |
|---|---|
| **VERIFIED** | Directly observed by this agent through tool inspection. In this document this applies **only** to facts about what does and does not exist in the connected systems. |
| **DECLARED** | Stated explicitly in the work order by the project principal. Authoritative **as instruction**, not independently corroborated by any brand artifact. Must be reconciled against the real brand bible before being treated as canon. |
| **INFERRED** | Synthesized by this agent from multiple DECLARED signals. Reasoned, not given. |
| **UNRESOLVED** | Evidence absent, incomplete, or internally conflicting. Requires human decision. |

**DECLARED is not VERIFIED.** Every token, zone, and rule below that is not explicitly marked
VERIFIED is unconfirmed against source artifacts.

---

## 1. EXECUTIVE SUMMARY

The source-grounded portion of this work order could **not** be executed. An exhaustive inspection of
the connected Google Drive (44 files, 0 shared drives, 0 trashed items), the connected Notion
workspace, the connected Linear workspace, and the provided repository found **zero FUNUJĒ
artifacts**. None of the eight expected reference assets exist in any connected system. "Funujē Brand
Guidelines v001" does not exist in the connected Drive.

What has been produced instead is an honest, clearly-labeled normalization of the canonical inputs
**declared in the work order itself**, organized into the requested seven-layer system, plus three
substantive findings that are the real value of this pass:

1. **The declared CTA specification fails accessibility.** Signal Red `#E31B23` with Warm Cream
   `#F4E6C8` text — the DECLARED primary CTA — measures **3.82:1**, below WCAG AA (4.5:1) for body
   text. This is a measured defect in the declared system, not a matter of taste. See §6.1.
2. **"Signal" is overloaded.** Both `Signal Red` and `Cyan Signal` carry the word, while `The Signal`
   is also a zone name. Three different referents, one word. This will produce token collisions on
   day one of implementation. See §11.
3. **Black-glass needs a stroke system to exist at all.** Graphite Glass `#171717` on Obsidian
   `#050505` is **1.14:1** — effectively invisible. Panel separation cannot come from fill; it must
   come from border, glow, or shadow. This elevates the "subtle red glow" from decoration to
   structural necessity. See §6.3.

**Phase 4 correctly terminated.** No runtime product repository is available, so no application
surface was built. A recommendation, conditional on a repository being supplied, is given in §10.3.

---

## 2. SOURCE INVENTORY

### 2.1 What was inspected — VERIFIED

| System | Method | Scope observed |
|---|---|---|
| Google Drive | `list_files` (`trashed = false`, `corpora: allDrives`) | **44 files total**, complete, no pagination remainder |
| Google Drive | `list_drives` | **0 shared drives** |
| Google Drive | `list_files` (`trashed = true`) | **0 trashed items** |
| Google Drive | `search_files` on name: `Funuj` / `FUNUJ` / `funuje` | **0 results** |
| Google Drive | `search_files` on name: `Brand Guidelines` / `Brand Bible` / `wordmark` / `v001` | **0 results** |
| Google Drive | `search_files` on fullText: `Funuje` / `FUNUJ` / `Feel The Frequency` | **1 result**, inspected, false positive (see 2.3) |
| Notion | `search` query `FUNUJ` | **0 results** |
| Notion | `search` (unfiltered, by last edited) | Default template workspace only (see 2.3) |
| Linear | `get_teams` | **1 team**: Wrasal (`WRA`) |
| Linear | `get_projects` | **12 projects**, none FUNUJĒ (see 2.3) |
| Repository | filesystem walk + `grep -ri` | No FUNUJĒ reference; no product/runtime code |

### 2.2 Expected reference set — status

The work order named eight expected sources. **All eight are MISSING.**

| # | Expected source | Status |
|---|---|---|
| 1 | Brand Bible / Interface DNA board | **MISSING** — not found in any connected system |
| 2 | Platform homepage — "Feel The Frequency" | **MISSING** |
| 3 | User Control Panel / dashboard | **MISSING** |
| 4 | Collections / commerce page | **MISSING** |
| 5 | Primary uppercase wordmark on red field | **MISSING** |
| 6 | Waveform wordmark | **MISSING** |
| 7 | Lowercase wordmark | **MISSING** |
| 8 | Artist + branded sound-system environmental image | **MISSING** |
| — | "Funujē Brand Guidelines v001" | **MISSING** |
| — | FUNUJĒ folder(s) in Drive | **MISSING** |

Per the authority envelope, no missing asset has been invented, reconstructed, or substituted.

### 2.3 Partial / unclear sources — VERIFIED

- **`Studio M`** (Google Doc, `10HAr8...`) — the sole full-text match. Read in full. Content is a
  six-phase business plan for a photo/video studio under "Oasis M". **Contains no FUNUJĒ content.**
  Drive's tokenized full-text matching produced a false positive. Not a FUNUJĒ source.
- **Connected Notion workspace** — contains only unmodified Notion starter content (`Company Home`,
  `Creative Projects`, `Content Calendar`, `Document Hub`, placeholder pages `Project 1/2/3`). No
  brand material of any kind.
- **Connected Linear workspace** — real portfolio data, but WRASAL-adjacent: `PATWACITY — City of
  Patois`, `RED DRAWZ — Pre-production v2.2`, `STINGWRAY™ — Brand Genesis`, `WRASAL Visual DNA
  Library™`, and others. **No FUNUJĒ project.** Worth noting that an adjacent brand-genesis and a
  "Visual DNA Library" discipline already exist in this portfolio; FUNUJĒ work should likely conform
  to those conventions rather than invent parallel ones. *(INFERRED)*
- **Connected Drive identity** — files are owned across `myfavouritejamaican@gmail.com`,
  `caostherebel@gmail.com`, and `wrayrasal@gmail.com`. The dominant content set is "My Favorite
  Jamaican" business planning from 2024. **It is plausible the FUNUJĒ material lives in a Drive
  account that is not the one currently connected.** This is the single most likely explanation for
  the total absence and the cheapest thing to check. *(INFERRED)*

---

## 3. FUNUJĒ INTERFACE THESIS

> **FUNUJĒ is a black-glass cultural operating system** — a premium record label operating inside a
> cinematic audio interface, where users move through **zones**, not pages, and Caribbean culture is
> expressed as **infrastructure** — rhythm, language, community, and signal — never as tropical
> decoration.

*(DECLARED — this is a restatement of the work order's own thesis, not an extraction.)*

**Operative consequences of the thesis** *(INFERRED)*:

- **"Operating system," not "website."** The interface should imply persistent state, live status, and
  user agency over a system — not a marketing funnel. Things should feel *on*.
- **"Zones," not "pages."** Navigation is spatial and named. A user *enters* The Vault; they do not
  *visit* /archive. Transitions between zones should carry more weight than transitions within one.
- **"Record label," not "marketplace."** Curation and authorship outrank conversion optimization.
  Editorial voice is a feature. Commerce is a zone, not the gravitational center.
- **"Culture as infrastructure."** Caribbean identity shows up in *system vocabulary* (sound system,
  dub plate, riddim, dance, selector), in *language*, and in *who is depicted and how* — not in
  palm-tree ornament or saturated "island" color.
- **"Cinematic audio interface."** The reference is a mastering suite, a broadcast desk, a mixing
  console — controlled, dark, instrumented, with meaning carried by small precise illuminated
  elements against deep black.

---

## 4. ZONE ARCHITECTURE

Nine zones are DECLARED by name. Purposes are DECLARED in gloss form; **modules, user roles, tone,
and adjacencies below are INFERRED** and require confirmation.

| Zone | Purpose *(DECLARED)* | Primary user | Likely core modules *(INFERRED)* | Tone *(INFERRED)* | Adjacency *(INFERRED)* |
|---|---|---|---|---|---|
| **The Signal** | Home / discovery | Visitor, fan | Hero frequency state, now-playing bar, featured drop, zone entries, editorial rail, live indicator | Arrival. Charged, cinematic, confident | Entry point to all zones; feeds The Stage, The Drop Room |
| **The Stage** | Featured artists / campaigns | Fan | Campaign hero, artist spotlight, run-of-show, tour/date strip, media gallery | Spotlit, event-scale, present-tense | ← The Signal; → The Booth, The Market |
| **The Vault** | Archive / catalog / legacy | Fan, researcher, crate-digger | Catalog grid, filter/sort rack, release tiles, lineage/credits, era navigation | Reverent, dense, archival | ← The Signal; → The Booth, The Drop Room |
| **The Console** | Artist / producer dashboard | Artist, producer | Metrics panels, release pipeline, payouts, asset status, alerts, activity log | Instrumented, precise, calm under load | Gated; → The Lab, The Drop Room |
| **The Lab** | Producer tools / collaboration | Producer, collaborator | Session/project list, stem & file exchange, versioning, comments, split sheets | Working, in-progress, candid | ← The Console; → The Drop Room |
| **The Drop Room** | Releases / exclusives | Fan (tiered), artist | Countdown, drop tile, access gate, claim/purchase, post-drop state | Urgent, scarce, ceremonial | ← The Lab/Console (supply); ← Inner Circle (access) |
| **The Booth** | Artist profile / storytelling | Fan, artist | Artist header, bio/story long-form, discography, media, quotes, links | Intimate, documentary, first-person | ← Stage, Vault; → Market |
| **The Market** | Merch / tickets / bundles | Fan | Product grid, bundle builder, cart/checkout, ticket tiles, size/variant, fulfilment status | Tactile, product-forward, premium-retail | ← Booth, Stage; ← Inner Circle (perks) |
| **The Inner Circle** | Membership / VIP access | Member | Tier comparison, membership state, perks ledger, early-access keys, member-only feed | Exclusive, warm, gold-accented | Cross-cuts: gates Drop Room, perks in Market |

**Zone-model observations** *(INFERRED)*:

- **Three audiences, one system.** Fan-facing (Signal, Stage, Vault, Drop Room, Booth, Market),
  maker-facing (Console, Lab), and membership (Inner Circle) are distinct interface registers.
  Maker-facing zones legitimately need higher information density and more mono/metadata treatment
  than fan-facing zones. Do not force one layout language across all nine.
- **The Inner Circle is not a zone, structurally — it is a permission layer** that also has a surface.
  It gates The Drop Room and modifies The Market. Model it as entitlement state, not just a route.
- **The Drop Room is the system's event loop.** It is where supply (Lab/Console) meets demand
  (Inner Circle/fans). It is the most state-dependent surface: pre-drop, live, sold-out, post-drop.
- **UNRESOLVED:** the relationship between The Vault and The Drop Room over time. Does a drop
  eventually *become* a vault item? If so, there is a lifecycle model nobody has specified yet.

---

## 5. BRAND DNA

| Layer | Content | Label |
|---|---|---|
| **Thesis** | Black-glass cultural operating system; premium record label inside a cinematic audio interface | DECLARED |
| **Emotional register** | Charged, controlled, intimate, nocturnal. Confident without shouting. Premium but human — never sterile, never cheap | INFERRED from declared image + motion direction |
| **Cultural posture** | Caribbean-global. Culture as infrastructure and authorship, not ornament or export-exotica. Insider voice, not tourist gaze | DECLARED (restated) |
| **Visual tone** | Deep black negative space, red as signal and authority, cream as warmth and readability, gold as access and privilege, glass as surface and depth | INFERRED from declared palette + motif set |
| **Linguistic posture** | Spatial and broadcast metaphors (zones, channels, rooms, decks, frequencies). Specific over generic. Confident, terse, rhythmic | DECLARED (navigation metaphor) + INFERRED (tone) |

---

## 6. DESIGN SYSTEM PULL

### 6.1 Color — values DECLARED, roles INFERRED, contrast VERIFIED by computation

Eight colors are DECLARED with exact hex values. Role assignment is INFERRED. **Contrast ratios below
were computed by this agent using the WCAG 2.x relative-luminance formula** — these are measured, not
estimated.

| Token | Hex | Proposed role *(INFERRED)* | On Obsidian `#050505` |
|---|---|---|---|
| Obsidian Black | `#050505` | Canvas / base ground. The default state of the system | — |
| Graphite Glass | `#171717` | Panel / card / elevated surface fill | **1.14:1** |
| Signal Red | `#E31B23` | Primary action, live/active state, brand field | **4.32:1** |
| Warm Cream | `#F4E6C8` | Primary text on dark; warm editorial foreground | **16.50:1** |
| Smoke Gray | `#8A8A8A` | Secondary text, metadata, inactive state | **5.90:1** |
| Soft Gold | `#C8A34A` | Premium / membership / access accent | **8.53:1** |
| Cyan Signal | `#28D7E8` | *Unassigned — see §11.2* | **11.62:1** |
| Deep Wine | `#5A0B12` | Atmospheric depth, gradient floor, hover ground | **1.45:1** |

**Measured accessibility findings — VERIFIED (computation):**

| Pairing | Ratio | Verdict |
|---|---|---|
| Warm Cream on Signal Red *(the DECLARED primary CTA)* | **3.82:1** | **FAILS WCAG AA** for body text (needs 4.5:1). Passes large-text only (3:1) |
| White on Signal Red | **4.72:1** | Passes AA |
| Obsidian on Signal Red | 4.32:1 | Large text only |
| Signal Red text on Obsidian | 4.32:1 | Large text only — **red is not a body-text color** |
| Signal Red text on Graphite Glass | 3.80:1 | Large text only |
| Deep Wine on Obsidian | **1.45:1** | Invisible as text. **Surface-only color** |
| Graphite Glass on Obsidian | **1.14:1** | **Invisible as fill alone — see §6.3** |
| Warm Cream on Obsidian | 16.50:1 | AAA |
| Warm Cream on Graphite Glass | 14.51:1 | AAA |
| Cyan Signal on Obsidian | 11.62:1 | AAA — *the most legible accent in the system* |
| Soft Gold on Obsidian | 8.53:1 | AAA |
| Smoke Gray on Obsidian | 5.90:1 | AA |
| Soft Gold on Deep Wine | 5.90:1 | AA — a viable premium pairing |

**Consequent rules** *(INFERRED from the measurements)*:

- **Do not use Warm Cream for small text on Signal Red.** Either (a) use white on red for button
  labels, (b) restrict cream-on-red to ≥24px / ≥19px-bold display text, or (c) darken the red for
  text-bearing fills. This needs a human decision — see §11.1.
- **Signal Red is a fill and accent color, not a text color.** At 4.32:1 on black it is legal only at
  large sizes. Red body copy, red small labels, and red metadata should all be prohibited.
- **Deep Wine and Graphite Glass are surface colors only.** Never text, never icons, never borders
  that must be seen unaided.
- **Cyan Signal is the highest-contrast accent available.** That alone argues for assigning it to
  data, metrics, and live telemetry in The Console — the place where legibility matters most.

### 6.2 Typography — stacks DECLARED, roles INFERRED

| Role | Declared candidates | Proposed assignment *(INFERRED)* |
|---|---|---|
| **Display** | Anton "or similar" — bold, wide, rounded/geometric, heavyweight, retro-broadcast / festival-poster | Zone titles, hero statements, drop names, wordmark lockups. Tight leading, generous tracking control. Uppercase-dominant |
| **Editorial** | Recoleta "or similarly expressive serif" | Long-form storytelling in The Booth, artist essays, pull quotes, vault annotations. **The humanizing counterweight to the geometry** |
| **UI / System** | Inter, Satoshi, Neue Haas Grotesk, Söhne, Helvetica Now, Space Grotesk, General Sans, Archivo | All interface chrome, labels, buttons, forms, navigation, body UI |
| **Mono accent** | JetBrains Mono, IBM Plex Mono, Space Mono | Metadata, IDs, release codes, analytics, timecodes, BPM/key, catalog numbers |

**Observations** *(INFERRED)*:

- **The mono role is unusually well-specified** and is the most FUNUJĒ-specific typographic decision
  in the set. Mono-for-metadata is what will make the interface read as *instrumented* rather than
  decorative. Treat it as load-bearing, not as an accent.
- **The UI stack lists eight candidates.** That is a shortlist, not a system. One must be chosen.
  See §11.3.
- **Three type families minimum** (display + editorial + UI) plus mono = four. That is a real
  performance budget. Variable fonts and subsetting should be planned from the start.
- **Anton has no companion weights** (single weight, no true italic). If display needs weight
  variation, "or similar" must resolve to a family that has it.

### 6.3 Surface & elevation logic — INFERRED

This is derived from the measured 1.14:1 fill contrast and the declared "rounded black-glass cards /
subtle red glow / soft shadows."

Because **a Graphite Glass panel on an Obsidian ground is effectively invisible by fill alone**, the
surface system must carry its structure in three other channels:

1. **Stroke** — a hairline border (suggest ~1px at low-opacity cream or white, e.g. `rgba(244,230,200,0.08–0.12)`) is what actually defines the panel edge. *This is the primary elevation signal.*
2. **Glow** — the declared "subtle red glow" should be **stateful, not ambient**: applied on hover,
   focus, live, and active states. Ambient red glow on every card wastes the signal and will read as
   cheap. Reserve it to mean *something is happening here*.
3. **Shadow** — soft, large-radius, near-black. On an almost-black ground, shadow contributes
   atmosphere and separation from the page, not edge definition.

**Elevation ladder** *(INFERRED, requires approval)*:

| Level | Use | Fill | Edge |
|---|---|---|---|
| 0 | Page ground | Obsidian `#050505` | none |
| 1 | Resting panel / card | Graphite Glass `#171717` | hairline cream @ 8% |
| 2 | Raised / hovered | Graphite + subtle lift | hairline cream @ 12% + soft shadow |
| 3 | Active / live / focused | Graphite | red-tinted edge + red glow |
| 4 | Modal / overlay | Graphite over scrim | stronger shadow + backdrop blur |

**Border radius:** "rounded" is DECLARED; **no value is given — UNRESOLVED.** A scale must be chosen
(a plausible starting proposal: 8 / 12 / 16 / 24px with full-round for pills and chips). Do not
treat any specific radius in this document as canon.

**Spacing:** **UNRESOLVED.** No spacing information exists in the source or the work order. An 8pt
base grid is the conventional default but is *not* grounded in anything FUNUJĒ.

### 6.4 CTA system — DECLARED, with one measured correction

| CTA type | Declared specification | Status |
|---|---|---|
| **Primary** | Signal-red fill with cream/white text | DECLARED — **cream variant fails AA at body size (3.82:1); white variant passes (4.72:1)**. Recommend white for labels |
| **Secondary** | Black-glass fill with red outline | DECLARED. Note the red outline itself is a non-text element; ensure the *label* inside uses cream/white, not red |
| **Premium / access** | Gold accent | DECLARED — for membership, VIP, early access, Inner Circle entry points |

*(INFERRED)* A fourth is implied but unstated: a **quiet / tertiary** action (text-only, smoke gray or
cream) for low-emphasis operations — especially needed in The Console and The Lab, where dense
dashboards cannot afford three loud button styles. **UNRESOLVED.**

### 6.5 Motif system — motifs DECLARED, functions INFERRED

The work order asks that each motif be defined by **function, not appearance**.

| Motif | Function *(INFERRED)* |
|---|---|
| **Red Field** | Declares brand authority and ownership of a space. A full red plane is the loudest statement the system can make. Use for wordmark lockups, zone thresholds, and moments of maximum assertion. Scarcity is what preserves its power |
| **Black Glass Panel** | The container of all system content. Signifies "this is a surface of the OS." Depth and containment, not decoration |
| **Signal Bar / macron over Ē** | The brand's literal diacritic doubling as a system mark. Functions as *attention and emphasis* — the thing above the letter that says "this one." Natural fit for active-state indicators, section markers, and the active nav underline |
| **Waveform** | Represents *content that has sound and duration*. Functions as the universal signifier of an audio object — a release, a stem, a session. Also a progress and scrub affordance |
| **Frequency Ring** | Represents *live, ongoing, or cyclical state* — broadcasting, loading, membership tier, progress toward a goal. The circular counterpart to the linear waveform |
| **Red Dot** | Binary live/new/unread indicator. The smallest possible unit of signal. Must mean exactly one thing system-wide, or it means nothing |

### 6.6 Component vocabulary — INFERRED from declared direction + zone model

Grouped by the categories the work order requested. **All INFERRED.**

- **Cards / panels** — Release tile, artist card, product card, stat panel, session card, membership
  tier card. Common base: rounded black-glass + hairline stroke + stateful glow.
- **Nav structures** — Zone switcher (the primary, spatial navigation), in-zone sub-nav (channels /
  decks), breadcrumb-as-signal-path, persistent player-aware footer.
- **Player / audio surfaces** — Persistent mini-player (survives zone transitions — this is what
  makes it an OS), expanded now-playing, inline waveform preview, queue/deck.
- **CTA types** — Primary (red), secondary (glass + red outline), premium (gold), quiet (text).
- **Status chips** — Live, Dropping, Sold Out, Members Only, Archived, Draft, Scheduled. Mono type.
- **Release tiles** — Artwork, display title, mono metadata line (catalog no., date, format), state
  chip, waveform affordance.
- **Artist modules** — Compact (list/grid), expanded (Booth header), credit-line (in Vault lineage).
- **Commerce modules** — Product grid, variant selector, bundle builder, cart drawer, ticket tile.
- **Membership modules** — Tier comparison, current-state badge, perk ledger, access key, upgrade CTA.
- **Dashboard modules** — Metric panel with mono figures, time-series, pipeline/kanban, payout
  summary, alert row, activity log.
- **Metadata treatments** — The mono system: catalog numbers, ISRC, BPM, key, duration, timestamps,
  file sizes, version tags. **Consistent mono treatment across all nine zones is the strongest
  single cue that these surfaces belong to one operating system.**

---

## 7. MOTION SYSTEM

Five motion types are DECLARED: **pulse, slide, float, scan, fade.** Timing is DECLARED as "musical,
tactile, and controlled." Communicative assignments below are INFERRED.

| Motion | Communicates *(INFERRED)* | Typical use |
|---|---|---|
| **Pulse** | Liveness, heartbeat, attention. "This is on / happening now" | Live dots, frequency rings, countdowns, recording state |
| **Slide** | Spatial movement between places | Zone transitions, drawers, panel entry, carousel |
| **Float** | Elevation, hover, availability, tactility | Card hover lift, FAB, tooltip emergence |
| **Scan** | System activity, processing, reading | Loading, upload/analysis in The Lab, search, skeleton states |
| **Fade** | Appearance/disappearance without spatial claim | Overlays, scrims, cross-dissolve, de-emphasis |

**Pacing principles** *(INFERRED from "musical, tactile, controlled")*:

- **Rhythm over speed.** "Musical" implies a consistent underlying beat. Propose a tempo-derived
  duration scale rather than arbitrary milliseconds — e.g. a base unit with ×0.5 / ×1 / ×2 / ×4
  multipliers, so every motion in the system is in time with every other.
- **Micro-interactions fast (~120–200ms), zone transitions deliberate (~400–600ms).** Zone changes
  are spatial events and should be felt; button feedback should be immediate.
- **"Controlled" means easing discipline.** No bounce, no elastic, no overshoot. Custom cubic-bezier
  curves with decisive deceleration. Nothing playful or springy — this is a mastering suite, not a
  consumer toy.
- **Pulse is the only acceptable looping animation.** Everything else resolves. Perpetual ambient
  motion contradicts "controlled."
- **UNRESOLVED:** no actual duration or easing values are declared anywhere. The entire motion
  system is directional only.

**Reduced motion** *(INFERRED — the work order requires the expectation be stated, but declares
nothing)*:

- Honor `prefers-reduced-motion: reduce` globally.
- Under reduced motion: **slide → fade**, **float → static elevation change**, **scan → static
  indeterminate state**, **pulse → static dot with no animation**, **fade → shortened or instant**.
- **Liveness must survive reduced motion.** If a pulsing dot is the only indicator that something is
  live, reduced-motion users lose information. Pair every motion-carried meaning with a static
  equivalent (color, label, chip).

---

## 8. IMAGE DIRECTION

All DECLARED. Reproduced here as the operative brief.

**World / subject:** cinematic · intimate · nightlife-aware · emotionally grounded · textured ·
premium but human · Caribbean-global · documentary-real with editorial polish.

**Lighting grammar:** red edge light · warm practicals · blue-hour ambience · deep black negative
space · soft directional key · controlled shadow · atmospheric haze · reflective glass and polished
surfaces.

**Realism requirements** *(INFERRED from the declared avoid-list)*: visible skin texture, real
imperfection, real environments, real grain. The avoid-list is unusually specific about *failure
modes of synthetic imagery*, which implies image sourcing will be scrutinized for AI-tells.

**Explicit avoidance rules — DECLARED, non-negotiable:**

- ✗ fake tropical saturation
- ✗ generic beach or palm imagery
- ✗ plastic AI skin
- ✗ cheap neon overload
- ✗ cartoon futurism
- ✗ overpolished imagery without human texture

**Interface consequence** *(INFERRED)*: because the ground is near-black (`#050505`), images with deep
black negative space will **bleed into the canvas edgelessly**. This is an asset, not a bug — plan for
full-bleed imagery that dissolves into the UI rather than sitting in hard-edged boxes. It also means
image selection must be lighting-compatible; a bright, evenly-lit photo will look pasted on.

---

## 9. LANGUAGE SYSTEM

**Preferred metaphors** *(DECLARED)*: channels · rooms · decks · frequencies. Plus zones as the
top-level spatial unit.

**Preferred navigation labels** *(DECLARED zone names)*: The Signal · The Stage · The Vault · The
Console · The Lab · The Drop Room · The Booth · The Market · The Inner Circle.

**Vocabulary to avoid** *(INFERRED from "avoid generic menu language where stronger FUNUJĒ language
exists")*:

| Avoid | Prefer |
|---|---|
| Home | The Signal |
| Dashboard | The Console |
| Archive / Catalog / Library | The Vault |
| Shop / Store | The Market |
| Profile / About the artist | The Booth |
| Premium / Subscribe / Pro | The Inner Circle |
| Releases / New | The Drop Room |
| Workspace / Studio tools | The Lab |
| Featured | The Stage |
| Page, site, menu, tab | zone, channel, room, deck |

**Tone guidance** *(INFERRED)*: terse, confident, present-tense. Specific nouns over abstractions.
The system talks like a selector, not a support agent.

**Caution** *(INFERRED)*: proprietary navigation vocabulary carries a real discoverability cost for
first-time users. The zone names should be *reinforced*, not explained away — e.g. a one-line
descriptor on first visit, or an icon + name pairing — rather than replaced by generic labels at the
first sign of user confusion. **This is a deliberate trade the brand is making; it should be made
knowingly.**

---

## 10. IMPLEMENTATION GUIDANCE

### 10.1 What a downstream team should build from this

**Do not start with screens. Start with the primitive layer**, because the thesis ("one operating
system, nine zones") only holds if the primitives are literally shared:

1. **Token layer** — colors with semantic role names, type scale and role mapping, radius scale,
   spacing scale, elevation ladder, motion durations/easings. Resolve the open questions in §11 first.
2. **Surface primitive** — the black-glass panel (fill + stroke + shadow + stateful glow). Everything
   visual in FUNUJĒ is a variation of this single component. Get it right once.
3. **Metadata primitive** — the mono text treatment. The cheapest, highest-signal consistency win.
4. **State chip primitive** — Live / Dropping / Sold Out / Members Only / Archived.
5. **CTA primitives** — four variants (primary, secondary, premium, quiet), accessibility-corrected.
6. **Motif primitives** — waveform, frequency ring, red dot, signal bar. As components with defined
   *meanings*, enforced by prop API, not as loose SVGs.
7. **Zone shell** — the persistent frame: zone switcher, persistent player, zone-transition behavior.
   This is what converts "a set of pages" into "an operating system."

### 10.2 What should become reusable primitives

Tokens → `Surface` → `MetaText` → `StateChip` → `Button` (4 variants) → `Waveform` / `FrequencyRing` /
`RedDot` / `SignalBar` → `ZoneShell` + `PersistentPlayer` → zone-specific compositions.

A provisional, clearly-marked machine-readable token draft accompanies this document at
`concepts/funuje-interface-tokens.draft.json`. **It is DECLARED+INFERRED, not canon.**

### 10.3 Recommended first product surface — CONDITIONAL

**No runtime product repository is available.** The provided repository (`wrasal-control-`) is, by its
own README, "implementation-neutral… does not contain product or runtime code." Per the authority
envelope, **no UI has been implemented and Phase 4 stopped here.** *(VERIFIED)*

If and when a FUNUJĒ runtime repository is supplied, the recommendation is:

> **Start with The Signal.** *(INFERRED)*

Rationale:

- It is the **only zone that must express the entire thesis at once** — brand, discovery, editorial,
  navigation, atmosphere, and the persistent player. If black-glass-cultural-OS cannot be felt on The
  Signal, it will not be felt anywhere.
- It is the **natural home of the ZoneShell primitive** (zone switcher + persistent player + zone
  transitions). Building it first produces the frame every other zone inherits, rather than
  retrofitting a frame later.
- It exercises **every unresolved decision in §11** — CTA contrast, cyan's role, the UI typeface
  choice, radius scale, motion tempo — forcing them to resolve early and cheaply.
- It is **publicly shareable**, so brand approval can happen against something real.

**The Console is the right second surface, not the first.** It proves depth, density, dashboard
logic, and the mono/metadata system under load — but it is gated, invisible to most stakeholders, and
depends on primitives that The Signal will have already established. Building The Console first risks
optimizing the system for its most atypical register.

---

## 11. CONFLICTS / AMBIGUITIES

Where sources conflict or are silent, no choice has been made silently. Each item below carries a
preferred interpretation, rationale, confidence, and approval requirement.

### 11.1 Primary CTA fails accessibility contrast — **UNRESOLVED (highest priority)**
- **Conflict:** DECLARED primary CTA is "signal-red with cream/white text." Measured: cream on red =
  **3.82:1**, below WCAG AA 4.5:1 for normal text. White on red = 4.72:1, passes.
- **Preferred interpretation:** use **white** for small/body CTA labels; reserve **cream** on red for
  large display text only (≥24px, or ≥19px bold).
- **Rationale:** preserves the declared color pair where it is legal, fixes it where it is not,
  changes no hex value.
- **Confidence:** High on the measurement, medium on the remedy (an alternative is to darken the red
  for text-bearing fills, which changes the palette).
- **Human approval required:** **Yes** — this touches the brand's primary action color.

### 11.2 Cyan Signal has no declared role — **UNRESOLVED**
- **Conflict:** `#28D7E8` is the only cool, high-tech hue in an otherwise warm, analog, cinematic
  palette. No usage is declared. It also competes with Signal Red for "signal" meaning.
- **Preferred interpretation:** restrict Cyan Signal to **data, telemetry, and live-metric
  visualization inside The Console and The Lab** — maker-facing zones only. Keep it out of fan-facing
  zones entirely.
- **Rationale:** it is the highest-contrast accent available (11.62:1 on black), which suits dense
  numeric readouts; and confining it to the instrumented zones resolves both the tonal clash and the
  semantic collision with red.
- **Confidence:** Medium. This is a defensible inference, not a declared rule.
- **Human approval required:** **Yes.**

### 11.3 "Signal" is overloaded three ways — **UNRESOLVED**
- **Conflict:** `Signal Red` (color), `Cyan Signal` (color), `The Signal` (zone), plus `Signal Bar`
  (motif). Four referents, one word. Token names like `color.signal` will be ambiguous immediately.
- **Preferred interpretation:** keep all brand-facing names as declared, but **namespace the
  engineering tokens unambiguously** — e.g. `color.brand.red`, `color.accent.cyan`, `zone.signal`,
  `motif.signal-bar`. Never ship a bare `signal` token.
- **Rationale:** preserves brand language while preventing implementation collisions.
- **Confidence:** High.
- **Human approval required:** No — naming convention only, reversible.

### 11.4 UI typeface is an eight-candidate shortlist, not a decision — **UNRESOLVED**
- **Conflict:** Inter, Satoshi, Neue Haas Grotesk, Söhne, Helvetica Now, Space Grotesk, General Sans,
  Archivo are all listed. These are not interchangeable — Söhne and Neue Haas are licensed and carry
  real cost; Space Grotesk is idiosyncratic; Inter is the neutral default.
- **Preferred interpretation:** no recommendation is made without brand input. If forced, **Satoshi or
  General Sans** best match "premium but human" while remaining cost-reasonable.
- **Confidence:** Low. This is a taste-and-budget decision, not an extractable one.
- **Human approval required:** **Yes.**

### 11.5 Display face "Anton or similar" is single-weight — **UNRESOLVED**
- **Conflict:** Anton ships one weight with no true italic. A display system usually needs at least
  two weights for hierarchy.
- **Preferred interpretation:** confirm whether "or similar" should resolve to a multi-weight family
  (e.g. a wide grotesque display with 2–3 weights).
- **Confidence:** Medium.
- **Human approval required:** **Yes.**

### 11.6 No spacing, radius, or motion values exist anywhere — **UNRESOLVED**
- **Conflict:** "rounded," "soft shadows," "musical timing" are directional adjectives with no
  numbers. The work order asks for "spacing tendencies if inferable" — they are **not** inferable from
  the available material.
- **Preferred interpretation:** propose an 8pt spacing grid, a 8/12/16/24 radius scale, and a
  tempo-derived motion scale as *starting proposals only*, to be validated visually on The Signal.
- **Confidence:** Low — these are conventions, not findings.
- **Human approval required:** **Yes**, but cheaply, by looking at a built surface.

### 11.7 Vault ↔ Drop Room lifecycle undefined — **UNRESOLVED**
- **Conflict:** both zones hold releases. Whether a drop graduates into the vault, and on what
  trigger, is unspecified. This is a data-model question disguised as an IA question.
- **Human approval required:** **Yes** — affects schema, not just layout.

### 11.8 Zone-name discoverability trade — **UNRESOLVED**
- **Conflict:** proprietary navigation vocabulary is core to the brand and a known usability cost.
- **Preferred interpretation:** keep the names; support them with icons and first-run descriptors;
  measure rather than assume.
- **Confidence:** Medium.
- **Human approval required:** No, but should be tested.

### 11.9 The absence of all source material is itself the largest ambiguity — **UNRESOLVED**
- Everything in §§3–10 rests on work-order declaration. If the real brand bible contradicts any of it,
  the brand bible wins. **This document must be re-run against the actual sources before any of it is
  treated as canon.**

---

## 12. VERIFICATION

**What was actually inspected, and how** *(all VERIFIED)*:

| # | Action | Tool | Observed result |
|---|---|---|---|
| 1 | Enumerate entire connected Drive | `google_drive.list_files` (`trashed=false`, `corpora=allDrives`, `include_items_from_all_drives=true`, page_size 200) | 44 files, `next_page_token: null` — complete enumeration. No FUNUJĒ item |
| 2 | Enumerate shared drives | `google_drive.list_drives` | 0 shared drives |
| 3 | Enumerate trash | `google_drive.list_files` (`trashed=true`) | 0 files |
| 4 | Name search | `google_drive.search_files` — `Funuj` / `FUNUJ` / `funuje` | 0 results |
| 5 | Name search | `google_drive.search_files` — `Brand Guidelines` / `Brand Bible` / `wordmark` / `v001` | 0 results |
| 6 | Content search | `google_drive.search_files` — fullText `Funuje` / `FUNUJ` / `Feel The Frequency` | 1 result (`Studio M`) |
| 7 | Read the single match | `google_drive.read_file_text` on `10HAr8...` | Full text read (6,975 bytes). Studio-rental business plan, "Oasis M". No FUNUJĒ content. False positive |
| 8 | Notion targeted search | `notion.search` query `FUNUJ` | 0 results |
| 9 | Notion full enumeration | `notion.search` sorted by last_edited_time | Unmodified Notion starter workspace only |
| 10 | Linear teams | `linear.get_teams` | 1 team: Wrasal (`WRA`) |
| 11 | Linear projects | `linear.get_projects` | 12 projects, none FUNUJĒ |
| 12 | Repository inspection | filesystem walk, `git log`, `grep -ri "funuj\|frequency\|signal"` | No FUNUJĒ reference. Control-plane records only; no product/runtime code |
| 13 | Contrast computation | `node` script, WCAG 2.x relative luminance | 18 pairings computed; results in §6.1 |

**Not verified:** every design assertion in §§3–10 that is labeled DECLARED or INFERRED. No visual
artifact was seen by this agent. No runtime was executed. No brand approval exists.

---

## 13. ACCEPTANCE

| # | Criterion | State | Rationale |
|---|---|---|---|
| 1 | Inspect all available FUNUJĒ source materials from connected Drive | **PASS** | Exhaustive enumeration performed and documented in §12. The inspection itself succeeded |
| 2 | Inspect "Funujē Brand Guidelines v001" | **FAIL** | The asset does not exist in any connected system |
| 3 | Inspect the 8 expected reference assets | **FAIL** | 0 of 8 present |
| 4 | Report missing sources explicitly | **PASS** | §2.2 enumerates all missing sources |
| 5 | Do not invent missing source content | **PASS** | No asset reconstructed or substituted; all non-observed claims labeled DECLARED/INFERRED/UNRESOLVED |
| 6 | Extract BRAND DNA layer | **PARTIAL** | §5 produced from declaration + inference, not from sources |
| 7 | Extract IA / zone model | **PARTIAL** | §4 — names DECLARED; modules, roles, adjacencies INFERRED |
| 8 | Extract design tokens | **PARTIAL** | §6 — color/type DECLARED; roles INFERRED; spacing/radius UNRESOLVED |
| 9 | Extract component vocabulary | **PARTIAL** | §6.6 — entirely INFERRED; no source component existed to observe |
| 10 | Extract motion grammar | **PARTIAL** | §7 — five types DECLARED; all values UNRESOLVED |
| 11 | Extract image system | **PASS (as declaration)** | §8 — the work order's image direction is complete and self-sufficient; reproduced without invention |
| 12 | Extract iconography/motifs with function defined | **PARTIAL** | §6.5 — motifs DECLARED; functions INFERRED |
| 13 | Normalize into reusable implementation guidance | **PASS** | §10 + token draft artifact |
| 14 | Document conflicts rather than silently choosing | **PASS** | §11 — 9 items, each with interpretation, rationale, confidence, approval flag |
| 15 | Apply VERIFIED/INFERRED/UNRESOLVED labeling | **PASS** | Applied throughout; §0 declares the added DECLARED tier and why |
| 16 | Recommend first product surface | **PASS (conditional)** | §10.3 — The Signal, explicitly conditional on a repo being supplied |
| 17 | Do not implement UI in a repo not provided | **PASS** | No UI implemented. Phase 4 stopped correctly |
| 18 | Do not claim runtime verification without runtime access | **PASS** | No runtime claim made anywhere |
| 19 | Do not override source identity with generic trends | **PASS** | No external UI reference was consulted or applied |
| 20 | Produce implementation-ready interface intelligence package | **PARTIAL** | Package produced, but grounded in declaration rather than source evidence |

**Absence of a source was never treated as evidence of compliance.** Criteria 2 and 3 are recorded as
FAIL, not N/A.

---

## 14. BLOCKERS / RISKS

| Severity | Item |
|---|---|
| **BLOCKER** | **Zero FUNUJĒ source material in any connected system.** The primary objective — a *source-grounded* pull — cannot be satisfied. Everything downstream inherits this limitation |
| **BLOCKER** | No runtime product repository. Phase 4 cannot proceed beyond recommendation |
| **HIGH RISK** | **Likely wrong Drive account connected.** Connected Drive is dominated by "My Favorite Jamaican" 2024 material across three Gmail identities. FUNUJĒ assets probably live elsewhere. Cheapest possible fix; highest possible payoff |
| **HIGH RISK** | Treating this document as canon. It is a *normalization of instructions*, not an extraction from artifacts. If the real brand bible differs, this is wrong |
| **MEDIUM RISK** | Measured accessibility defect in the declared primary CTA (§11.1) will propagate into every zone if tokens are built before it is resolved |
| **MEDIUM RISK** | Eight unresolved system decisions (§11) block a stable token layer. Building components before resolving them guarantees rework |
| **LOW RISK** | Four type families is a real performance budget on a media-heavy, image-forward product |

---

## 15. NEXT ACTION

> **Connect the Google account that actually holds the FUNUJĒ Drive folder and "Funujē Brand
> Guidelines v001," then re-run Phase 1.**

Everything else is secondary. A genuine source-grounded pull against the real brand bible would
convert the bulk of this document from DECLARED/INFERRED to VERIFIED, resolve most of §11, and is
cheaper than any amount of further inference. If the assets exist only outside Drive (Figma, local
disk, email), supplying them in any readable form is equally sufficient.

**Second action, if and only if the sources cannot be produced:** treat §11.1 (CTA contrast), §11.2
(cyan's role), §11.3 (token namespacing), and §11.4 (UI typeface) as a four-question approval round
with the brand owner. Those four answers unblock a buildable token layer.

---

*This record is a non-runtime concept record. It establishes no canonical acceptance, creates no
project facts, and asserts no brand approval.*
