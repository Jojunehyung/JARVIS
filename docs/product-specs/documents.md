# Documents — `문서`

Added 2026-09-17 (schema v27, [decision log](../design-docs/decision-log.md)). The user's words, translated:
"let me also store document summaries" for a project — so that, before a meeting, the app can state what those
documents say. A document is a **record of what a file says, in the user's words** — a title, an optional source
label, and a summary — never a task and never the file itself.

## What a document is, and is not

```
documents: [{ id, projectId(string | null), title (≤ 60), source? (≤ 120), summary (≤ 5,000), addedAt("YYYY-MM-DD"), track("work"|"biz"|"personal") }]
```

`track` (schema v28) is a stored field, backfilled `work` on every existing document. `DocumentModal` shows the
`TrackRow` chips after `ProjectPicker`: the initial value is the document's own track when editing, else the
picked project's track, else `work`; picking a project chip **follows** that project's track until the user
taps a track chip in this form (tracked as local `touched` state) — so opening the form on a business project
defaults to `사업` without a tap, but a deliberate `개인` choice survives a later project pick. Writes `track`.
The row marker on the document row (in `MeetingsTab`) becomes the track label, ` · ` and the `YY-MM-DD` date.

Top-level, not nested under a project: a document may belong to no project (`projectId: null`), the same shape
`meetings[]` already used for an urgent memo, and every reader here filters by `projectId` the way `MeetingsTab`
groups minutes. `source` is text only — a file name or a link, never a file upload, never file content; **no file
is stored anywhere in the app**. `summary` is the user's own words about what the document says. `addedAt` is the
date the document was added — there is no separate `createdAt`.

