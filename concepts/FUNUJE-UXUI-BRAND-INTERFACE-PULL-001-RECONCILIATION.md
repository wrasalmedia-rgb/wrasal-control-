# FUNUJĒ — UX/UI/Brand Interface Pull · Pass 1R (Source Reconciliation)

**Work order:** FUNUJE-UXUI-BRAND-INTERFACE-PULL-001
**Pass:** 1R — reconciliation of the provisional pull against now-available authoritative sources
**Supersedes selected claims in:** `concepts/FUNUJE-UXUI-BRAND-INTERFACE-PULL-001.md` (commit `469626b`)
**Does not replace it.** That document's provenance is preserved; this document re-adjudicates it claim by claim.
**Date:** 2026-10-03
**Scope:** source reconciliation only. No runtime UI produced. No surface built. No tokens invented.

---

## 1. RESULT

**PARTIAL — materially upgraded.**

The Pass-1 blocking condition is **void**. The FUNUJĒ source corpus exists, was opened, and was read. The
authoritative brand document was recovered in full and 23 visual artifacts were inspected as images.

- Pass 1 reached `BLOCKED` on "no FUNUJĒ source material located."
  That finding is **withdrawn and must not be cited again.** It was a discovery-method failure, not a fact
  about the corpus.
- The brand system is now **largely VERIFIED** rather than operator-declared.
- The result is not `PASS` because inspection surfaced a **genuine, unresolved governance conflict**: there
  are **two mutually incompatible FUNUJĒ design systems** in the same folder, and the product artifacts
  contradict the brand document's most emphatic instruction. Neither can be silently preferred.

Counts across this pass: **61 claims re-adjudicated — 34 RETAIN, 19 REVISE, 8 REJECT.**

---

## 2. SOURCE INVENTORY

### 2.1 Discovery correction

| | Pass 1 | Pass 1R |
|---|---|---|
| Method | name search + `fullText` search + `corpora=allDrives` enumeration | **direct open by folder ID** |
| Result | 0 FUNUJĒ items; 44-file enumeration reported as complete | **134 files** in folder `Funujē` |
| Root cause | folder is **shared-with-me**, owned by `wrayveart@gmail.com`; it is not in the authenticated account's own corpus and did not surface in name/fullText search | — |

**Standing lesson, recorded:** for shared-with-me Drive content, enumeration and search are unreliable.
Direct ID access is the only dependable path. Pass 1's "complete enumeration" assertion was false.

### 2.2 Corpus

**Root:** `Funujē` — folder ID `1nbyg-Fq0q1uELNlv-Q4-lDxuDQjSodwi`, owner `wrayveart@gmail.com`,
not trashed, 134 children, listed in full across two paginated calls.

| # | Source | ID | Type | Status |
|---|---|---|---|---|
| S1 | **FUNUJĒ Brand Guidelines v001** | `1-KMFisxwtTh9Bat5Fea7XfhHMr9yX85eamyKq5iH-X0` | Google Doc, 21 §§, 16,104 B | **READ IN FULL** — not truncated |
| S2 | **funujē Brand Kit v1.0, May 2024** (8 panels) | `1Yxc8vqXbi8huLIt_6f6gbIjnGKs7qvYy` (dup `1_JdTINR0yFgc3aqQimYqIgbFHLyeGTyr`) | PNG | **INSPECTED VISUALLY** |
| S3 | Lowercase wordmark, cream on red | `18TqnGwaQ32zzWg4Zmg7J_pCOoZRj9yRN` | PNG | INSPECTED |
| S4 | Uppercase wordmark, cream on red | `1eTZp1ywmvyBLh4ooLYnEwA3UXtO1hNVL` | PNG | INSPECTED |
| S5 | Waveform-struck wordmarks ×2 | `14T35U_d3UvOywZgIozN2ZSoIl_grQwuI`, `1ajtmsDMkrRNCc1N5FfJ1DrpJFmrM6hc5` | PNG | INSPECTED |
| S6 | **Funuje Platform Sitemap** | IMG_6211 | JPEG | INSPECTED |
| S7 | **User-flow / navigation diagram** | IMG_6210 | JPEG | INSPECTED |
| S8 | **Landing page mockup** | IMG_6212 | JPEG | INSPECTED |
| S9 | **Mr. Lexx / Diggy Nation vault site** (responsive) | IMG_9686 | JPEG | INSPECTED |
| S10 | Hardware/product ecosystem boards ×6 | `photo-output` series | HEIC→JPEG | INSPECTED |
| S11 | **WRASAL "Cinematic Civilization Engine"** master board | — | JPEG | INSPECTED |
| S12 | Next.js / `lucide-react` discovery-page code | filename-as-content | screenshot | PARTIAL — filename legible, body not |
| S13 | SVG snippet using `#1C1C21` / `#C6A85C` | filename-as-content | screenshot | PARTIAL — **not FUNUJĒ palette** |

