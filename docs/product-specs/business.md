# Business tab — `사업`

The seventh and last tab (fifth before `미팅` landed 2026-09-16, sixth before `업무` landed 2026-09-17) holds what a
pre-revenue software/AI business is judged by: what has been built (`포트폴리오`), what it sells for (`단가`), what is
contracted and collected (`계약`), a **roadmap** of milestones, a **sales pipeline** of hospital leads, and
**national-project notices** (all three added 2026-09-17/18, schema v28). A business record is a **record, never
a 실행 (task)** — registering a contract, ticking a payment, adding a rate or a portfolio entry, or writing a
milestone, a lead or a notice pays no P, creates no trophy, moves no goal and touches no streak, exactly as a
schedule event does not ([Rule 1](../design-docs/core-beliefs.md#rule-1),
[Rule 18](../design-docs/core-beliefs.md#rule-18)). A period contract is stored as a **billing rule** —
`startMonth`, `months`, `monthly` (optionally `costMonthly`) — plus the user's own `paidMonths` stamps, exactly as
`events[].repeat` is a recurrence rule that `occurrencesOf` expands at render; every billed month, total, margin,
phase and roll-up is computed at render and never written back ([Rule 9](../design-docs/core-beliefs.md#rule-9)).

**Track (v28).** Every deal carries `track` (default `biz` — the safe default is the opposite of every other
record kind, because a contract is business by nature); the milestone, lead and notice tables carry no `track` at
all (both are business by construction, so there is nothing to default). `TRACK_LABEL[trackOf(d, "biz")]` renders
as a mono tag on the deal row and the deal form opens on `사업`. A `work`-track deal is excluded from every AI
packet the same way a `work`-track project is — see [meetings.md](meetings.md#tracks-v28) and
[SECURITY.md](../SECURITY.md); a milestone reads `milestoneTrack` (below) for the same exclusion, since it carries
no field of its own.

Data shape: [`folio[]`, `rates[]`, `deals[]`, `milestones[]`, `leads[]` and `notices[]` in the generated
schema](../generated/db-schema.md). Briefing, home-card and packet rules:
[../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## Screen
`BizTab` props: `state, today, view, onView, onAdd, onEdit, onTogglePaid, onTogglePayment, onOpenMilestone,
onSeedRoadmap, onOpenLead, onOpenNotice`. Tab key `biz`, label `사업`, icon `Briefcase`, seventh and last entry of
`NAV` (`grid-cols-7` since `업무` landed 2026-09-17, [daily-work.md](daily-work.md); the sixth tab before that,
`성장`, was removed 2026-09-15 — [growth.md](growth.md)).

- Header section, in this order: a `SectionLabel` reading `사업` (cyan) with the per-view add button on the same
  row (`계약 추가` / `단가 추가` / `포트폴리오 추가` / `마일스톤 추가` / `리드 추가` / `공고 추가`, keyed by
  `BIZ_ADD_LABEL`), then three full-width `font-mono text-xs` lines — never beside the button, because a summary
  line sharing the header row was measured to wrap mid-word at 390 px — then the six view `Chip`s (two rows at
  390 px since the pipeline and notice chips landed, 2026-09-18).
- All three header lines read one `bizSummary(state, today)` call, so the tab header, the briefing, the `할 일`
  header's business button and the packet can never disagree:
  ```
  이번 달 계약 {won} · 입금 확인 {won}
  남은 계약 {won} · 견적 대기 {won} · 입금 미확인 {n}건
  일시금 미확인 {n}건 · 이번 달 일시금 입금 {won}
  [계약] [단가] [포트폴리오] [로드맵] [리드] [공고]
  ```
  Each fragment is wrapped in `whitespace-nowrap`, and `입금 미확인 {n}건` / `일시금 미확인 {n}건` are additionally
  `text-rose-400` when their count is above zero (the second when `payOverdue > 0`, not merely `payDue.length > 0`).
  Every number is printed, including zero — there is no absence phrase on these lines
  ([Rule 13](../design-docs/core-beliefs.md#rule-13)). The third line is new (v28) and is never merged into the
  first two: a lump-sum payment (`계약금` / `중도금` / `잔금` / `기타`) is never added to `thisMonth` / `collected` /
  `backlog`, which read the billing rule only — a month's instalment is already a `paidMonths` stamp, and counting
  a lump sum there too would double-count the same money twice.
- The chosen view is stored in `state.ui.bizView` (`"deals"` | `"rates"` | `"folio"` | `"roadmap"` | `"leads"` |
  `"notices"`, `roadmap`/`leads`/`notices` added v28) and survives a reload, following the `ui.scheduleView`
  precedent exactly: the root's `setBizView` spreads it into `ui`, and `BizTab` treats any other value — including
  a save written before v20 — as `"deals"`. The add button's target modal is looked up in one map,
  `BIZ_ADD_MODAL = { deals: "deals", rates: "rates", folio: "folio", roadmap: "milestone", leads: "lead", notices:
  "notice" }`.

## `bizSummary(state, today)`
The one object every surface above reads. `month = today.slice(0, 7)`. `thisMonth` — this month's billed revenue
over `won` deals. `collected` — `monthly` summed over `won` deals whose current month is billed **and** stamped
paid. `backlog` — `monthly ×` the billed months strictly after this month, up to each deal's end. `pipeline` —
`dealTotal` summed over `status === "quote"`. `unpaid` — `{ deal, month, amount }` for every billed month at or
before this month missing from `paidMonths`, month-ascending. `counts` — `{ lead, quote, won, lost, active,
upcoming, ended, unpaid }`.

**Payment figures (v28).** Three more fields, read from `deals[].payments` and never mixed into the monthly ones
above: `payDue` — `{ deal, payment }` for every unpaid line due on or before `today + PAYMENT_SOON_DAYS` (7),
due-ascending; `payOverdue` — how many of those are due before `today`; `payPaidMonth` — the sum of `amount` over
every line whose `paidAt` falls in this month. A deal with both a `paidMonths` stamp and a paid lump sum in the
same month counts the month once in `collected` and the lump sum once in `payPaidMonth` — the two figures never
share a source, so neither can double- or half-count the other's money.

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
One row per deal, `client · title` on the first line with the track tag (`TRACK_LABEL[trackOf(d, "biz")]`, the
same `TRACK_TONE` chip style every record kind uses — see [meetings.md](meetings.md#tracks-v28)), the status chip
and `수정`:
```
○○테크 · 재고 관리 자동화 도구                    [사업]  [계약]  [수정]
2026-09 ~ 2026-11 · 3개월 · 월 120만원
총 360만원 · 마진 270만원 (75%)
입금 확인
[2026-09] [2026-10] [2026-11]
입금 예정
[계약금 2026-09-22 · 300만원] [잔금 2026-08-31 · 60만원]
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
- **Lump-sum payment chips (v28)**, shown under a block labelled `입금 예정` when the deal carries at least one
  line in `dealPayments(d)` (due-ascending): each chip reads the kind label (`PAYMENT_KIND`), the due date and,
  after ` · `, `wonText(amount)` — emerald when paid, rose when unpaid and past due, zinc otherwise. Tapping a
  chip calls `onTogglePayment(dealId, paymentId)`, which stamps or clears that line's `paidAt` and nothing else —
  the same one-field toggle as the monthly chips, on a different array.

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
| track | `TrackRow` chips (v28) | after `메모 (선택)`; defaults `biz`; writes `track` |
| payments | a card list, `입금 예정 (선택)` (v28) | after the track row; up to 12; see below |

`makeDealFromLead` (below) opens this form with a `prefill` prop (`client`, `title: ""`, `status`, `track: "biz"`)
read only by the initial state of a **new** deal; an existing deal ignores it.

**Payment lines (v28).** A block headed `입금 예정 (선택)` with a mono count `{n} / 12`: one card per line — a
`BizChips` row over `PAYMENT_KIND` (`계약금` / `중도금` / `잔금` / `기타`), a date input (`입금 예정일`), a number
field `금액 (원)` and a remove `X` (`입금 예정 삭제`); a line already stamped paid shows a mono tag `입금 확인
{date}` instead of the remove control. `항목 추가` appends a card and disables past 12 with the caption `입금 예정은
12건까지예요.` There is deliberately **no monthly kind** — a month's instalment is already a `paidMonths` stamp on
the deal, and a second record of the same month here would double-count it; only `deposit | interim | final |
other` are stored. Validation (checked after the existing deal refusals, 1-based): `입금 예정 {k}번째 항목의 날짜와
금액을 입력해 주세요.` The `payments` key is written only when at least one line remains — a cleared list drops
the key rather than storing `[]`.

Validation, checked in this order: `고객사를 입력해 주세요.` → `일감 이름을 입력해 주세요.` → `계약 상태에서는
시작 월과 개월 수가 필요해요.` (status `계약` only) → `개월 수는 1 이상 120 이하로 입력해 주세요.` →
`월 청구액은 0 이상 숫자로 입력해 주세요.` → `월 원가는 0 이상 숫자로 입력해 주세요.` → the payment-line refusal
above.

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

## `로드맵` view (v28)

`RoadmapView({ state, today, onOpen, onSeed })`, `modal.type: "milestone"`. A milestone is a **record**, never a
task ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 18](../design-docs/core-beliefs.md#rule-18)): the
user sets its `status` (`planned` / `active` / `done`, `MILESTONE_STATUS`) by hand; D-day, linked-work completion
and pace are derived at render and never stored ([Rule 9](../design-docs/core-beliefs.md#rule-9)).

- Header: `SectionLabel` `로드맵`, a mono counts line `예정 {a} · 진행 중 {b} · 완료 {c}`; when
  `stageOrderNote(list)` is non-null, an amber line `단계 순서: {a}단계 미완 · {b}단계 진행 중` (the lowest
  not-done stage against a higher `active` one — **stated, never enforced**, TD-70: sales can start while
  delivery still runs). Empty: `로드맵이 비어 있어요.`, a button `기본 로드맵 채우기` → `onSeed()`, caption
  `상황에 맞춘 9단계를 넣어요 — 날짜·조건은 수정할 수 있어요.`
- Otherwise three groups (`진행 중` / `예정` / `완료`, empty ones omitted), each row a `TodoRow`: lead `{n}단계`
  (or `단계 없음`), the title, a marker `{D-day 또는 기한 없음} · 업무 {done}/{total}` (rose past due and not
  done), done rows struck through. Caption under the groups: `마일스톤은 기록이에요 — 상태는 직접 바꾸고, 기한·연결
  업무·페이스는 계산돼요.`
- `MilestoneModal({ state, milestone, today, onClose, onAdd, onUpdate, onRemove })`: edit-mode facts `기한`
  (with its D-day), `연결 업무` (`{done}/{total}`), `페이스`, `완료일`; fields `마일스톤` (title, cap 60), `단계`
  (chips `없음` / 1–9), `기한 (선택)` (date), `상태` (chips), `달성 조건 (선택)` (cap 200); link blocks `계약
  연결`, `프로젝트 (선택)` (a select, `연결 안 함` first), `문서 연결`, `업무 연결` (the newest 30 work rows by
  date then creation, plus every already-linked item whatever its age) — each link kind capped at 10
  (`MILESTONE_LINKS`); a deleted link target is dropped from the initial selection, never counted. Refusals, in
  order: `마일스톤 이름을 입력해 주세요.` → `마일스톤 이름은 60자까지예요 — 지금 {n}자예요.` → `달성 조건은
  200자까지예요 — 지금 {n}자예요.` → `연결은 종류별 10개까지예요.` Delete confirm: `{title} 마일스톤을 삭제해요.
  계속할까요?`
- **Helpers** (Business region, banner `/* ── Roadmap (v28) ── */`): `seedMilestones(today)` maps
  `ROADMAP_SEED` (nine literal `{ stage, title, due, condition }` rows, the user's own situation dated
  2026-09-17 — stages 5/7/8's dates are interpolated and say so in their own condition text) into full records;
  `milestoneOrder` (not-done before done, then stage, then due, then creation); `milestoneWork(state, m)` →
  `{ done, total }` over the live `workIds` only (a dangling id is skipped, never counted); `elapsedBetween(from,
  to, today)` — a pure, `today`-based sibling of `elapsedRatio` (which reads `Date.now()` and belongs to goals);
  `milestonePace(state, m, today)` mirrors `paceOf`'s ±5 %p thresholds with progress = the linked-work done
  ratio — done → `완료`; no due → `기한 없음 — 페이스 계산 불가`; no linked work → `연결 업무 없음 — 페이스 계산
  불가`; `stageOrderNote`; `milestoneLine(state, m, today)` — the one line the roadmap rows, the reader and the
  `주간 회고` packet print (stage, title, D-day, `업무 {done}/{total}`, the pace label); `milestoneTrack(state,
  m)` — `work` when any live linked deal, document, work item or project is on the `work` track, else `biz`; a
  briefing line naming a milestone carries this so a day-job-linked milestone never reaches a packet.
- **Handlers** (App root, after the documents block; each writes `milestones` only): `addMilestone(next)` /
  `updateMilestone(id, next)` (`recordFits`, noun `마일스톤을`; `doneAt` is stamped only while `status === "done"`,
  kept or cleared otherwise) / `removeMilestone(id)`; `seedRoadmap()` fills the nine seeds only into an empty
  roadmap, toast `기본 로드맵 {n}건을 채웠어요`.

## `리드` view — sales pipeline (v28)

`LeadsView({ state, today, onOpen })`, `modal.type: "lead"`. A lead is a **record** of a hospital sales
conversation, never a task or a deal by itself: `dealId` is set only when the user registers a contract from it.

- Header: `SectionLabel` `리드`, a mono line `리드 {n}건 · 다음 액션 기한 지남 {m}건` (rose when `m > 0`,
  `leadOverdue` = not won and `nextDue` before today). Empty: `등록한 리드가 없어요 — 병원 이름부터 적어요.`
- Groups by `LEAD_STAGES` order (`잠재` → `접촉` → `시연` → `제안` → `견적` → `계약`), empty groups omitted; rows
  a `TodoRow` with the stage label as lead (cyan for `won`), the name as title, a rose-when-overdue D-day marker
  when a next due exists. Caption: `리드는 기록이에요 — 견적·계약 단계에서 계약을 만들어 연결해요.`
- `LeadModal({ state, lead, onClose, onAdd, onUpdate, onRemove, onMakeDeal })`: edit-mode facts `단계 변경일`
  (`stageAt`) and `계약` (the linked deal's `client · title`, `연결 없음`, or `연결 대상이 삭제됐어요` for a
  dangling id); fields `병원·기관 이름` (cap 60), `단계` (chips over `LEAD_STAGE_LABEL`), `담당자·연락 경로
  (선택)` (cap 80), `다음 액션 (선택)` (cap 120), `다음 액션 기한 (선택)` (date), `메모 (선택)` (cap 400). In edit
  mode, when the **saved** stage is `견적` or `계약` and no live deal is linked, a button `계약 만들기 ›` →
  `onMakeDeal(lead)`. Refusals, in order: `병원·기관 이름을 입력해 주세요.` → the four length refusals in field
  order. Delete confirm: `{name} 리드를 삭제해요. 계속할까요?`
- **Lead → deal conversion.** `계약 만들기 ›` calls the root's `makeDealFromLead(lead)`, which opens `DealModal`
  prefilled (`client` = the lead's name, `title: ""`, `status`: `won` when the lead's stage is `won` else
  `quote`, `track: "biz"`) rather than writing a deal silently — a `won` deal needs a start month and a month
  count the lead does not carry, and `DealModal`'s own refusals apply unchanged. Registering that form runs
  `addBiz`'s lead branch: it writes the new deal **and** sets `dealId` on the source lead in the same update,
  toast `계약을 등록했어요 · 리드 연결`.
- **Handlers** (App root; each writes `leads` only, `addBiz` with a lead also writes `deals`):
  `addLead(next)` stamps `stageAt: today` and `createdAt: today`; `updateLead(id, next)` keeps `stageAt` when the
  stage is unchanged, else stamps `today`, and always keeps `dealId`; `removeLead(id)`. Toasts `리드를
  등록했어요` / `수정했어요` / `삭제했어요`.

## `공고` view — national-project notices (v28)

`NoticesView({ state, today, onOpen })`, `modal.type: "notice"`. A notice is a **record** of a national-project
call the business is tracking, never a task.

- Header: `SectionLabel` `공고`, a mono line `공고 {n}건 · 마감 14일 이내 {m}건` (`noticeSoon`, which also counts
  an open notice already past its deadline — its own row marker is rose). Empty: `등록한 공고가 없어요.`
- Rows by `noticeOrder` (open first, then deadline ascending): the status label as lead (cyan `제출`, emerald
  `선정`, dimmed zinc `탈락`), the title, a rose-when-past D-day marker. Caption: `공고는 기록이에요 — 마감은
  캘린더 내보내기에 들어가요.`
- `NoticeModal({ state, notice, onClose, onAdd, onUpdate, onRemove })`: fields `공고 이름` (cap 80), `기관` (cap
  60), `공고일 (선택)` (date), `마감일` (date, required), `상태` (chips over `NOTICE_STATUS_LABEL`: `검토` /
  `작성` / `제출` / `선정` / `탈락`), `문서 연결 ({n}/10)`, `메모 (선택)` (cap 400). Refusals, in order: `공고
  이름을 입력해 주세요.` → `기관을 입력해 주세요.` → `마감일을 선택해 주세요.` → the length refusals → `문서
  연결은 10개까지예요.` Delete confirm: `{title} 공고를 삭제해요. 계속할까요?`
- **Handlers** (App root; each writes `notices` only): `addNotice` / `updateNotice` / `removeNotice`, toasts
  `공고를 등록했어요` / `수정했어요` / `삭제했어요`.

## Root handlers and toasts
One generic trio, not nine, keyed by `list` (`"folio" | "rates" | "deals"`), all using the `structuredClone`
updater pattern:

| Handler | Effect | Toast (`list` = deals / rates / folio) |
|---|---|---|
| `addBiz(list, item, imgWarn?, leadId?)` | prepends `{ id: uid(), createdAt: today, ...item }` — an id supplied by `FolioModal` wins; with a live `leadId` (v28), also sets that lead's `dealId` to the new deal in the same clone update | `계약을 등록했어요` / `단가를 등록했어요` / `포트폴리오를 등록했어요` (` · 리드 연결` appended for the `leadId` case) |
| `updateBiz(list, id, next, imgWarn?)` | replaces the record, keeping `id`, `createdAt` and, for a deal, `paidMonths` | `계약을 수정했어요` / `단가를 수정했어요` / `포트폴리오를 수정했어요` |
| `removeBiz(list, id)` | drops the record | `계약을 삭제했어요` / `단가를 삭제했어요` / `포트폴리오를 삭제했어요` |
| `toggleDealPaid(id, month)` | adds or removes `month` in `paidMonths` (kept sorted) | `{YYYY-MM} 입금 확인으로 표시했어요` / `{YYYY-MM} 입금 확인을 취소했어요` |
| `toggleDealPayment(dealId, paymentId)` (v28) | sets or clears that line's `paidAt` (`today` / removed) — writes `deals` only | `{kind} 입금 확인으로 표시했어요` / `{kind} 입금 확인을 취소했어요` |

`removeBiz` asks first through `window.confirm`, the `removeGoal` precedent — a rate carries neither an image nor
a stamp, so only these two confirm:
- folio: `{title} 포트폴리오를 삭제해요. 등록한 대표 이미지도 함께 사라져요. 계속할까요?` (also deletes
  `liferpg-img-folio-{id}`)
- deals: `{client} {title} 계약 기록을 삭제해요. 입금 확인 표시 {n}건도 함께 사라져요. 계속할까요?`, with
  ` 입금 예정 {n}건도 함께 사라져요.` appended (v28) when the deal carries any payment lines

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

## The other two surfaces
- **Daily briefing**: section `사업`, inserted after `목표 페이스` and before `영역·활동`; every line routes back
  to this tab (`action: { type: "biz" }`, part of `TAB_ACTIONS`). Inside the section, in order: the unpaid-month
  lines (unchanged), up to `PAYMENT_ALERT_MAX` (3) `payDue` lines (`{client} {title} — {kind} 입금 예정 {due} ·
  미확인`, v28), `다음 액션 기한 지난 리드 {n}건` (a count only, never a name, only when `n > 0`, v28), up to
  `NOTICE_ALERT_MAX` (2) open-notice lines (`공고 {title} — 마감 {D-day}`, v28), then up to `ROADMAP_ALERT_MAX`
  (2) not-done milestone lines (`마일스톤 {title} — {D-day}`, v28) — the milestone lines carry `milestoneTrack`
  and the lead/notice lines carry `track: "biz"` and `packet: false` so neither reaches the daily packet (below);
  every one of these still counts inside `CAP − 1` with the existing alerts, so a full slate of business alerts
  can crowd out an ending-contract or stale-quote line before the closing revenue line, which never drops
  (TD-72's crowding note).
- **Assistant packet**: `## 사업 (계약·매출)`, at most `PACKET_BIZ_LINES` (6) lines — filtered to `trackOf(d,
  "biz")` deals (v28), with the section's own summary recomputed over that filtered list so its totals match the
  lines it names; `bizPacketLines` gains one line per payment line of an allowed deal (`- 입금 예정 {kind} {due}
  {client} {title} {won}`, plus ` · 입금 확인 {paidAt}` when paid, v28). A milestone, a lead and a notice **never**
  appear in this packet — see [assistant-bridge.md](../design-docs/assistant-bridge.md) for the fourth packet
  (`주간 회고`), which is the only one that carries the roadmap, the pipeline and open notices, filtered to the
  business track. `parseAssistantReply` reads only `tasks`, so a pasted reply can never create a deal, a rate, a
  portfolio entry, a milestone, a lead or a notice.

There is no home-card line for this any more (2026-09-15) — home is a CV with no date-scoped facts; the unpaid
count and the quote count instead render as a button on the `할 일` header ([tasks.md](tasks.md)) whenever either
is above zero. Both remaining surfaces are specified in
[../design-docs/assistant-bridge.md](../design-docs/assistant-bridge.md).

## The `할 일` tab
Two of the facts above also render as rows in the unified to-do list ([tasks.md](tasks.md)),
keyed to the same `bizSummary` call and capped by `BIZ_ALERT_MAX` (3, shared with the briefing's `slice(0,
BIZ_ALERT_MAX)`): an unpaid billed month and a `won` contract ending inside `DEAL_END_SOON` months, each keyed to
the month's closing day so they land in the same time group a task or an event would. A stale quote is
deliberately **not** a row there — it has an age, not a date, so there is no day to file it under without
inventing one ([Rule 13](../design-docs/core-beliefs.md#rule-13)); it stays only in the briefing and in this
tab's `견적 대기` group, and the to-do list's header states its count instead. Every business row there is a
compact `TodoRow` with **no completion control** — tapping it opens `BizTodoModal`, a detail sheet stating the
month and the same fact text the old row printed on itself (`입금 미확인 {won} · 목표 기여 없음` /
`계약 종료 · 남은 계약 {won} · 목표 기여 없음`) plus a `사업 탭에서 보기 ›` button that lands here on `계약`
(2026-09-16, [tasks.md](tasks.md)); nothing about a contract or a payment is ever reachable from `할 일` beyond
that. A lump-sum payment line, a milestone, a lead and a notice have **no `todoOf` row at all** (TD-72, accepted):
the briefing and the reader (below) carry them instead, and `할 일` never grows a seventh business row kind.

## The reader and the calendar file
`buildReader`'s `사업 로드맵` section (after `biz`, before `goals`) opens with `timeLine` (see
[daily-work.md](daily-work.md#weekly-time-budget-v28)), then `stageOrderNote` when present, then one item per
not-done milestone by `milestoneOrder` (`milestoneLine`, plus a `조건: ` sub-line when the milestone carries one).
`사업 파이프라인 · 공고` (after `사업 로드맵`) lists overdue lead actions, then leads due within `LEAD_SOON_DAYS`
(3), then open notices past or within `NOTICE_SOON_DAYS` (14) — full `leadLine` / `noticeLine` text, a `메모:`
sub-line when a note exists, never a count-only line, since the reader is not a packet. Both sections'
`action: { type: "biz" }`. The `계약·입금 미확인` section restates the briefing's payment, lead-count and notice
lines by construction (it reuses the briefing's `biz` items). See [daily-reader.md](daily-reader.md).

The exported `.ics` file (v28) additionally carries an open follow-up's due date, a milestone's due day and
D-7, an unpaid payment line's due day (never its amount) and an open notice's deadline — every track included,
no lead. See [../design-docs/calendar-export.md](../design-docs/calendar-export.md).

## Storage arithmetic
Unit: string length against `STORAGE_BUDGET` (3,672,064 chars, the meetings region's budget).
- **Milestone**: an empty record ≈ 120 chars plus its title; typical (30-char title, a due, a stage, a 60-char
  condition, three links) ≈ 320; full (60-char title, 200-char condition, three lists of 10) ≈ 900; the nine
  seeds ≈ 2.2 k once.
- **Payment line**: `{"id","kind","due","amount"}` ≈ 75 chars (+21 with `paidAt`); `,"payments":[]` adds 14 to a
  deal the first time; twelve full lines ≈ 1.2 k on one deal.
- **Lead**: overhead ≈ 110 + name (≤60) + contact (13+80) + next action (16+120) + next due (22) + note (10+400)
  + deal id (22) + stage date (23) ≈ 880 full, ≈ 260 typical; fifty leads ≈ 13 k.
- **Notice**: overhead ≈ 110 + title 80 + agency 60 + posted date 24 + note 410 + ten document ids 130 ≈ 820
  full, ≈ 250 typical; twenty a year ≈ 5 k.
- Every write of a milestone, a lead, a notice or a payment-carrying deal runs `recordFits` (nouns `마일스톤을` /
  `리드를` / `공고를` / `계약을`).

## Demo content (v28)
`demoState` (see [../design-docs/demo-data.md](../design-docs/demo-data.md) for the full ledger): every deal, the
document-search folio entry and the memo are `track: "biz"`; the roadmap is `seedMilestones(today)` with the
first stage stamped `done` (`doneAt` yesterday) and the second stamped `active` with the `○○물산` deal and the
open manual business work item linked — reader figures `예정 7 · 진행 중 1 · 완료 1`; the `△△테크` deal carries an
unpaid `deposit` line due in 5 days (₩3,000,000) and the `○○물산` deal a paid `final` line due 20 days back
(₩600,000, paid 18 days back) — header third line `일시금 미확인 1건 · 이번 달 일시금 입금 {0원 | 60만원}`
(depends on the day of the month the demo is opened, since the paid stamp can fall in the current or the prior
month); two leads (`□□병원` at `접촉` with an overdue next action, `◎◎의료원` at `잠재`) and one notice (`데모 AI
바우처 공고`, status `작성`, deadline in 10 days, linked to a demo document) — `리드 2건 · 다음 액션 기한 지남
1건`, `공고 1건 · 마감 14일 이내 1건`.

## E2E coverage (`tools/e2e/`, written per the standing instruction, not executed)
`flow8.js` covers every view of this tab end to end: contract, rate and portfolio form validation and the
boundary checks (unchanged sections); the roadmap seed, a milestone's full link/status/pace lifecycle and the
stage-order note; a contract's payment lines, the paid-stamp toggle, the header's third line and the briefing
line; a lead's registration, overdue-action state, stage stamp and the quote/won contract conversion (`계약
만들기 ›`); a notice's registration, document link and deadline state, and its effect on a planted role stage.
`flow.js`'s demo sweep asserts the figures in [Demo content](#demo-content-v28) above. `flow11.js` and `flow5.js`
cover the reader's and the review's business lines; `flow9.js` covers the calendar file's new entry kinds. See
[../RELIABILITY.md](../RELIABILITY.md) and `tools/e2e/README.md` for the running step count.

## What a business record never does
- No `goalId`, no difficulty, no points, no trophy, no achievement record, no metric change, no streak effect
  ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 18](../design-docs/core-beliefs.md#rule-18)).
- It never runs through `completeTask`, `tryComplete`, `needsEvidence`, `detectKind`, `certByTitle`,
  `jobWeightForCert` or `calcExamPayout`: a certification name inside a deal or portfolio title stays plain text
  ([Rule 10](../design-docs/core-beliefs.md#rule-10), [Rule 19](../design-docs/core-beliefs.md#rule-19)).
- It is excluded from `agendaOf`, `krProgress`, `goalProgress` and `paceOf`, so no business record can move a
  goal's progress or its pace.
- A pasted assistant reply can never create or change one: `parseAssistantReply` reads `tasks` and nothing else.
- A payment chip is a record of what happened, not a completion: it stores a month in `paidMonths` and nothing
  more, exactly as `완료 표시` stores a date in `doneDates`.
- The portfolio image is not evidence: it never touches `needsEvidence`, `EvidenceModal`, or the
  `liferpg-img-ev-*` / `liferpg-img-study-*-{n}` keys, and a missing or failed image never blocks the record from
  saving.
- (v28) A milestone, a lead, a notice and a payment line pay nothing, complete nothing and move no goal, grade or
  role-model requirement fact ([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 14](../design-docs/core-beliefs.md#rule-14),
  [Rule 18](../design-docs/core-beliefs.md#rule-18)); none has a `todoOf` row (TD-72).
- (v28) A lead never becomes a deal by itself — `계약 만들기 ›` only opens a prefilled, empty contract form; the
  lead's `dealId` is set only once that form is registered, by `addBiz`, never by any read of the lead alone.
- (v28) A `work`-track deal, and a milestone whose every live link is on the `work` track, are excluded from
  every AI packet the same as a day-job project or event — see [SECURITY.md](../SECURITY.md).