A document pays nothing, completes nothing, moves no grade, streak, KR or goal, and never enters
`computeGrades`, `krProgress`, `goalProgress`, `todoOf`, `agendaOf` or the trophy wall/achievement log
([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 9](../design-docs/core-beliefs.md#rule-9),
[Rule 18](../design-docs/core-beliefs.md#rule-18)). It is never generated, summarised or transcribed by the app —
the user types the summary by hand ([Rule 7](../design-docs/core-beliefs.md#rule-7)).

`DOC_LIMITS = { title: 60, source: 120, summary: 5000 }`; `DOC_SUMMARY_CLIP = 100` (chars of a document's
summary shown on the prep card and in the daily reader). `docOrder = (a, b) => b.addedAt.localeCompare(a.addedAt)`
sorts newest first; a stable sort keeps the handler's prepend order for one day.

## Storage arithmetic

Unit: string length against `STORAGE_BUDGET` = 3,672,064 chars, as in the meetings region.

- `,"documents":[]` adds **15 chars** once (v27).
- One document: `{"id":"…","projectId":"…","title":"","summary":"","addedAt":"YYYY-MM-DD"}` ≈ **91 chars** of
  overhead + title + summary (+ 1 comma between records); `,"source":""` adds 12 + the source; `"projectId":null`
  (16 chars) is 8 chars smaller than a live id (24 chars).
- A full document (60 + 120 + 5,000) ≈ **5,283 chars** (+ 1 per line break in the summary, stored as `\n`, 2 chars
  each after `JSON.stringify`). Measured on the demo build: a planted 5,000-char summary grew the save by
  **≈ 5,106 chars**.
- Typical (title 20, source 30, summary 600) ≈ **753 chars**. Two a week ≈ 100 a year ≈ 75 k chars a year (2 % of
  the budget); one full document per working day ≈ 250 × 5,283 ≈ 1.32 M a year (36 %).
- `recordFits` measures a document record whole, exactly as it measures a meeting or a work item.

## The `미팅` tab

`MeetingsTab` reads `documents = state.documents || []`; in the `groups` memo each project also gets `docs:
documents.filter((d) => d.projectId === p.id).sort(docOrder)`, and `memoDocs = documents.filter((d) => d.projectId
== null).sort(docOrder)` beside the memo-group's `memos`. Project order (by newest minutes) is unchanged.

- **Tab counts line**: `프로젝트 {p}개 · 회의록 {n}건 · 문서 {d}건 · 저장 공간 {mb}MB / 3.5MB` — the `문서`
  fragment sits **after** `회의록`, so the pre-existing substring `프로젝트 2개 · 회의록 4건` (asserted by
  `tools/e2e/flow.js`) still holds.
- **Each project section head** (`groupHead`): `{project name}` and, on the right, `회의록 {n}건 · 문서 {d}건`
  (one mono span, ` · ` joined). The button row (`smallBtn`) gains `문서 추가` (same border style as `회의록
  추가`), calling `onAddDocument(p.id)`.
- Below the minutes rows (`rowsBlock`), a **documents block** only when `docs.length > 0` (`docsBlock`): a head
  line `문서 {d}건` (`text-xs font-bold text-zinc-500 mt-3`), then the documents rendered through the same
  `rowsBlock(key, rows, emptyText, rowOf)` helper the minutes rows use — its now-generalised fourth argument is
  the row renderer, defaulting to the minutes' own `TodoRow` and, for documents, `docRow`: a `TodoRow` with lead
  `{ text: "문서", tone: "text-violet-300 border-violet-700" }`, the document's title, and a mono
  `text-xs text-zinc-500` marker reading `d.addedAt.slice(2)` (`YY-MM-DD`); tapping opens
  `onOpenDocument(d.id)`. Key `"doc:" + p.id`. The block is skipped entirely at zero documents — the head's own
  `문서 0건` already states the count, so no empty-text line is needed.
- **The memo group** (`프로젝트 없음 · 긴급 메모`) gets the same head shape (`회의록 {n}건 · 문서 {d}건`), the
  same `문서 추가` button (`onAddDocument(null)`), and its own documents block keyed `"doc:none"`, after the memo
  rows.
- Intro caption gains one sentence: `문서는 요약 글만 저장돼요 — 파일은 저장되지 않아요.`

`ProjectPicker({ projects, pid, onPick, note })` — the shared `프로젝트` chip row (`없음 (긴급 메모)` first, `on
= pid === null`, then one chip per project) is extracted from `MeetingModal` and reused by `DocumentModal` below,
so the two forms never duplicate the same ≥ 6-line block.

## `DocumentModal({ state, doc, projectId, onClose, onAdd, onUpdate, onRemove })`

`modal: { type: "document", docId?, projectId? }`, title `문서 추가` / `문서`.

- State: `pid` from `doc?.projectId ?? projectId ?? null` (an explicit `null` — the memo group's own `문서
  추가` — is a document with no project, not "no chip chosen yet"); `title`, `source`, `summary`.
- **Edit mode** shows two facts first (`CvFact`): `프로젝트` (`project?.name || "없음 (긴급 메모)"`), `추가일`
  (mono `doc.addedAt`).
- **Fields**, in order: the `프로젝트` `ProjectPicker`; `BizField` `문서 제목 — 예: 요구사항 정의서 v2`;
  `BizField` `출처 (선택) — 파일 이름이나 링크`; `MeetingText` `문서 요약 — 핵심 내용을 요점으로 적어요`
  (`rows={8}`, `cap={DOC_LIMITS.summary}`). Caption: `파일은 저장되지 않아요 — 요약 글만 저장돼요. 문서는
  목표·실행·점수에 반영되지 않아요.`
- **Submit** refuses, in order: `프로젝트를 골라 주세요.` (only when `pid !== null` names no live project — the
  memo guard, exactly as `MeetingModal`'s), `문서 제목을 입력해 주세요.`, `문서 요약을 입력해 주세요.`, then the
  cap messages built from `DOC_LIMITS` — `문서 제목은 60자까지예요 — 지금 {n}자예요.`, `출처는 120자까지예요 —
  지금 {n}자예요.`, `문서 요약은 5000자까지예요 — 지금 {n}자예요.` — then whatever `onAdd` / `onUpdate` returns
  (the storage refusal). Writes `{ projectId: pid, title, ...(source ? { source } : {}), summary }` — clearing the
  source on an edit drops the key; the summary is trimmed at the ends only, so interior line breaks and spacing
  are byte-identical to what was typed.
- **Buttons**: `등록` / `저장`; edit mode adds `삭제` → `window.confirm("{title} 문서를 삭제해요. 계속할까요?")`
  → `onRemove(doc.id)`.

## Root handlers and toasts

Clone-pattern updates writing only `documents` — never `act`, `tasks`, `goals`, `areas`, `room`, `exams`,
`events`, `meetings` or `work` ([Rule 1](../design-docs/core-beliefs.md#rule-1),
[Rule 18](../design-docs/core-beliefs.md#rule-18)):

| Handler | Effect | Toast |
|---|---|---|
| `addDocument(next)` | `recordFits({ id: uid(), ...next, addedAt: today }, 0, "문서를")`; a refusal writes nothing, otherwise prepends the record | `문서를 등록했어요` |
| `updateDocument(id, next)` | replaces the record, keeping `id` and `addedAt`; `recordFits` measured against the stored record's length | `문서를 수정했어요` |
| `removeDocument(id)` | filters the document out (the confirm is the sheet's) | `문서를 삭제했어요` |

`removeProject(id)` — after the existing minutes guard — also refuses a project that still has documents: `문서
{n}건이 있어 삭제할 수 없어요 — 문서를 먼저 지워요.` `ProjectModal` gains a `documentCount` prop (the root
passes the live count) and disables `삭제` when `meetingCount > 0 || documentCount > 0`, stating the documents
line only when the minutes line does not already apply. `resetAll` / `exportBackup` / `importBackup` need no
change — the whole state travels, and `migrate` adds the empty array to an older backup.

## Where documents are read

- **The `미팅` tab** (above): listed per project and in the memo group.
- **The meeting-prep card** (`MeetingPrepCard`, [daily-work.md](daily-work.md)): up to `PREP_DOCS` (5) of the
  matched project's documents, each as `{title} — {oneLineText(summary, DOC_SUMMARY_CLIP)}`, tapping opens the
  document sheet; `{k}건 더` past the cap, `문서 없음` at zero.
- **The prep packet** (`buildPrepPacket`, `AI에게 회의 준비 묻기`, [assistant-bridge.md](../design-docs/assistant-bridge.md)):
  title and summary only, up to `PREP_PACKET_DOCS` (10), clipped at `PREP_PACKET_DOC_CLIP` (1,500, trimmed to 500
  under the packet's own cap) — **never `source`**, since a file name or a link can name a drive or a person.
  Since v28, the document list is filtered by `trackOf(d)` first: a `work`-track document never reaches this
  packet even when it belongs to a matched project, and when the event's own track is outside `PACKET_TRACKS`
  the function returns the header plus a single `## 회의` line, `직장 트랙 일정 — AI 패킷에 실리지 않아요`.
- **`NoticeModal`'s document links** ([business.md](business.md#공고-view--national-project-notices-v28)): the
  same checkbox list (`MilestoneLinkList`) as the roadmap sheet's link blocks, one row per document (title and
  the track label), up to 10 — a document link on a notice is a reference, exactly like a milestone's, and
  moves nothing about the document.
- **The daily reader** (`buildReader`, [daily-reader.md](daily-reader.md)): the prep section's document titles,
  and the `{since} 이후 새로 들어온 것` section lists a document added since the last run as
  `문서 · {title} · {project name | 프로젝트 없음}`.

## Demo content

`demoState` carries two documents, prepended after `s.meetings` (so the project ids exist): `요구사항 정의서
v1` on `△△테크 문서 검색 AI` (with a `source`, dated yesterday, a multi-line summary of search scope,
permissions, response format and open questions) and `◇◇스튜디오 예약 페이지 현황 메모` with no project (dated
today, no `source`), so the demo exercises both the project and the project-less path. See
[demo-data.md](../design-docs/demo-data.md).

## Backup and migration (schema v27)

```js
if (s.v < 27) {
  s = { ...s, v: 27, documents: Array.isArray(s.documents) ? s.documents : [] };
}
```
`freshState`: `v: 27`, `documents: []`. See [state-lifecycle.md](../design-docs/state-lifecycle.md).

## E2E coverage (written, not run — standing user instruction)

`tools/e2e/flow10.js` adds four steps after the memo-move step: a document registers under a project with its
title, source and summary, and lists in that project's section (`문서 1건`, the counts line, the row's `문서`
lead); the sheet states `프로젝트`/`추가일`, refuses a 61-char title and a 5,001-char summary with the count, and
an edit that clears the source drops the key; a document with no project lists in the memo group and moves into a
project from its sheet and back; deleting a project with documents is refused with the stated message, and
deleting the documents by title (confirmed) clears the way. `tools/e2e/flow4.js` adds the `v26 save → v27
documents` migration fixture. `tools/e2e/flow.js`'s demo sweep asserts `문서 2건` and both demo document titles.
See [tools/e2e/README.md](../../tools/e2e/README.md).

## What a document never does

- No `goalId`, no difficulty, no points, no trophy, no achievement record, no streak effect, no evidence gate.
- It never runs through `tryComplete`, `completeTask` or `needsEvidence` — there is no completion path.
- It is excluded from `agendaOf`, `todoOf`, `krProgress` and `goalProgress`.
- No file is ever stored: `source` is a text label only, never a file upload, never file content.
- `buildAssistantPacket` (the daily check-in packet), `buildWorkPacket` (`오늘 업무 만들기`) and `calendarExportOf`
  never read `documents` — a document never appears in either of those packets or in the exported calendar file.
  The prep packet reads a document's title and summary only, never `source`.
- Deleting a project with documents is refused, the same policy as one with minutes; deleting the last document
  (or the last meeting) is what allows the project itself to be deleted.
