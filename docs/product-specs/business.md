# Business tab — `사업`

The fifth tab holds what a pre-revenue software/AI business is judged by: what has been built (`포트폴리오`),
what it sells for (`단가`), and what is contracted and collected (`계약`). A business record is a **record, never
a 실행 (task)** — registering a contract, ticking a payment, or adding a rate or a portfolio entry pays no P,
creates no trophy, moves no goal and touches no streak, exactly as a schedule event does not
([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 18](../design-docs/core-beliefs.md#rule-18)). A period
contract is stored as a **billing rule** — `startMonth`, `months`, `monthly` (optionally `costMonthly`) — plus the
user's own `paidMonths` stamps, exactly as `events[].repeat` is a recurrence rule that `occurrencesOf` expands at
render; every billed month, total, margin, phase and roll-up is computed at render and never written back
([Rule 9](../design-docs/core-beliefs.md#rule-9)).

Data shape: [`folio[]`, `rates[]` and `deals[]` in the generated schema](../generated/db-schema.md). Briefing,
home-card and packet rules: [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## Screen
`BizTab` props: `state, today, view, onView, onAdd, onEdit, onTogglePaid`. Tab key `biz`, label `사업`, icon
`Briefcase`, fifth entry of `NAV` (`grid-cols-6`), placed before `성장`.

- Header section, in this order: a `SectionLabel` reading `사업` (cyan) with the per-view add button on the same
  row (`계약 추가` / `단가 추가` / `포트폴리오 추가`), then two full-width `font-mono text-xs` lines — never beside
  the button, because a summary line sharing the header row was measured to wrap mid-word at 390 px — then the
  three view `Chip`s.
- Both header lines read one `bizSummary(state, today)` call, so the tab header, the briefing, the home card and
  the packet can never disagree:
  ```
  이번 달 계약 {won} · 입금 확인 {won}
  남은 계약 {won} · 견적 대기 {won} · 입금 미확인 {n}건
  [계약] [단가] [포트폴리오]
  ```
  Each fragment is wrapped in `whitespace-nowrap`, and the `입금 미확인 {n}건` fragment is additionally
  `text-rose-400` when `n > 0`. Every number is printed, including zero — there is no absence phrase on these
  lines ([Rule 13](../design-docs/core-beliefs.md#rule-13)).
- The chosen view is stored in `state.ui.bizView` (`"deals"` | `"rates"` | `"folio"`, schema v20) and survives a
  reload, following the `ui.scheduleView` precedent exactly: the root's `setBizView` spreads it into `ui`, and
  `BizTab` treats any other value — including a save written before v20 — as `"deals"`.

## `bizSummary(state, today)`
The one object every surface above reads. `month = today.slice(0, 7)`. `thisMonth` — this month's billed revenue
over `won` deals. `collected` — `monthly` summed over `won` deals whose current month is billed **and** stamped
paid. `backlog` — `monthly ×` the billed months strictly after this month, up to each deal's end. `pipeline` —
`dealTotal` summed over `status === "quote"`. `unpaid` — `{ deal, month, amount }` for every billed month at or
before this month missing from `paidMonths`, month-ascending. `counts` — `{ lead, quote, won, lost, active,
upcoming, ended, unpaid }`.

## `계약` view
Deals are grouped by `dealPhase(deal, month)`, rendered in this order; a group with no row is not rendered at
all. Four statuses are stored (`lead` / `quote` / `won` / `lost`); the three period phases below apply only to
`won` and are derived, never stored.

| Group | Phase | Tone |
|---|---|---|
| `진행 중` | `active` — `won`, started, not yet ended | `text-cyan-400` |
| `예정` | `upcoming` — `won`, `startMonth` in the future | `text-zinc-400` |
| `견적 대기` | `quote` | `text-amber-300` |
| `문의` | `lead` | `text-zinc-400` |
| `종료` | `ended` — `won`, past its billed period | `text-zinc-500` |
| `무산` | `lost` | `text-zinc-600` |

A `won` deal with no period (only reachable from hand-edited data) is `active`. A deal carries no `rateId` and no
work-period field — it snapshots its own `monthly` / `costMonthly` at signing, so a later rate edit or a
differing delivery timeline can never rewrite a past contract's numbers.

### Row anatomy
One row per deal, `client · title` on the first line with the status chip and `수정`:
```
○○테크 · 재고 관리 자동화 도구                              [계약]  [수정]
2026-09 ~ 2026-11 · 3개월 · 월 120만원
총 360만원 · 마진 270만원 (75%)
입금 확인
[2026-09] [2026-10] [2026-11]
```
- **Period line**: `{startMonth} ~ {dealEnd} · {n}개월 · 월 {won}`, or `기간 미정` when the deal carries no
  period — legal for a `lead` or a `quote`, which may carry no numbers at all.
- **Totals line**, shown only once a period and a monthly amount both exist: `총 {won}`, plus ` · 마진 {won}
  ({n}%)` when a cost was entered — rose when the margin amount is negative, a legal result that is printed as it
  is — or, when `costMonthly` is absent, the separate line `원가 미입력 — 마진은 계산하지 않아요`. **The total is
  never hidden for lack of a cost** — only the margin is withheld.
- **Payment chips**, shown for a `won` deal with at least one billed month (`≤` this month, month-ascending, at
  most 12 with `외 {n}개월 더 있어요` naming the remainder): each chip reads its `YYYY-MM` in `font-mono`, emerald
  (`border-emerald-700 text-emerald-300`) when paid and zinc otherwise, and tapping it toggles that month in
  `paidMonths` — the stamp and nothing else, exactly as `완료 표시` toggles a date in an event's `doneDates`.

### `최근 6개월` roll-up
Below the groups, `revenueByMonth(state, monthAdd(month, -5), 6)` rendered with the existing `Bar` component
(ratio against the largest month in the window, `1` as the divisor floor) plus the month in `font-mono` and
`wonText(amount)`. A month with nothing contracted still renders its zero row.

Empty state, when every group is empty: `등록한 계약이 없어요 — 문의·견적부터 기록해요.`

## `단가` view
One row per rate: name, the unit chip (`월` / `일` / `건`), `수정`, then `청구 {won}` — always printed — plus
` · 원가 {won} · 마진 {won} ({n}%)` when a cost was entered, or the separate line `원가 미입력 — 마진은 계산하지
않아요` when it was not. An optional note renders under the money line. Footer: `단가 {n}건 · 원가 입력 {m}건`.
**No average-margin figure** — averaging unrelated rate rows would state a number nothing measured.

Empty state: `등록한 단가가 없어요 — 청구가와 원가를 넣으면 마진이 계산돼요.`

## `포트폴리오` view
A **single column**, not a grid — at 390 px a 2-up grid gives 170 px thumbnails, unreadable for a landscape
diagram. Each card: title, summary, role, `stack` chips, the period `{from} ~ {to}` in `font-mono` when present,
the links as `<a target="_blank" rel="noreferrer">` chips, then the image — `className="w-full max-h-64
object-contain bg-zinc-950 rounded-xl border border-zinc-800"`, the `EvidenceViewModal` pattern — or the line
`대표 이미지 없음`.

Thumbnails are loaded by **one effect on view entry**, keyed on the item ids (the `EvidenceViewModal` `alive`
guard pattern), reading `liferpg-img-folio-{id}` per entry; the same effect records `storageUsedBytes()`, so the
footer does not rescan `localStorage` on every render. Footer: `포트폴리오 {n}건 · 대표 이미지 {m}장 · 저장 공간
{x}MB 사용 중 (약 5MB 한도)`, `{x}` = `(bytes / 1048576).toFixed(1)`.

Empty state: `등록한 포트폴리오가 없어요 — 링크와 대표 이미지 1장을 넣어요.`

## The three modals (`modal.type`: `deals` / `rates` / `folio`)
All three use `<Modal title onClose>`, a `등록` / `저장` submit and, in edit mode, a `삭제` button — the
`EventModal` shape. `modal.item` carries the record being edited.

### `DealModal`
| Field | Control | Notes |
|---|---|---|
| client | text, `고객사 — 예: ○○테크` | required |
| title | text, `일감 이름 — 예: 사내 문서 검색 AI 구축` | required |
| status | chips `문의` / `견적` / `계약` / `무산` | defaults to `문의` |
| start month | label `시작 월`, `input type="month"` | required only when status is `계약` |
| months | number, `개월 수` | required only when status is `계약`; 1–120 (`DEAL_MAX_MONTHS`) when given |
| monthly | number, `월 청구액 (원)` | optional — blank stores nothing |
| cost | number, `월 원가 (원, 선택)` | optional — blank stores nothing, never a stored zero |
| note | text, `메모 (선택)` | optional |

Validation, checked in this order: `고객사를 입력해 주세요.` → `일감 이름을 입력해 주세요.` → `계약 상태에서는
시작 월과 개월 수가 필요해요.` (status `계약` only) → `개월 수는 1 이상 120 이하로 입력해 주세요.` →
`월 청구액은 0 이상 숫자로 입력해 주세요.` → `월 원가는 0 이상 숫자로 입력해 주세요.`

### `RateModal`
| Field | Control | Notes |
|---|---|---|
| name | text, `단가 이름 — 예: 웹 앱 개발 (월)` | required |
| unit | chips `월` / `일` / `건` | defaults to `월` |
| price | number, `청구가 (원)` | required |
| cost | number, `원가 (원, 선택)` | optional |
| note | text, `메모 (선택)` | optional |

Validation: `단가 이름을 입력해 주세요.` → `청구가는 0 이상 숫자로 입력해 주세요.` → `원가는 0 이상 숫자로
입력해 주세요.`

### `FolioModal`
| Field | Control | Notes |
|---|---|---|
| title | text, `제목 — 예: 사내 문서 검색 AI` | required |
| summary | text, `한 줄 설명 (선택)` | optional |
| role | text, `역할 (선택) — 예: 기획·개발 단독` | optional |
| stack | text, `기술 (선택, 쉼표로 구분) — 예: React, FastAPI, pgvector` | optional, split on commas |
| period | two bare `input type="month"` with `~` between | optional, no invented label copy |
| links | text `링크 주소 — https://…` + label chips `GitHub` / `Notion` / `Figma` / `배포` / `기타` | up to 4, each chip appends `{ label, url }` and clears the field; added links render as removable chips |
| image | dashed attachment button, `Paperclip` icon, `📎 대표 이미지 1장 (선택)`, sub-line `JPG·PNG · 가로세로 비율 그대로 저장돼요` | optional; preview carries a `✕` remove button |

Validation: `제목을 입력해 주세요.` · `링크는 http:// 또는 https:// 로 시작해야 해요.` · `링크는 4개까지
등록돼요.` · `이미지가 너무 커요 — 8MB 이하 파일만 등록돼요. (선택한 파일 {n}MB)` (before decoding) ·
`이미지를 읽지 못했어요.` (decode failure) · `이미지를 줄이지 못했어요 — 더 작은 이미지를 골라 주세요.`
(still over the output cap after the retry).

`FolioModal` owns **its own** `fileRef`, like `EvidenceModal` — nothing outside the modal touches that ref. The
image is written **only on submit**, under `liferpg-img-folio-{id}` where `id` is `folio?.id || uid()` computed
at submit time and carried inside the record, so a cancelled form leaves no orphan key. On a storage failure the
record is still submitted, with the failure reason handed back for the second toast — see
[Image pipeline](#image-pipeline-and-storage-guards) below.

## Root handlers and toasts
One generic trio, not nine, keyed by `list` (`"folio" | "rates" | "deals"`), all using the `structuredClone`
updater pattern:

| Handler | Effect | Toast (`list` = deals / rates / folio) |
|---|---|---|
| `addBiz(list, item, imgWarn?)` | prepends `{ id: uid(), createdAt: today, ...item }` — an id supplied by `FolioModal` wins | `계약을 등록했어요` / `단가를 등록했어요` / `포트폴리오를 등록했어요` |
| `updateBiz(list, id, next, imgWarn?)` | replaces the record, keeping `id`, `createdAt` and, for a deal, `paidMonths` | `계약을 수정했어요` / `단가를 수정했어요` / `포트폴리오를 수정했어요` |
| `removeBiz(list, id)` | drops the record | `계약을 삭제했어요` / `단가를 삭제했어요` / `포트폴리오를 삭제했어요` |
| `toggleDealPaid(id, month)` | adds or removes `month` in `paidMonths` (kept sorted) | `{YYYY-MM} 입금 확인으로 표시했어요` / `{YYYY-MM} 입금 확인을 취소했어요` |

`removeBiz` asks first through `window.confirm`, the `removeGoal` precedent — a rate carries neither an image nor
a stamp, so only these two confirm:
- folio: `{title} 포트폴리오를 삭제해요. 등록한 대표 이미지도 함께 사라져요. 계속할까요?` (also deletes
  `liferpg-img-folio-{id}`)
- deals: `{client} {title} 계약 기록을 삭제해요. 입금 확인 표시 {n}건도 함께 사라져요. 계속할까요?`

When `imgWarn` is present, the record toast fires first and the image-failure toast follows after 2,700 ms — the
`specGain` delay pattern in `completeTask`, so the two cannot overwrite each other:
`대표 이미지를 저장하지 못했어요 — 저장 공간이 가득 찼어요. 포트폴리오 이미지를 지우고 다시 시도해요.`
(`reason: "quota"`) or `저장 공간이 부족해요 — 현재 {x}MB 사용 중이라 이미지를 추가하지 않았어요. 기존 이미지를
지운 뒤 다시 시도해요.` (`reason: "budget"`).

`liferpg-img-folio-{id}` is iterated, alongside the evidence and profile keys, by `removeBiz`, `resetAll` and
`exportBackup`; `importBackup` is already generic and needs no change.

## Image pipeline and storage guards
Constants: `IMG_FILE_MAX` 8 MB, `THUMB_MAX_EDGE` 640 px, `THUMB_MAX_CHARS` 300,000, `STORAGE_BUDGET` 3.5 MB.
The write path, in order: **file-size cap before decode** → `resizeImageFit` → output cap with one retry →
budget check → verified write. At every failure the portfolio record still saves, without its image, and its
card renders `대표 이미지 없음` — a bad photo never blocks the record.

- `resizeImageFit(file, max = 640, q = 0.72)` scales by `Math.min(1, max / Math.max(width, height))`, so the
  longest edge is at most 640 px and a smaller source is **never upscaled**; one `drawImage`, one
  `toDataURL("image/jpeg", q)`. Over `THUMB_MAX_CHARS` it retries once at quality `0.55`; still over, it rejects
  with `too-big`. A sibling of `resizeImage` (the fixed 256×320 evidence crop), not a flag on it — the evidence
  path is byte-identical and untouched ([Rule 16](../design-docs/core-beliefs.md#rule-16) applies only there).
- `saveImageChecked(key, dataUrl)` checks the budget first (`storageUsedBytes() + length > STORAGE_BUDGET` →
  `{ ok: false, reason: "budget" }`), then writes, then reads the key back to confirm it survived
  (`persisted(key)`); a write that did not survive is deleted rather than left showing in the in-memory fallback
  for the rest of the session (`{ ok: false, reason: "quota" }`).

The same `persisted` check runs after every `state` write; a save that does not reach `localStorage` toasts
`저장에 실패했어요 — 저장 공간이 가득 찼어요. 백업을 내보낸 뒤 사진을 지워요.`

## The other three surfaces
- **Daily briefing**: section `사업`, inserted after `목표 페이스` and before `영역·활동`; every line routes back
  to this tab (`action: { type: "biz" }`, part of `TAB_ACTIONS`).
- **Home briefing card**: a third mono line under the schedule line, `이번 달 계약 {won} · 입금 미확인 {n}건 ›`
  (rose when `n > 0`), which switches to this tab.
- **Assistant packet**: `## 사업 (계약·매출)`, at most `PACKET_BIZ_LINES` (6) lines. `parseAssistantReply` reads
  only `tasks`, so a pasted reply can never create a deal, a rate or a portfolio entry.

All three are specified in [../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## The `실행` tab
Two of the facts above also render as rows in the unified to-do list ([tasks.md](tasks.md)),
keyed to the same `bizSummary` call and capped by `BIZ_ALERT_MAX` (3, shared with the briefing's `slice(0,
BIZ_ALERT_MAX)`): an unpaid billed month (`입금 미확인 {won} · 목표 기여 없음`) and a `won` contract ending inside
`DEAL_END_SOON` months (`계약 종료 · 남은 계약 {won} · 목표 기여 없음`), each keyed to the month's closing day so
they land in the same time group a task or an event would. A stale quote is deliberately **not** a row there — it
has an age, not a date, so there is no day to file it under without inventing one
([Rule 13](../design-docs/core-beliefs.md#rule-13)); it stays only in the briefing and in this tab's `견적 대기`
group, and the to-do list's header states its count instead. Every business row there is a full-width button with
**no completion control** — tapping it opens this tab on `계약`; nothing about a contract or a payment is ever
reachable from `실행` beyond that.

## What a business record never does
- No `goalId`, no difficulty, no points, no trophy, no achievement record, no metric change, no streak effect
  ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 18](../design-docs/core-beliefs.md#rule-18)).
- It never runs through `completeTask`, `tryComplete`, `needsEvidence`, `detectKind`, `certByTitle`,
  `jobWeightForCert` or `calcExamPayout`: a certification name inside a deal or portfolio title stays plain text
  ([Rule 10](../design-docs/core-beliefs.md#rule-10), [Rule 19](../design-docs/core-beliefs.md#rule-19)).
- It is excluded from `agendaOf`, `doneTodayCount`, `krProgress`, `goalProgress` and `paceOf`, so no business
  record can move a goal's progress, its pace, or the day's completion count.
- A pasted assistant reply can never create or change one: `parseAssistantReply` reads `tasks` and nothing else.
- A payment chip is a record of what happened, not a completion: it stores a month in `paidMonths` and nothing
  more, exactly as `완료 표시` stores a date in `doneDates`.
- The portfolio image is not evidence: it never touches `needsEvidence`, `EvidenceModal`, or the
  `liferpg-img-ev-*` / `liferpg-img-study-*-{n}` keys, and a missing or failed image never blocks the record from
  saving.