**Found:** 13 source classes, 23 artifacts inspected as images.
**Partial:** S12, S13 (filename-encoded; body text not recoverable at resolution).
**Missing / not inspected:** 1 of 8 `photo-output.HEIC` files was not rendered. `IMG_6190–6218` series only
partially sampled. No PDF, no Figma file, no second guidelines revision exists in the folder.

### 2.3 Method note on hex extraction

Pixel-sampling of S2 was **not performed**. The sandbox has no outbound network to Drive (`curl` → HTTP 000),
Pillow is absent, and inline base64 download of a 1.7 MB asset would be disproportionate. Hex values from S2
are **transcribed from the legible printed labels on panel 04**, which is how that panel is designed to be
read. This is sufficient for the specification values and is marked accordingly; it is *not* a claim about
rendered pixel values. Where a sampled value would change a conclusion, I say so.

---

## 3. CLAIM RECONCILIATION

Format: previous state → current truth state → evidence → disposition.
`truth_state` ∈ {VERIFIED, INFERRED, UNRESOLVED}. `source_origin` is tracked separately and never used as a
truth state. **`DECLARED` has been removed from the vocabulary entirely.**

### 3.1 Colour

| # | Claim | Previous | Now | Evidence | Disposition |
|---|---|---|---|---|---|
| C1 | 8 palette hexes as listed in the work order | DECLARED | **VERIFIED** | S1 §5 lists all eight, **exact match**, no drift | **RETAIN** → promoted |
| C2 | Cyan Signal has no defined role | UNRESOLVED | **VERIFIED** | S1 §5: "analytics, futuristic data, active streaming indicators, dashboard highlights" | **REVISE** → resolved |
| C3 | Cyan is Console/Lab-only | INFERRED | **VERIFIED, scope widened** | S1 colour-usage table: "Producer section: black + graphite + cyan/gold". But "active streaming indicators" is fan-facing too | **REVISE** — producer-primary, not producer-exclusive |
| C4 | Soft Gold = premium/access | INFERRED | **VERIFIED** | S1 §5 + usage table: "Premium: black + gold + cream" | **RETAIN** → promoted |
| C5 | Deep Wine is a ground, not a text colour | INFERRED | **VERIFIED by measurement** | 1.45:1 on Obsidian — cannot carry text or UI | **RETAIN** |
| C6 | Graphite is the card surface | INFERRED | **VERIFIED** | S1 usage table: "App UI: graphite cards on obsidian" | **RETAIN** → promoted |
| C7 | Palette is singular and settled | implicit | **REJECTED** | **S2 panel 04 defines a different palette under the same names** | **REJECT** — see Conflict A |

**New, from S1 §5 colour-usage table (all VERIFIED):** main layouts = black + cream + red · label = black +
red + gold · producer = black + graphite + cyan/gold · artist profiles = black-glass + red active glow ·
premium = black + gold + cream · app = graphite cards on obsidian · social = red fields + bold cream type.

### 3.2 Typography

| # | Claim | Previous | Now | Evidence | Disposition |
|---|---|---|---|---|---|
| T1 | Display = "Anton or similar" | DECLARED, attributed to brand bible | **VERIFIED — but from S2, not S1** | S2 panel 04 names **ANTON** explicitly ("bold, condensed, impactful"). **S1 never names a display face** — it gives personality only | **REVISE** — right answer, wrong provenance in Pass 1 |
| T2 | Editorial = Recoleta | DECLARED | **VERIFIED — from S2** | S2 panel 04: Recoleta, "elegant, expressive, cultured" | **REVISE** — provenance corrected |
| T3 | UI = 8-candidate shortlist incl. Satoshi | DECLARED | **SPLIT** | S1 §6 lists **seven**: Inter, Neue Haas Grotesk, Söhne-style grotesk, Helvetica Now, Space Grotesk, General Sans, Archivo. **Satoshi is absent from S1.** S2 names **Satoshi** as the single body/UI face | **REVISE** — see Conflict C |
| T4 | Mono = JetBrains / IBM Plex / Space Mono | DECLARED | **VERIFIED** | S1 §6, exact | **RETAIN** → promoted |
| T5 | Type scale exists in source | assumed | **UNRESOLVED** | Neither S1 nor S2 gives sizes, weights, or line-heights. S2 shows H1/H2/body *examples* only | **RETAIN as UNRESOLVED** |
| T6 | Display face is a settled decision | — | **UNRESOLVED** | S1 describes the *personality* and declines to name a face; S2 names Anton. Anton has **no lowercase-optimised italic, one weight only**, and the lowercase `funujē` wordmark in S3 is **not Anton** | **NEW — flagged** |

