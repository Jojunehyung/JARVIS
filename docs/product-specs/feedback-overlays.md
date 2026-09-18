# Feedback — overlays and toast
<!-- src: SPEC-4-7 -->

Two full-screen overlays (`Overlay`) and one toast (`ToastHost`) carry every confirmation the app gives. Both state facts only: what was paid, which goal moved, how far the 롤모델 (role model) is. Encouragement is not allowed, and a completion that contributed to no goal says so ([Rule 13](../design-docs/core-beliefs.md#rule-13)).

## `Overlay`
`fixed inset-0 z-50` over `bg-black/75`; closes on click and after 2,400 ms. There is no queue — a second overlay replaces the first. Three branches: `gradeup`, `achieve`, and (2026-09-18) `stage`.

### `gradeup` — RANK UP
Cyan-bordered card, `anim-bigpop`. Contents in order: the label `RANK UP`, `PortraitSprite` at size 64 (the parametric portrait, so an uploaded profile photo is not shown), the 영역 (area) name, the new rank in 2xl cyan, then the proximity line and the closing sentence `증거로 증명된 승급입니다.`

Proximity line, only when `roleTo != null`:

| Case | Text |
|---|---|
| `roleTo !== roleFrom` | `롤모델 근접도 {from}% → {to}%` |
| unchanged, area is a role-model target | `롤모델 근접도 변화 없음 — 이미 요구를 충족한 영역` |
| unchanged, area is not targeted | `롤모델 요구 외 영역 — 근접도 변화 없음` |

### `achieve` — ACHIEVEMENT
Amber-bordered card. Label `ACHIEVEMENT`, `TrophySvg` (`kind || "ach"`, tier colour, size 34), the name in amber, then:
- payout `D{d} · +{p}P` (the `D{d} · ` part only when `d` is known), formatted with thousands separators;
- job fit, when the achievement carries one: `직무 적합 {tier} · {field}` plus ` 기준(교집합)` for an intersection verdict, then `×{mult}` ([Rule 15](../design-docs/core-beliefs.md#rule-15));
- goal deltas: one `🎯 {title} {from}% → {to}%` line per active goal that moved; an empty array renders `연결된 목표 없음 — 목표 진행에 기여하지 않은 성취입니다`; when `deltas` is undefined (the goal-achieved overlay) the block is omitted entirely;
- closing sentence `기록에 남았습니다.`

### Which completions raise an overlay
| Completion | Overlay | Trophy |
|---|---|---|
| exam (`isExam`) | always, `kind: "ach"`, tier from `examGrade(band.d)` | trophy; a specialisation also adds a `spec` trophy |
| certification (`isCert`) | always, `kind: "ach"` with the job-fit fields | trophy |
| study (`isStudy`) | always, `kind: "spec"` — so an E (10 P) or D (25 P) study task is still shown with `+{pts}P` | trophy only when `pts >= EVIDENCE_MIN` (150) |
| legacy plain task with `pts >= 150` | `kind: "ach"`, tier from `legacyCertGrade(pts)` | trophy |
| activity (`kind`) and plain task under 150 P | none — toast only | none |

### `stage` — STAGE (2026-09-18)

Cyan-bordered card, same shell as `gradeup`, but **no portrait and no trophy**: the mono label `STAGE`, `단계
완료`, the completed stage's name in cyan, `다음: {next stage name}` or `모든 단계 충족`, then the closing
sentence `기록으로 계산된 완료입니다.` A user decision (Rule 7's amendment does not need to touch this — the
overlay states a fact the app already derives, not an AI verdict): growth is felt through facts, never a game
mechanic, so this overlay carries no XP-like number and no new sound or animation beyond the existing
`anim-bigpop`/cyan border `gradeup` already uses.

Raised **once per stage**, by one root effect (after the day-change effect) that compares the derived current
stage `roleStageOf(state, today).k` against the seen-stamp `role.seenStageK`: the stamp exists and `k` rose →
the overlay fires for the stage that just completed, naming the next one (or `모든 단계 충족`); either way the
stamp is rewritten to the current `k` in the same effect. `saveRole` and `importRoleVerdict` both stamp the new
`k` themselves when they write `role.stages`, so replacing the stages (the editor, or a confirmed AI verdict)
never raises this overlay — only a record write that raises the derived `k` between two renders does. This is
the **only** place the `stage` overlay is raised. **Unaffected by the 2026-09-18 role-screen rewrite**: the
overlay has no follow-up action of its own — it auto-closes and a tap closes it, the same as `gradeup`/`achieve`
— so the split of the two role-model sheets into one screen changed nothing here. Mechanics and the seen-stamp's
Rule 9 justification:
[metrics-and-role-model.md](../design-docs/metrics-and-role-model.md#the-stage-completion-overlay-and-seenstagek).

## Toast (`ToastHost`)
A separate component holding its own state, driven imperatively through `toastRef.current.show({ msg })`, so showing or expiring a toast never re-renders the app root. `fixed bottom-16`, `anim-pop`, dismissed after 2,600 ms; a new message resets the timer.

Messages, verbatim:

| Trigger | Message |
|---|---|
| completion contributing to goals | `완료 · 🎯 {title} {from}→{to}%` (several joined by ` · `), plus ` · 보호권 사용` when a 보호권 (streak shield) was consumed |
| completion contributing to none | `완료 · 목표 기여 없음 · 🔥 {streak}일`, plus ` · 보호권 사용` |
| language specialisation, 2,700 ms later | `🎖 {language} 전문화 — 고난도 감쇠 하한 70% 적용` |
| KR check-in that moved a goal | `체크인 · 🎯 {title} {from}% → {to}%` |
| goal created | `목표 생성 · 시작 진행률 {p0}% · {D-day}` or ` · 기한 없음` |
| active goal deleted (confirmed) | `목표를 삭제했어요 · 미완료 실행 {n}건 삭제 · 완료 기록 {m}건 유지` |
| task added | `실행이 추가됐어요` |
| certification already paid | `{title} — 이미 등록된 자격입니다. 자격 지급은 영역과 무관하게 1회입니다.` |
| profile photo saved / unreadable | `📷 사진이 등록됐어요` / `이미지를 읽지 못했어요` |
| role model saved (the `roleEdit` sub-screen's `저장`) | `롤모델 기준 저장 — 근접도는 검증된 등급으로만 계산됩니다` |
| the `롤모델` screen's story `저장` (2026-09-18) | `원하는 모습 저장 · {n}자`, or `원하는 모습 지움` when the trimmed text is empty |
| `롤모델 초기화` confirmed (2026-09-18) | `롤모델 삭제 — 근접도·단계 계산 대상 없음` |
| AI verdict imported, with a verdict | `AI 판정 저장 · 단계 {n}건 · 요구 등급 {m}건` |
| AI verdict imported, grades/stages only | `AI 제안 저장 · 단계 {n}건 · 요구 등급 {m}건` |
| journal saved | `일지를 저장했어요` |
| weekly review saved | `주간 리뷰를 저장했어요` |
| assistant packet copied | `복사했어요 — AI 채팅에 붙여넣어요` or `자동 복사 불가 — 글을 길게 눌러 복사해요` |
| assistant reply imported | `AI 제안 {n}건 등록 · 일지에 답변 저장` or `AI 답변을 일지에 저장했어요 — 제안 실행 없음` |

Overlays and toasts are scheduled with `queueMicrotask` from inside the `setState` updater, so the state change lands first and the feedback describes the state that now exists (see [../FRONTEND.md](../FRONTEND.md)).
