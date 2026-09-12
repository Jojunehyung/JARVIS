# Design
<!-- src: KD --><!-- src: SPEC-8 -->

Dark, single-theme mobile web UI (390 × 844 artboard, `max-w-md` centred column). The design's job is to make evidence and pace legible, not to motivate. Copy tone follows [Rule 13](design-docs/core-beliefs.md#rule-13): numbers and facts only.

## Tokens (Tailwind v3 core classes — no new hex values in UI)
| Role | Token |
|---|---|
| Page background | `bg-zinc-950` |
| Card | `bg-zinc-900 border-zinc-800 rounded-2xl` |
| Sub-block / row inside a card | `bg-zinc-950 rounded-xl` (depth by re-inverting the background) |
| Modal | `bg-zinc-900 border-zinc-700 rounded-2xl`, backdrop `bg-black/70` |
| Text: body / secondary / caption | `text-zinc-100` / `text-zinc-300…400` / `text-zinc-500…600` |

Accent colours are bound to roles — do not swap them:
| Accent | Meaning |
|---|---|
| cyan-500/300 | primary action, active tab, focus, goal progress, RANK UP overlay, business section label and the `진행 중` deal group |
| amber-400/300 | achievement, streak, grade A, onboarding CTA, daily-task registration, ACHIEVEMENT overlay |
| violet-500/400 | study, grade B |
| emerald-500/400 | done, achieved, grade D, job-fit S, a paid-month chip |
| sky-400/300 | exams, grade C, Saturday in the month grid |
| rose-400 | error, destructive action (`목표 삭제`), pace behind, job-fit C (= pays 0), deadline marker, public holiday and Sunday in the month grid, a negative contract margin, an unpaid-month count |

Grade letters: A amber · B violet · C sky · D emerald · E zinc (`GRADE_TEXT`, `GRADE_BORDER`, `DiffBadge`, `CertBadge`; trophy tier colours `TIER_COLORS`: E `#a1a1aa` D `#34d399` C `#38bdf8` B `#a78bfa` A `#fbbf24`). Job-fit tiers `TIER_CLS`: S emerald-400 · A cyan-300 · B zinc-500 · C rose-400. Pace: behind rose-400 · ahead emerald-400 · on track zinc-400 · no deadline zinc-500. Area grade bar cyan-400; goal bar cyan-400 (achieved emerald-400); KR bar zinc-400.

Badges: dark background + light text (-300) + strong border (-600/700), `w-7 h-7 rounded-lg font-mono`. Buttons: filled (-400/500) with `text-zinc-950`; primary `rounded-xl`; large CTA has the pressed effect `border-b-4` (`bg-amber-400 border-amber-600`). Chips: on cyan `bg-cyan-500 text-zinc-950 border-cyan-400` / on amber `bg-amber-400 text-zinc-950 border-amber-300` / off `bg-zinc-950 text-zinc-400 border-zinc-700`.

## Component tokens
| Element | Classes / values |
|---|---|
| Chip on (cyan) | `bg-cyan-500 text-zinc-950 border-cyan-400` |
| Chip on (amber) | `bg-amber-400 text-zinc-950 border-amber-300` |
| Chip off | `bg-zinc-950 text-zinc-400 border-zinc-700` |
| Badge | `w-7 h-7 rounded-lg font-mono` |
| Progress bar | `h-2`, 700 ms transition; area grade and goal `cyan-400` (achieved goal `emerald-400`), KR `zinc-400` |
| Pace text | behind `rose-400` · ahead `emerald-400` · on track `zinc-400` · no deadline `zinc-500` |
| Job-fit tier (`TIER_CLS`) | S `emerald-400` · A `cyan-300` · B `zinc-500` · C `rose-400` |
| Month-grid day number | one tone, first match wins: today `amber-300 font-bold` · public holiday or Sunday `rose-400` · Saturday `sky-400` · other `zinc-300` |
| Modal | `max-w-md bg-zinc-900`, `anim-pop`, `z-40`; backdrop `fixed inset-0 bg-black/70` closes on click, the card stops propagation, header X closes, `max-h-full overflow-y-auto`; bottom sheet on mobile, centred from `sm` |
| Overlay | `z-50` over `bg-black/75`, `anim-bigpop` card, auto-closes after 2,400 ms |