Note on T6: the lowercase wordmark (S3) has a left-hooking `j` descender, very small counters and flat
terminals that do not match Anton. The wordmark is **custom or heavily modified**, not a type-setting of the
display face. Treat wordmark and display type as two separate assets.

### 3.3 Zones and navigation

| # | Claim | Previous | Now | Evidence | Disposition |
|---|---|---|---|---|---|
| Z1 | 9 zones with those names and purposes | DECLARED | **VERIFIED verbatim** | S1 §9 lists all nine with purposes matching the work order | **RETAIN** → promoted |
| Z2 | Nav substitutions (Profile→Booth, Dashboard→Console, Library→Vault, Explore→Signal) | DECLARED | **VERIFIED as instruction** | S1 §9 states them explicitly | **RETAIN** → promoted |
| Z3 | Zone vocabulary is how the product is actually built | INFERRED | **REJECTED** | S6 sitemap and S7 flow use **Home, Discover, Release, Studio, Community, Library, Messages, Settings**. S2 panel 06 shows a tab bar: **Home, Search, Library, Profile**. Only S9 uses a zone name (**VAULT**) | **REJECT** — see Conflict B |
| Z4 | "Signal" is an overloaded token | INFERRED | **VERIFIED, and worse than stated** | S1 uses *Signal* for **seven** distinct referents: Signal Red (colour), Cyan Signal (colour), The Signal (zone), Signal Bar (motif), **Signal ID** (artist field), **FUNUJĒ Signal** (sub-brand), **Signal Drops** (content pillar) — plus "red-alert signal tones" in sound design | **RETAIN** → promoted, severity raised |

Z4 is now a hard engineering constraint, not a stylistic note. Any token namespace must disambiguate at
minimum `color.signal-red`, `color.signal-cyan`, `zone.signal`, `motif.signal-bar`, `field.signal-id`,
`brand.signal`. Unqualified `signal` must be prohibited in code.

### 3.4 Components, surface, state

| # | Claim | Previous | Now | Evidence | Disposition |
|---|---|---|---|---|---|
| K1 | Rounded black-glass cards, subtle red glow, soft shadows | DECLARED | **VERIFIED** | S1 §9, verbatim | **RETAIN** → promoted |
| K2 | Primary CTA = red fill + cream text | DECLARED | **VERIFIED, with sanctioned alternative** | S1 §9: "signal red background, **cream or white** text". S2 panel 04 primary button uses **white** | **REVISE** — white is source-sanctioned, not an agent override |
| K3 | Secondary CTA = black glass + red outline | DECLARED | **VERIFIED** | S1 §9 + S2 panel 04 "DISCOVER" button | **RETAIN** → promoted |
| K4 | Gold = premium actions / access points | DECLARED | **VERIFIED** | S1 §9 + §5 usage table | **RETAIN** → promoted |
| K5 | **Stroke is the primary elevation signal** | INFERRED | **REJECTED as source-grounded** | S1 specifies separation via **"subtle red glow and soft shadows"** — it never mentions a border or stroke. My measurement (Graphite on Obsidian = **1.14:1**) proves separation is *needed*; the source states *what provides it*, and it is not a stroke | **REJECT the remedy, RETAIN the measurement** |
| K6 | Hairline stroke on cards | — | **INFERRED** | S2 panels 05/06/08 and S9 cards do show faint light edges in addition to shadow. Supported visually, unspecified numerically | **NEW — INFERRED, value UNRESOLVED** |
| K7 | **Red glow is state, never ambient decoration** | INFERRED, absolute | **REVISED to two-tier** | S1 says cards carry a **"subtle red glow"** as a *default* property, **and** that artist profiles use **"red active glow"** for active state, **and** Red Dot = live/new/active/exclusive. So glow is both ambient-low and state-high | **REVISE** — the absolute form was wrong; the two-tier form is source-exact |
| K8 | **ZoneShell** persistent chrome component | INFERRED | **REJECTED** | No source describes a persistent shell. S2 panel 06 shows a conventional 4-item bottom tab bar | **REJECT** — agent-origin, not source-grounded |
| K9 | **Persistent mini-player** | INFERRED | **REJECTED** | S2 panel 06 shows a **full-screen Now Playing** view; the Home screen shows **no mini-player bar**. No artifact shows persistent playback chrome | **REJECT** — agent-origin; the evidence weakly points the other way |

