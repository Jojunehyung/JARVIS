# Daily reader — `오늘 읽을 것`

Added 2026-09-17 (schema v27, [decision log](../design-docs/decision-log.md)). The user's second request that day,
translated: "every day, make me read through everything I need to know and check so far — like a newspaper on the
first run of the day, and openable any time with a button." The user **explicitly declined** a per-item
tick/confirm feature and anything stored per day — record that; nothing here is a checkbox, a toggle or a store.
The reader replaces the daily briefing's once-a-day auto-open; the briefing itself is unchanged and is one tap
away (`브리핑 ›`).

## What the reader is, and is not

`buildReader(state, today)` is a pure function, computed at render, storing nothing
([Rule 9](../design-docs/core-beliefs.md#rule-9)). It states **full content**, never a count standing in for a
line — a decision's own text, a check's own text, a follow-up's own text — with an explicit `없음` for an empty
section and a `{n}건 더` remainder past `READER_LINES` (50) ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
It reads state and writes nothing; the only thing it changes indirectly is the pre-existing daily marker,
`act.briefingSeen`, stamped through the same `closeBriefing` the briefing already used — no new field.

It is not an AI feature: no packet is built, no reply is read, no network call is made
([Rule 7](../design-docs/core-beliefs.md#rule-7) amendment, 2026-09-17). Rule 7's amendment records this
explicitly: "the daily reader … is not an AI feature: a derived reading of the saved state, computed at render,
storing nothing."

## Title

`오늘 읽을 것`, modal title `오늘 읽을 것 — {today}`, button copy `오늘 읽을 것 ›`. Not `오늘의 신문`:
"newspaper" is a metaphor for a screen that states nothing but the saved state, and every other title in the app
names its content literally (`오늘 브리핑`, `오늘 회의 준비`, `오늘 업무`). Not `오늘의 확인`: nothing here is
confirmed — the user declined that feature outright.

## `readerSince(act, today)`

The date the `{since} 이후 새로 들어온 것` section starts counting from, read from the one existing daily
marker, `act.briefingSeen` — three cases:

| Case | `since` |
|---|---|
| a marker before today | that marker — the first opening of the day sees everything since the last run |
| a marker equal to today | `shiftDay(today, -1)` — the reader was already closed once today (the marker is stamped at close), so a second opening the same day falls back to yesterday. This is [TD-62](../exec-plans/tech-debt-tracker.md) (accepted), and it is stated by the section's own title, so it is never a silent gap |
| no marker (fresh or demo save) | `shiftDay(today, -READER_SINCE_FALLBACK_DAYS)` (7 days back) |

The comparison inside the section is `>= since`, so an item dated on the last run's own day repeats rather than
disappears ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

## `buildReader(state, today)` — sections

Constants: `READER_DECISION_DAYS = 7` (meetings whose decisions are restated), `READER_SINCE_FALLBACK_DAYS = 7`,
`READER_LINES = 50` (items per section before `{n}건 더`), `READER_CLIP = 300` (chars of a decision, a note, a
result or a progress line).

Returns `{ since, sections }`; each section `{ key, title, items: [{ text, sub?: string[] }], action, more }`. An
empty section holds the one item `{ text: "없음" }`; `more` is the count of items dropped past `READER_LINES`.

| Key | Title | States | `action` |
|---|---|---|---|
| `prep` | `오늘·내일 회의 준비` | one block per `meetingPrepOf` row: `{오늘\|내일} {time \| 시간 미정} · {event title} · {project name}`, then `확인할 것 {open}/{total}` and one `- {text}` per open check, `결정: {clipped decisions \| 없음}` or `이전 회의록 없음`, one `후속 · {내 담당\|타인} · {text} · 기한 {due \| 없음}` per open follow-up, and `문서: {titles joined " · "}{ · {k}건 더}` or `문서 없음` | `{ type: "work" }` |
| `work` | `오늘 업무` | every open item from `workOn(state, today, today)` (`{title}{ · 이월 {n}일}`, a `메모:` sub-line when noted), then every item done **yesterday** (`어제 완료 · {title}`, a `처리:` sub-line when it has a result) | `{ type: "work" }` |
| `followups` | `기한 지남 후속 · 내 담당 미완료 후속` | across every meeting: overdue undone follow-ups first (`{meeting title} · {text} · 기한 {due} ({D-day})`), then the user's own undated/future open follow-ups not already listed (`{meeting title} · {text} · 기한 {due \| 없음}`) | `{ type: "meetings" }` |
| `decisions` | `최근 7일 결정 사항` | meetings dated within `READER_DECISION_DAYS` with a non-empty `decisions` field, newest first (`{date} {title}`, the decisions text clipped as a sub-line) | `{ type: "meetings" }` |
| `since` | `{since} 이후 새로 들어온 것` | meetings created since `since` (`회의록 · {date} {title} · {project \| 프로젝트 없음}`), then documents added since `since` (`문서 · {title} · {project \| 프로젝트 없음}`), then progress entries dated since `since` (`진행 · {meeting title} · {clipped text}`) | `{ type: "meetings" }` |
| `biz` | `계약·입금 미확인` | `buildBriefing(state, today)`'s own `biz` section items, restated verbatim (including its closing totals line, which is never `없음`) so the two screens cannot disagree | `{ type: "biz" }` |
| `goals` | `뒤처진 목표 페이스` | the briefing's `goals` items filtered to `severity === 3` (a goal behind pace or past its deadline); `없음` otherwise | `{ type: "goals" }` |

`buildReader` calls `buildBriefing` once and reuses its `biz`/`goals` items — the reader and the briefing state
the same numbers by construction, never a different one ([decision log](../design-docs/decision-log.md)).

**Two more sections (v28), after `biz` and before `goals`:**

| Key | Title | States | `action` |
|---|---|---|---|
| `roadmap` | `사업 로드맵` | first `timeLine(state, today)` (`이번 주 사업 {h}/{budget}h · 남은 날 {d}`), then `stageOrderNote(milestones)` when present, then one item per not-done milestone by `milestoneOrder` (`milestoneLine`), each with a `조건: {clipped condition}` sub-line when the milestone carries one | `{ type: "biz" }` |
| `pipeline` | `사업 파이프라인 · 공고` | leads not won whose next action is past (`leadLine`), then leads due within `LEAD_SOON_DAYS` (3), then open notices past or within `NOTICE_SOON_DAYS` (14) (`noticeLine`), each with a `메모: {note}` sub-line when the record carries one | `{ type: "biz" }` |

Neither section is a packet (unlike the daily and work packets, [assistant-bridge.md](../design-docs/assistant-bridge.md)):
`pipeline` states the **full** lead and notice line, never a count standing in for one, since the reader's own
rule ([Rule 13](../design-docs/core-beliefs.md#rule-13)) applies here the same as everywhere else in this
screen. The `계약·입금 미확인` (`biz`) section restates the briefing's payment-line, overdue-lead-count and
open-notice lines by construction (it reuses the briefing's own `biz` items) — see
[business.md](business.md#the-reader-and-the-calendar-file).

The reader's own sections number **nine** (v28, up from seven); a `브리핑 ›` link row follows them (below) — the
two together are what a user reads top to bottom, but only the nine above are `buildReader`'s `sections`.

## Track heads (v28)

Five of the nine sections carry mixed-track records (`prep` by the event's own track, `work` by `trackOf(w)`,
`followups` by `meetingTrack(state, m)`, `decisions` by `meetingTrack`, `since` by `meetingTrack` for meetings,
`trackOf(d)` for documents, and a progress entry's own meeting for progress lines). A local helper,
`withHeads(items)`, stable-sorts each such section's items by track and inserts a head item (text = the track
label, a space, the group's own count and `건`, `head: true`) before each non-empty track group; `add` (the
`READER_LINES`/`more` slicer) counts and slices **non-head** items only, so a head is never mistaken for content
and never eats into the 50-line cap. `DailyReaderModal` renders a `head` item as `text-xs font-bold
text-zinc-500 pt-1`, visually distinct from a plain content line. `roadmap` and `pipeline` carry no heads — both
are single-track sections (business by construction), like the briefing's `계약·입금 미확인`.

**Order: `직장` first, then `사업`, then `개인` — everywhere, and always in that order.** The reader opens
before the working day, and the day job's items are the ones that must not slip — the user's own condition for
the whole plan — so they lead; the business follows as the second block; private life closes. The work tab and
the briefing use the same order, so no screen ever reorders the user's day differently from another.

## `DailyReaderModal({ state, today, onClose, onAction })`

`Modal` titled `오늘 읽을 것 — {today}`. One block per section (`bg-zinc-950 rounded-xl p-3`): a header row with
the section title (`SectionLabel tone="text-zinc-400"`) and a button `›` (`aria-label="{title} 열기"`) →
`onAction(section.action)`; then each item's `text` (`text-zinc-500` when it reads `없음`, `text-zinc-300`
otherwise) and its `sub` lines indented; `{more}건 더` (mono) when `more > 0`. Footer: a full-width border button
`브리핑 ›` → `onAction({ type: "briefing" })`, then a cyan `닫기` → `onClose`. No checkbox, no toggle, no input
anywhere in this modal — by the user's own decision.

## When it opens

- **At boot** and **on a day change**, in the briefing's former place: `if (m.act?.briefingSeen !== dstr())
  setModal({ type: "reader" })` — the same guard the briefing used to run, now opening the reader instead. The
  briefing no longer auto-opens on its own.
- From the **profile tab's CV card**, a button `오늘 읽을 것 ›` next to `프로필 편집` (`HomeTab`'s `onReader`
  prop, root wires `() => setModal({ type: "reader" })`).
- From the **briefing's own footer**, a button `오늘 읽을 것 ›` above `AI에게 보내기` (`onAction({ type:
  "reader" })`) — so the two screens are reachable from each other.

## Relation to the briefing

The briefing is unchanged in content and is reached with one tap (`브리핑 ›`); the reader does not duplicate its
nine sections, its footer actions or its journal/weekly-review routes. `act.briefingSeen` is the **one** daily
marker, reused unchanged: closing the reader (button, `X`, or backdrop) or the briefing both call the existing
`closeBriefing`, which stamps the day and then, for any other action type, either switches tabs (`TAB_ACTIONS`)
or opens the named `modal.type` directly — `{ type: "reader" }` and `{ type: "briefing" }` both fall through this
same path with no new code. `daily-briefing.md`'s "When it opens" section is updated to point here.

## Performance (heavy-save measurement)

Measured on a planted 2.13 M-char save (300 meetings × 30 follow-ups — 10 `mine`, 10 overdue — 100 documents of
5,000 chars, 200 work items, 20 project-linked events today/tomorrow × 30 checks): `buildReader` ran in **3–7 ms**
over five repeated calls; open-to-paint (opening the modal from the CV card to the overlay's first paint) took
**≈ 54 ms**; the rendered reader text totalled **101,542 chars**. `오늘 업무` stated `87건 더` and the follow-up
section `5951건 더` past `READER_LINES`. No console error; `닫기` returned within one frame under load. On the
demo build, the reader's text is 1,115 chars.

## Demo content

The demo shows every section non-empty except where the demo genuinely lacks data. `오늘·내일 회의 준비` states
the tomorrow event with `확인할 것 2/2`, its decisions and `문서 없음` (the matched project carries no document);
`오늘 업무` states the two open items and `어제 완료 · ○○물산 월 리포트 양식 회신` with a `처리:` line (a
yesterday-dated, done work item added for exactly this, without changing the demo's own-day counts line, still
`남음 2건 · 이월 0건 · 완료 1건 · AI 제안 1건` — [TD-57](../exec-plans/tech-debt-tracker.md) still holds, there is
no carried row); the follow-up section states the overdue item; the decisions section lists two meetings; the
`{since} 이후 새로 들어온 것` section lists meetings, the two demo documents and progress entries; `계약·입금
미확인` states the unpaid month and the closing totals line; `뒤처진 목표 페이스` lists both demo goals behind
pace. (v28) `오늘 업무` and `오늘·내일 회의 준비` now show the `직장`/`사업` heads once the day-job project's
records are counted; `사업 로드맵` opens with the time line, then the eight open demo milestones with their
conditions (the ninth, seeded `done`, is excluded); `사업 파이프라인 · 공고` lists the two demo leads (one
overdue) and the one demo notice. See [demo-data.md](../design-docs/demo-data.md).

## E2E coverage (written, not run — standing user instruction)

`tools/e2e/flow5.js` rewrites the auto-open steps: a new day opens the reader (never the briefing) with all
seven sections in order, the `{since}` title, `브리핑 ›`, and no checkbox; closing it stamps `act.briefingSeen`;
the same day reopens neither screen; the streak line is now read by reaching the briefing through the reader's
`브리핑 ›`; a new step opens the reader from the profile card and from the briefing's own button, and asserts a
section's `›` (`계약·입금 미확인 열기`) lands on `사업` with no overlay left. `tools/e2e/flow11.js` adds one step
asserting the reader's content over the prep, document and check fixtures (placed before the check-import step,
so the fixtures are still in their pre-import shape). `tools/e2e/flow.js`'s demo sweep opens the reader from the
CV card and asserts its content. **Tracks and the roadmap/pipeline sections (v28, written 2026-09-17/18):**
`flow11.js` asserts the `오늘 업무` heads `직장 1건` / `사업 1건` / `개인 1건` in that order with one item per
track planted; `flow8.js` asserts the `사업 로드맵` section states a planted milestone's pace and links
(`3단계 · E2E 페이스 마일스톤 · D-10 · 업무 2/2 · 50%p 앞섬`) and the `사업 파이프라인 · 공고` section lists a
planted lead's full line. See [tools/e2e/README.md](../../tools/e2e/README.md).

## What the daily reader never does

- Stores nothing per day beyond the pre-existing `act.briefingSeen` stamp — no tick, no confirm, no per-item
  record, no new schema field.
- Renders no checkbox, no toggle, no input — the user explicitly declined a confirmation feature.
- Makes no network call and reads no AI reply — it is a derived reading of the saved state, not the assistant
  bridge ([Rule 7](../design-docs/core-beliefs.md#rule-7)).
- Never completes a task, promotes an area, submits evidence, or changes a score, grade, streak, KR or goal.
- Never duplicates the briefing's own sections, footer or routes — it links to the briefing instead.