## Typography and rhythm
Numbers, D values, P, percentages, D-day, and system labels (`LIFE MANAGER`, `PROFILE SETUP`, `RANK UP`, `ACHIEVEMENT`) are `font-mono`; section captions `text-xs tracking-widest`. Body mostly `text-xs`–`text-sm`; modal titles `text-base font-bold`; overlay hero `text-2xl font-black`. Vertical rhythm `space-y-4` (sections) / `space-y-3` (inside cards). Progress bar (`Bar`): `h-2 rounded-full`, track `bg-zinc-800`, fill in the context colour, width transition 0.7 s ease-out.

## Constraints
- Tailwind v3 core utilities only, no arbitrary values; icons from lucide only (in use: Trophy, Target, Plus, X, Lock, RotateCcw, TrendingUp, Check, Star, Flag, ClipboardList, CalendarDays, Briefcase, Camera, Paperclip, Link).
- No game visuals ([Rule 7](design-docs/core-beliefs.md#rule-7)); grades 0–9, achievement trophies, streak 🔥 and shield 🛡 are product elements, not game elements.
- Text stays real text; all copy is verbatim Korean UI copy. Proposed alternatives are marked `[제안]` in design canvases.
- Invariants for any redesign: the six-tab structure and per-screen information items; colour-role mapping; five grade colours; pace and "목표 기여 없음" always visible; evidence-first flows (no completion before attachment); the squared role-model bar whose upper segments are wider; mono numbers; dark single theme.

## Screen inventory (design handoff 2026-09-02)
A0 style sheet · A1 onboarding title (`PROFILE SETUP`, "인생 관리", hero illustration, CTA "시작하기", demo link) · A2 onboarding steps (progress bar, chip rows, error "연령대·성별·신분·학력·전공 계열을 모두 선택해 주세요.", appearance step with 무작위 and swatches) · A3 home (`HomeTab`: header LIFE MANAGER / nickname · status / 🔥 streak · 🛡 shields; profile card; "오늘의 초점" with pace; "오늘 할 일") · A4 goals (`GoalsTab`: OKR cards, four KR row types, "＋ 실행 연결", achieved group) · A5 tasks (`TaskTab`: per-goal groups, milestone divider, evidence-required rows, "＋ 이 목표에 실행", 미분류) · A6 growth (`GrowthTab`: achievement wall, life metrics + "체크인", skill track gates + "관문 증명하기", role model with squared segmented bar, "데이터 초기화") · A7 `AddTaskModal` (goal box, KR bridge rows, mode chips [일일 실행 | 학습 (하루분량)], kind chips, difficulty E/D/C, cadence, "등록") · A8 `EvidenceModal` (photo mandatory, two states) · A9 `StudyVerifyModal` (tier box, summary counter, insight, artifact box, CTA) · A10 overlays RANK UP / ACHIEVEMENT · A11 illustration sheet.

## Illustrations
- `PortraitSprite`: bust portrait, viewBox 120 × 150, radial stage background `#2a1e4a → #171130 → #0a0716` with an outfit-coloured halo; dual rim light (right cyan `#67e8f9`, left pink `#f0abfc`) that lifts the figure off the dark UI. Customisation: skin `#f6d7b0 #eec39a #d9a066 #a06a42`, hair `#2b2b2b #5b3a1e #a9714b #c9a227 #7a4fbf #d94f6b`, outfit `#f59e0b #22d3ee #a78bfa #34d399 #fb7185 #94a3b8`, five hair styles, three expressions, gender variants. `Portrait` shows the uploaded photo (256 × 320 slot, `resizeImage`) when present.
- `TrophySvg`: viewBox 30 × 36, kinds `ach` (plaque with tier-coloured frame) / `rank` (flag) / `spec` (medal, ribbon `#dc2626`, gold `#fbbf24`), each in the five tier colours.
- Empty states (`EmptyGoalSvg`, `EmptyQuestSvg`, `EmptyWallSvg`, `WallFrame`) and the onboarding hero (`OnboardingHeroSvg`): restrained flat vectors in neutral + one accent — documents, charts, stamps; nothing cute or consoling.