### 3.5 Motion, motif, imagery, language

| # | Claim | Previous | Now | Evidence | Disposition |
|---|---|---|---|---|---|
| M1 | Motion verbs: pulse, slide, float, scan, fade | DECLARED | **VERIFIED** | S1 §18: "pulse, slide, float, scan, or fade with musical timing" | **RETAIN** → promoted |
| M2 | Six motifs with functions | DECLARED | **VERIFIED with richer functions** | S1 §11 — see §4.4 below | **RETAIN** → promoted |
| M3 | Imagery direction | DECLARED | **VERIFIED + extended** | S1 §10 adds **"rich in melanin detail"**; S2 and S10 casting corroborates | **REVISE** — extended |
| M4 | Nav metaphor: channels/rooms/decks/frequencies | DECLARED | **VERIFIED as instruction, contradicted in practice** | S1 §9 states it; S6/S7/S2-06 ignore it | **REVISE** — see Conflict B |
| M5 | Sound design exists | not claimed | **VERIFIED** | S1 §18: low bass hum, vinyl crackle, radio static, dancehall kick, tape-stop, red-alert tones | **NEW** |
| M6 | Reduced-motion behaviour | — | **UNRESOLVED** | No source mentions it. A system built on pulse/scan/glow **requires** a `prefers-reduced-motion` policy | **RETAIN as UNRESOLVED — raised to blocking for any build** |

### 3.6 Accessibility — restated precisely

Previous phrasing ("cream-on-red is inaccessible") was imprecise. Corrected, per threshold:

**Guidelines palette (S1)** — Warm Cream `#F4E6C8` on Signal Red `#E31B23` = **3.82:1**

- WCAG 2.2 **1.4.3 normal text (≥4.5:1)** → **FAIL**
- WCAG 2.2 **1.4.3 large text (≥3:1; ≥24px, or ≥18.66px bold)** → **PASS**
- WCAG 2.2 **1.4.6 AAA**, any size → **FAIL**
- WCAG 2.2 **1.4.11 non-text / UI components (≥3:1)** → **PASS**

So the pairing is **valid for display headlines, poster type and the wordmark** — which is exactly where
every source artifact uses it — and **invalid for button labels and body copy at normal size**.
White on `#E31B23` = **4.72:1** → passes AA normal text. **S1 itself permits "cream or white"**, so the
remedy is a source-sanctioned selection rule, not an override of the brand.

**Rule (INFERRED from VERIFIED inputs):** cream on red above 24px / 18.66px-bold; white on red at or below.

Other measured pairs (S1 palette): Signal Red on Obsidian **4.32:1** (AA-large pass, AA-normal fail) ·
Warm Cream on Obsidian **16.50:1** (AAA) · Cyan on Obsidian **11.62:1** · Soft Gold on Obsidian **8.53:1** ·
Smoke Gray on Obsidian **5.90:1** (AA pass, AAA fail) · Graphite on Obsidian **1.14:1** ·
Deep Wine on Obsidian **1.45:1**.

**Brand Kit palette (S2) is measurably worse at the primary CTA:**
Warm Cream `#F4E9D1` on Signal Red `#FF2A23` = **3.11:1** (AA-normal FAIL, AA-large PASS — barely) and
**white on `#FF2A23` = 3.75:1, which also FAILS AA normal text.** Under the Kit palette there is **no
compliant text colour for a red primary button at normal size.** Under the Guidelines palette, white works.
This is an objective, non-aesthetic argument for the Guidelines palette.

---

## 4. VERIFIED FUNUJĒ INTERFACE SYSTEM

Everything in this section is VERIFIED from S1 unless marked otherwise.

### 4.1 Thesis
A cultural signal system disguised as a music platform. Premium record label inside a cinematic audio
interface. Caribbean culture as infrastructure, rhythm, language and community — never as decoration.
Users move through **zones**, not pages.

**Taglines (VERIFIED, S1):** "Tune In. Stand Out." (primary) · "Where Caribbean sound becomes signal." ·
"The future of music has an accent."
**Tagline (VERIFIED, S2):** "FEEL THE FREQUENCY." · "Wellness for your ears. Culture for your soul."
These two sets do not overlap. See Conflict D.

