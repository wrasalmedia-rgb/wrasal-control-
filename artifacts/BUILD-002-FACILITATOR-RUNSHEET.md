# BUILD-002 — Facilitator Runsheet and Capture Record

Use this sheet with **one** consenting participant and the participant-facing encounter. This is a bounded usability and mechanism test, not therapy, diagnosis, coaching, or a proof of transformation.

Do not enter participant names, contact details, or identifying situation details into this file or the repository. Keep any completed capture outside Git and only as long as necessary for the agreed encounter.

## Facilitator stance

- Do **not** explain WRASAL, WRAYvolution, an underlying architecture, or an expected outcome.
- Do **not** persuade, coach, interpret, improve answers, or imply that change should occur.
- Read a requested prompt again verbatim. If more explanation is required, record that fact and the participant's question.
- Do **not** extend the encounter past 30 minutes to rescue a result.
- A stop, skip, confusion, no reported difference, or ambiguity is valid evidence.
- Do not infer why a participant answered as they did.

## Preparation — before the participant arrives

1. Have the participant-facing sheet available in print or a plain editable document.
2. Have a blank local copy of the capture fields below. Do not use the repository as a participant-data store.
3. Use the participant's existing, consented contact route only if they opt into follow-up. Do not collect contact details on the capture record.
4. Confirm that this is one low-stakes unresolved situation, not an active crisis, safety concern, medical emergency, or legal emergency.

## Opening script — up to 2 minutes

Read this once:

> “You will have about 25 minutes to use a short worksheet with one situation on your mind. You do not need background knowledge. I will keep time and can reread a prompt, but I will not interpret or advise on your answers. Please choose something that is not urgent or high-risk. You can skip any question or stop at any time. It is okay if nothing changes.”

If the participant asks what system, theory, or transformation the exercise represents, say only:

> “You do not need that information to complete this worksheet. Please use the words on the page and tell me if a step is unclear.”

Record the question as an `OBSERVED` usability event. Do not add an explanatory lecture.

## Timebox

| Elapsed time | Activity | Facilitator action |
| --- | --- | --- |
| 0:00–2:00 | Opening and choice of situation | Read opening script; confirm consent to continue. |
| 2:00–6:00 | Before state | Stay silent unless asked to reread a prompt. |
| 6:00–16:00 | Work with the situation | Keep time; record clarification requests exactly. |
| 16:00–21:00 | After state | Stay silent unless asked to reread a prompt. |
| 21:00–25:00 | Follow-up choice and close | Offer one follow-up; record consent, decline, or no response. |

Stop at 25 minutes where possible. Never exceed 30 minutes. If the participant stops, record the elapsed time and stopping point; do not replace the encounter with explanation.

## Blank encounter capture

Copy these fields to a local, access-limited note before the encounter. Bracketed labels are evidence classifications, not interpretations.

### Session facts — `OBSERVED`

- Encounter ID: `BUILD-002 / participant alias or local session code only`
- Date/time: ______________________________
- Facilitator: ______________________________
- Participant continued after opening: `yes / no / stopped`
- Situation was described as low-stakes and non-urgent: `yes / no / unknown`
- Start time / end time / elapsed minutes: ______________________________
- Participant completed: `all / partial / stopped / unknown`
- Sections skipped or stopping point: ______________________________

### Before state — `USER_SUPPLIED`

Capture the participant's words as closely as practical. Do not summarize them as a diagnosis or outcome.

- Situation sentence: ______________________________
- Directly noticed / verifiable items: ______________________________
- Current meaning or story: ______________________________
- Expected next action if nothing changes: ______________________________
- Initial clarity score, if offered: ______________________________

### During state — `OBSERVED`

- Prompt reread requests, including exact participant wording: ______________________________
- Extra explanation requested: `none / requested`; what was requested: ______________________________
- Facilitator response: `reread only / other (describe factually)`
- Visible completion path: `completed / skipped / stopped`; time at event: ______________________________
- Any explicit confusion about what to do, quoted where practical: ______________________________

### After state — `USER_SUPPLIED`

- What changed in noticing, if anything: ______________________________
- What changed in meaning, if anything: ______________________________
- What changed in decision, if anything: ______________________________
- Intended action / intentional non-action / information-gathering choice: ______________________________
- Final clarity score, if offered: ______________________________
- Instruction that remained unclear: ______________________________
- “No difference,” uncertainty, or decline, if stated: ______________________________

### Follow-up — `USER_SUPPLIED` or `OBSERVED`

- Follow-up consent: `yes / no / unknown`
- Follow-up sent through existing consented channel: `yes / no / not applicable`
- Follow-up date/time: ______________________________
- Participant response, captured verbatim where practical: ______________________________
  - action taken / not taken / changed: ______________________________
  - directly noticed afterward: ______________________________
  - what remains unknown: ______________________________
- No response by agreed window: `yes / no / unknown`

## Classification and interpretation boundary

Classify each captured item before discussing what it might mean:

| Class | Use only for |
| --- | --- |
| `OBSERVED` | Directly witnessed process facts: time, completion, requests for clarification, reread prompts, and delivery events. |
| `USER_SUPPLIED` | The participant's own words, ratings, reports, choices, and follow-up response. |
| `THIRD_PARTY_SUPPORTED` | A separately attributable external source, if one is actually supplied. Leave blank when none exists. |
| `INFERRED` | A facilitator or system interpretation. Keep it separate, label it, and route it as non-establishing. |
| `UNVERIFIED` | A claim not independently supported by the captured record. Keep it non-establishing. |

Do not convert a participant report into proof of a mechanism. Do not convert an observed completion into proof of a beneficial outcome. **Unknown remains Unknown.**

## Post-encounter decision aid

Record the actual result even if it is inconvenient:

- If the participant cannot complete without extensive explanation, record that as a primary-test failure or ambiguity.
- If there is no reported difference, record no reported difference.
- If evidence is ambiguous or the mechanism appears flawed, record that rather than repairing the encounter during analysis.
- If the participant completes and supplies a difference, classify it as `USER_SUPPLIED`; it does not by itself prove causation.
- If no participant encounter has occurred, the participant outcome is `Unknown` and the Build Mode decision remains `BLOCKED`.

Any capability discovered here that is not required to run this one encounter is `DEFERRED`. Do not add a platform, participant database, analytics layer, new theory, or visual redesign during BUILD-002.