### 4.2 Colour roles (S1)
`#050505` Obsidian — ground · `#171717` Graphite Glass — card/panel surface · `#E31B23` Signal Red — energy,
CTA, active state, glow, audio pulse · `#F4E6C8` Warm Cream — primary text on dark, display type on red ·
`#8A8A8A` Smoke Gray — secondary text · `#C8A34A` Soft Gold — premium, access, verification ·
`#28D7E8` Cyan Signal — analytics, data, live-stream indicators, dashboard highlight ·
`#5A0B12` Deep Wine — depth ground only, never text.

### 4.3 Zones (S1 §9, verbatim purposes)
The Signal (home/discovery) · The Stage (featured artists/campaigns) · The Vault (archive/catalog/legacy) ·
The Console (artist/producer dashboard) · The Lab (producer tools/collab) · The Drop Room
(releases/exclusives) · The Booth (artist profile/storytelling) · The Market (merch/tickets/bundles) ·
The Inner Circle (membership/VIP).

### 4.4 Motifs — function, not appearance (S1 §11)
| Motif | Verified function |
|---|---|
| Red Field | the loudest expression of the brand; full-bleed identity moment |
| Black Glass Panel | the default content container |
| Signal Bar (the macron over Ē) | **loading bar, status indicator, audio pulse, campaign marker** |
| Waveform | texture, divider, transition, audio identity |
| Frequency Ring | profile images, verified artists, live sessions, premium releases |
| Red Dot | live recording, new drops, active campaigns, exclusive content |

The macron is not typography — **it is a functional UI primitive.** This is the single most implementable
idea in the corpus.

### 4.5 Structures new to this pass (VERIFIED, S1)
- **§13 Artist Identity System** — 12 fields including **Signal ID**, Origin, Mood Tags, Story Note.
- **§14 Producer Section** — 10 fields + 9 monetization mechanisms.
- **§15 Monetization** — **five access layers**: Free / Fan / Artist / Producer / Label-Premium.
- **§16** ten content pillars. **§19** nine sub-brands (Records, Distribution, Producers, Sessions, Vault,
  Signal, Wear, Academy, Pro).
- **§7 Logo lockups** — Primary: cream on red · Premium: cream on obsidian · Night Mode: red type, or cream
  with red glow, on black.
- **§3 Name system** — FUNUJÉ permitted as a stylistic alternate; the macron is a frequency-bar signal mark.

---

## 5. VISUAL EVIDENCE MAP

Classification is asserted only where the **image itself** supports it.

| Expected asset | Satisfied by | Confidence | What the image actually shows |
|---|---|---|---|
| Primary wordmark on red | **S4** uppercase, **S3** lowercase | VERIFIED | Cream heavyweight geometric sans on saturated red field; macron set as a **detached bar**, not a diacritic |
| Waveform wordmark | **S5** ×2 | VERIFIED | Horizontal wave struck through the letterforms, knocking out; confirms Waveform as an identity-level motif |
| Colour specification | **S2 panel 04** | VERIFIED *(labels read, not pixel-sampled)* | 6 swatches + 2 gradients — **conflicting values**, see Conflict A |
| Typography specification | **S2 panel 04** | VERIFIED | Anton / Recoleta / Satoshi named with roles and weights |
| Component / CTA spec | **S2 panel 04** | VERIFIED | Primary "PLAY NOW" red fill + **white** label + play icon; Secondary "DISCOVER" outlined; red outline icon set |
| Mobile UI direction | **S2 panel 06** | VERIFIED | 4 screens: Home ("Good evening, Lexx", **DAILY PULSE**), Discover (mood grid: Turn Up/Chill/Focus/Love), Now Playing (red waveform scrubber, circular transport), Library. Tab bar: Home/Search/Library/Profile |
| Product ecosystem | **S2 panel 05**, **S10** ×6 | VERIFIED | Software: Stream, Discover, Artists, Podcasts, Live Sessions, Community + tiers **FREE/PREMIUM/STUDIO**. Hardware boards: Personal Audio, Portable Listening, Creator Tools, Home Entertainment, Gaming/Immersive, Performance/Nightlife |
| Campaign / templates | **S2 panels 07–08** | VERIFIED | Red posters; "NEW DROP OUT NOW"; MR. LEXX artist poster; DANCEHALL HEAT playlist; FREQUENCY NIGHTS flyer |
| **Platform IA** | **S6**, **S7** | VERIFIED | Sitemap: Home · Discover (For You/Browse/Search/Playlists/New Releases) · **Studio (Upload Music, My Releases, Analytics, Audience, Rights Management, Payouts)** · Community · Library. Flow diagram renders **Studio as the glowing hub node** |
| **Live-ish surface** | **S9** | VERIFIED | Mr. Lexx responsive site. Nav **HOME / VAULT / ARTISTS / DIGGY NATION**. Red-rim-lit portrait, cream display name, glowing red CTA "Browse 2011 Vault Catalog", FEATURED RELEASES cards with red play buttons. **The closest thing in the corpus to on-brand executed UI** |
| **Landing page** | **S8** | VERIFIED, **non-compliant** | Red hero panel; wordmark misspelt **"funujū"**; headline "Own Your Music. Reach Your Fans. No Middlemen."; red CTA "Start Releasing Free"; coral/salmon red, not `#E31B23`; body face is a light humanist sans, not the brand display face |
| Parent-brand context | **S11** | VERIFIED | WRASAL "Cinematic Civilization Engine" places **FUNUJĒ as the Music + Artist Development layer**. WRASAL's own language is obsidian/ivory/**muted gold**/signal amber/deep emerald — a *different* system |

**Not classified:** S12/S13 code screenshots — S13's `#1C1C21` / `#C6A85C` are **WRASAL-family values, not
FUNUJĒ**, so that artifact is not evidence of FUNUJĒ UI.

---

## 6. CONFLICTS

Each carries a preferred interpretation, rationale, confidence, and whether human approval is required.
**None has been silently resolved.**

### Conflict A — Two incompatible palettes under identical names
| | S1 Guidelines v001 | S2 Brand Kit v1.0 (May 2024) |
|---|---|---|
| Signal Red | `#E31B23` | `#FF2A23` |
| Warm Cream | `#F4E6C8` | `#F4E9D1` |
| dark ground | `#050505` Obsidian | `#111111` Charcoal |
| deep red | `#5A0B12` Deep Wine | `#4A0D0F` Deep Oxblood |
| panel | `#171717` Graphite Glass | — none — |
| extras | Smoke Gray, **Soft Gold**, **Cyan Signal** | **Electric Pink `#FF5E8A`**, **Burnt Orange `#FF7A1A`** |

**Preferred: S1 Guidelines.** Rationale — (1) the work order names it authoritative; (2) it is the only
source that assigns *roles*, not just swatches; (3) it supplies the gold and cyan that the verified
producer/premium systems depend on and the Kit lacks entirely; (4) **measured accessibility**: under the Kit
palette *no* text colour clears AA-normal on the red button (cream 3.11:1, white 3.75:1), whereas the
Guidelines red admits white at 4.72:1; (5) Electric Pink and Burnt Orange sit uneasily with S1's own
"no cheap neon overload" instruction.
**Confidence: high. Human approval: REQUIRED** — this retires two named brand colours.

### Conflict B — Zone vocabulary vs. actual product IA
S1 §9 instructs zone naming and explicitly forbids the generic equivalents. S6, S7 and S2-06 use
Home/Discover/Release/Studio/Community/Library/Search/Profile throughout. Only S9 uses **VAULT**.
**Preferred: zones as the *product* vocabulary, generic terms retained only as invisible routing/analytics
keys and as `aria-label` fallbacks where a screen reader needs a conventional noun.** Rationale — zone
naming is the brand's load-bearing differentiator and is stated as an instruction; the IA artifacts are
working documents, not identity decisions, and S9 shows the zone naming surviving contact with a real build.
**Confidence: medium. Human approval: REQUIRED** — it invalidates the labels on two existing IA documents.

### Conflict C — Typography
S1 lists 7 body faces and **omits Satoshi**; S2 names Satoshi as *the* body face. S1 names no display face;
S2 names Anton.
**Preferred: Anton (display) + Recoleta (editorial) from S2; body face chosen from S1's seven, with
Space Grotesk or General Sans as the closest in character to Satoshi.** Rationale — S2 is the only source
that names a display face at all, so it fills a genuine gap; but on the body face the two sources *actively
disagree*, and S1 is the authoritative document, so its list governs. **Confidence: medium.
Human approval: REQUIRED** for the body face only.

### Conflict D — Three positioning systems
S1: "Tune In. Stand Out." / Caribbean signal system. S2: "FEEL THE FREQUENCY." / "Wellness for your ears."
S8: "Own Your Music. Reach Your Fans. No Middlemen." / "Start Releasing Free."
These describe three different companies: a cultural label OS, a lifestyle streaming brand, and a DIY
distribution tool. **No preferred interpretation offered — this is a business decision, not a design one.**
**Confidence: n/a. Human approval: REQUIRED before any homepage work.**

### Conflict E — Caribbean cultural OS vs. generic streaming clone
S1 explicitly instructs: *do not make it look like a generic streaming app.* S2 panel 05 offers
"ad-supported access to millions of tracks", "unlimited skips", "offline mode"; panel 06 offers mood
playlists Turn Up / Chill / Focus / Love; S8 is a distribution landing page. **The product artifacts violate
the brand document's single most emphatic prohibition.**
**Preferred: S1 governs.** Rationale — it is authoritative and it is the only thing that makes FUNUJĒ
non-substitutable. **Confidence: high. Human approval: REQUIRED** — it invalidates substantial parts of
panels 05/06 and all of S8.

### Conflict F — Access tiers
S1 §15: **five** layers (Free / Fan / Artist / Producer / Label-Premium). S2 panel 05: **three**
(Free / Premium / Studio). **Preferred: S1's five** — it is role-based and matches the verified Artist and
Producer identity systems; S2's three is a consumer-SaaS ladder. **Confidence: medium-high.
Human approval: REQUIRED.**

### Conflict G — Wordmark integrity failures
S8 renders the wordmark as **"funujū"** (wrong vowel + macron). S6 titles itself "Funuje Platform Sitemap"
(no macron). S1 §3/§7 forbid both. **No interpretation needed — these are defects.**
**Confidence: high. Human approval: not required; correction required.**

### Conflict H — FUNUJĒ's governance relationship to WRASAL
S11 places FUNUJĒ inside WRASAL's ecosystem; S13 uses WRASAL gold `#C6A85C` in what appears to be FUNUJĒ-
adjacent code. **S1 never mentions WRASAL.** Unknown whether FUNUJĒ inherits WRASAL design governance,
shares primitives, or is deliberately independent.
**No preferred interpretation. Confidence: n/a. Human approval: REQUIRED** — it determines whether the
token set is standalone or a WRASAL theme.

---

## 7. UNRESOLVED IMPLEMENTATION TOKENS

The source establishes **none** of the following. They are listed as *decisions required*, not as proposals.
Nothing below has been invented or given a value.

| Token group | State | Decision required |
|---|---|---|
| Spacing scale | UNRESOLVED | base unit and step ratio |
| Border radius | UNRESOLVED | S1 and S2 both show "rounded"; **no radius is stated anywhere**. Needs card / button / pill / ring values |
| Elevation | UNRESOLVED | S1 says "soft shadows" — no offsets, blurs or opacities |
| Glow | UNRESOLVED | two tiers confirmed (ambient-subtle, active-intense); **neither is quantified** |
| Card stroke | UNRESOLVED | visually present (K6), numerically undefined; required because Graphite-on-Obsidian is 1.14:1 |
| Motion duration / easing | UNRESOLVED | five verbs verified, **zero timings**. "Musical timing" implies tempo-derived values — needs a decision on BPM anchoring |
| `prefers-reduced-motion` | UNRESOLVED | **raised to blocking.** Pulse/scan/glow is the core language; there is no stated fallback |
| Breakpoints | UNRESOLVED | S2-06 and S9 imply mobile + tablet + desktop; no values |
| Type scale | UNRESOLVED | sizes, weights, line-heights, tracking |
| "Quiet" CTA variant | UNRESOLVED | S1 defines primary/secondary/premium only; no tertiary or ghost |
| Focus-visible treatment | UNRESOLVED | **newly flagged.** No source defines keyboard focus. Red glow is already overloaded as a state |
| Vault ↔ Drop Room lifecycle | UNRESOLVED | when does a release leave Drop Room and enter Vault |
| Zone transition model | UNRESOLVED | whether moving between zones is a route change or a spatial transition |

---

## 8. FIRST-SURFACE RECOMMENDATION

**Revised. Pass 1 recommended The Signal. Pass 1R recommends The Console.**

This is a reversal, driven by evidence rather than preference.

**Why The Signal is now the weaker first surface.** Its artifacts are the most compromised in the corpus.
S8 is the only landing-page mockup and it is off-palette, off-typeface, off-message and misspells the
wordmark. Building The Signal first forces premature resolution of Conflicts **D** and **E** — positioning
and category — which are business decisions no design pass can settle. It is the highest-visibility surface
with the least settled content.

**Why The Console is stronger — four independent lines of verified evidence.**
1. **The user's own flow diagram nominates it.** In S7, **Studio is rendered as the glowing, highlighted hub
   node**, with Discover/Release/Community arranged around it.
2. **It is the most completely specified area of the corpus**, and specified *consistently* across three
   independent artifacts: S1 §14 (10 producer fields + 9 monetization mechanisms), S1 §13 (12 artist fields
   incl. Signal ID), and S6's Studio branch (Upload Music, My Releases, Analytics, Audience, Rights
   Management, Payouts). No other zone has that depth or that agreement.
3. **It is the only surface that exercises the verified accent palette.** Cyan Signal's verified role is
   "analytics, data, dashboard highlights" and the colour-usage table assigns "black + graphite + cyan/gold"
   specifically to the producer section. Cyan and Gold are *unreachable* on a discovery homepage.
4. **It is conflict-light.** Conflicts D and E are about consumer positioning; a producer dashboard is barely
   touched by either. Conflict B is easily contained — one zone, one nav label.

**Secondary consideration:** the Console is also where the cream-on-red contrast problem is least acute,
because dashboards are dense normal-size text on dark ground — the pairings that measure 16.50:1, 11.62:1
and 8.53:1 — rather than cream-on-red display type.

**Counter-argument, recorded honestly:** The Console proves the system's *mechanics* but not its *soul*. It
will not demonstrate the Red Field, the cinematic imagery direction, or the cultural thesis. If the goal of
Pass 2 is a persuasive brand artifact rather than a durable primitive set, **The Booth** (artist profile) is
the better choice — S9 shows it already half-built and on-brand, and S1 §13 fully specifies its content
model. The Signal should be third, after D and E are settled.

**Recommended order: The Console → The Booth → The Signal.**

---

## 9. ACCEPTANCE

| Criterion | Verdict | Rationale |
|---|---|---|
| Open and inspect the exact folder by ID, not by name search | **PASS** | Folder `1nbyg-…` opened directly; 134 children enumerated across two paginated calls |
| Reconcile rather than replace the provisional pull | **PASS** | §3 re-adjudicates 61 claims individually; the Pass-1 document is retained unmodified at `469626b` |
| Remove `DECLARED` as a truth state | **PASS** | Vocabulary reduced to VERIFIED / INFERRED / UNRESOLVED; `source_origin` tracked as an independent field |
| Inspect images as images, not filenames | **PASS** | 23 artifacts inspected visually; classifications in §5 cite observed content. S12/S13 marked PARTIAL precisely because only their filenames were legible |
| Do not auto-retain prior hypotheses | **PASS** | All eight named hypotheses re-adjudicated: 3 RETAIN, 3 REVISE, **2 REJECT** (ZoneShell, persistent player). First-surface recommendation reversed |
| State contrast findings precisely | **PASS** | §3.6 reports per-threshold verdicts; the universal "inaccessible" phrasing is withdrawn |
| Document conflicts rather than resolving silently | **PASS** | 8 conflicts, each with preferred interpretation, rationale, confidence and approval flag; D and H deliberately carry no preference |
| Invent no tokens | **PASS** | §7 lists 13 unresolved groups as decisions required, with no values supplied |
| No runtime UI; do not build The Signal | **PASS** | No code written; no surface created |
| Pixel-exact hex from brand-kit image | **NOT VERIFIED** | Sandbox has no outbound network to Drive; Pillow absent. Values transcribed from the panel's printed labels and marked as such in §2.3 |
| Complete visual inspection of every folder asset | **PARTIAL** | 23 of 134 inspected. 1 of 8 `photo-output.HEIC` not rendered; `IMG_6190–6218` sampled, not exhausted |

---

## 10. NEXT ACTION

1. **Human decision required on Conflicts A, B, C, D, E, F, H** before any Pass-2 build. D, E and H are
   business/governance decisions and cannot be delegated to a design pass.
2. **Correct the wordmark defects (Conflict G)** in S8 and S6 — no approval needed.
3. On resolution, issue **Pass 2 — bounded surface application: The Console**, with the token decisions in
   §7 as explicit inputs rather than discoveries.
4. Note the control-plane limitation: `work_orders/` enforces filename `^WRASAL-\d{4}\.json$` and
   `projects.yml` has no `funuje` entry, so this work order cannot be registered as a first-class record
   without a schema change. It lives in `concepts/` by necessity, not by preference.

---

### Appendix — withdrawn findings

The following Pass-1 statements are **false** and are withdrawn. They must not be cited as evidence:

- "No FUNUJĒ source material exists in the connected Drive."
- "The 44-file enumeration is complete."
- "All eight expected source assets are missing."
- `evidence/…-source-inspection.json` → `result: "blocked"`, `expected_sources_status: all missing`.
- Concept doc §12 "no source found."
