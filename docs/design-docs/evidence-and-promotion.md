# Evidence and promotion
<!-- src: SPEC-5 -->

Nothing that matters completes on a click alone: certification and exam tasks (실행) need a photo, study tasks need graded outputs (산출물), activity tasks need a log, and an area (영역) changes grade (등급) only by submitting gate (관문) evidence (증거). The rules are [Rule 10](core-beliefs.md#rule-10), [Rule 11](core-beliefs.md#rule-11), [Rule 16](core-beliefs.md#rule-16) and [Rule 17](core-beliefs.md#rule-17); this page documents what the code enforces, in the order the gates fire. Data tables are generated in [../generated/onboarding-tables.md](../generated/onboarding-tables.md) (`GATE_CHIPS`, `STUDY_REQ`, `RANKS`), storage keys in [../generated/db-schema.md](../generated/db-schema.md#storage-keys-liferpg--frozen-for-data-compatibility).

## Evidence gate (`needsEvidence`)
```
needsEvidence(q) = q.isCert || q.isExam || (q.pts ?? DIFFS[q.diff].pts) >= EVIDENCE_MIN   // EVIDENCE_MIN = 150
```
Difficulty B (150 pts) and A (400 pts) cross the line. New daily tasks are capped at C (60 pts) by [Rule 18](core-beliefs.md#rule-18), so a general task reaches this gate only as legacy data.

## Gate order (`tryComplete`)
Each check fires only while `q.evidence` is empty; the first match opens its modal and stops.
1. `isStudy` → `StudyVerifyModal`
2. `kind` (book / fit) → `ActivityLogModal`
3. `needsEvidence(q)` → `EvidenceModal`
4. otherwise `completeTask(id, null)` at once.

Because every check is `!q.evidence`, a daily activity task asks for a log once and completes one-tap afterwards (reading included). A fitness log submitted with every field empty passes `null`, so `evidence` stays unset and that task reopens the modal each day.

## Photo-mandatory evidence (`EvidenceModal`)
`needPhoto = task.isCert || task.isExam`; `docName` is `성적표` (exam) or `합격증` (certification). Without an image the button is disabled and reads `제출하고 완료 — 첨부 필요`; submitting anyway shows `{docName} 사진을 첨부해야 완료할 수 있어요.` Text chips (`TASK_EV_CHIPS`: `합격·취득 완료` · `결과물 완성·제출` · `계약·판매·수익 발생` · `공식 기록·인증 있음`) and the memo are optional for photo tasks. A legacy B/A general task (`{diff}급 완료 — 증거 선택`) asks for no photo but needs at least one chip (`증거 항목을 하나 이상 선택해 주세요.`). The stored text is `📎 {docName | 사진} 첨부 · {chips joined by " · "} — {memo}`.

`resizeImage(file, 256, 320)` paints the image onto a 256 × 320 canvas with `scale = max(256 / img.width, 320 / img.height)` (cover, centre crop) and exports JPEG at quality 0.82 — a landscape certificate photo is stored cropped to 4:5.

## Image keys and lifecycle
| Key | Written by | Read by | Deleted by |
|---|---|---|---|
| `liferpg-img-ev-{taskId}` | `EvidenceModal` | `EvidenceViewModal` | `removeTask`, `resetAll` |
| `liferpg-img-study-{taskId}-{n}` (n = 1..2) | `StudyVerifyModal` | `EvidenceViewModal` | `removeTask`, `resetAll` |
| `liferpg-img-profile` | profile photo picker | app start | `resetAll` |

The state itself lives under `liferpg-state-v1`; all keys are frozen ([Rule 12](core-beliefs.md#rule-12)). A completed row in `TaskTab` reads `완료 {date} · 🎯 {goal}` (or `목표 기여 없음`), plus ` · 증거 보기` when the task carries `evidence`; the link opens `EvidenceViewModal` with the completion date, the evidence text (or `기록된 텍스트 없음`) and every stored photo under `{합격증 | 성적표 | 산출물 | 증거} 사진 {n}장`.

## Study verification (`STUDY_REQ`, `StudyVerifyModal`)
Decided 2026-08-29. The modal uses `STUDY_REQ[task.diff] || STUDY_REQ.D`, so an undefined tier (A) falls back to D.

| Grade | Summary min (chars, `sum`) | Outputs (`art`) | Limitation / critique (`crit`) | `label` |
|---|---|---|---|---|
| E | 30 | 0 | false | 요약·새 지식 기재 |
| D | 30 | 1 | false | 기재 + 산출물 1건 |
| C | 60 | 1 | false | 요약 강화(60자+) + 산출물 1건 |
| B | 100 | 2 | true | 요약 강화(100자+) + 한계·비판 + 산출물 2건 |

Checks in order: summary ≥ `sum`; `새로 알게 된 것` ≥ 10 chars; when `crit`, the limitation line ≥ 15 chars; `photos.length + linkList.length ≥ art`. Outputs are photos (at most 2, resized like evidence photos) or links — one per line, accepted only when matching `/^https?:\/\/\S+$/`, kept verbatim in `evidence` as `🔗 {url}`. The evidence string ends with ` · {diff}급 산출물 검증 통과`. New study tasks are created at E or D only ([Rule 18](core-beliefs.md#rule-18)); C and B serve legacy rows. `completeTask` logs `📖 {title} ({scope}) — {evidence | 학습 검증}` (scope only when set, `grade` = the area's grade at completion); at pts ≥ 150 it also adds a `spec` trophy `📖 {title}` and a metric gain ([metrics-and-role-model.md](metrics-and-role-model.md)).

## Activity logs (`ActivityLogModal`)
| `kind` | Mandatory | Optional | Stored evidence |
|---|---|---|---|
| book (독서) | star rating 1–5, impression ≥ 15 chars | memorable quote | `독후감 ★{rating} · {review ≤ 60} · "{quote ≤ 40}"` |
| fit (운동) | nothing | workout text, 체중 kg, 골격근량 kg | `운동 기록 · {workout ≤ 40} · 체중 {w}kg · 골격근량 {m}kg`, or `null` when all empty |

Fitness measures go through `applyMeasures`: for each label (`체중`, `골격근량`) the first metric KR of the first active goal whose `kr.title.includes(label)` receives `checkinKR(goalId, krId, value)` (`break outer`) — there is no global metric store for them to fall back to any more ([Rule 8](core-beliefs.md#rule-8)). An activity completion writes only the log line `📚 | 💪 {title} — {evidence}` to the area's achievements: no trophy, no metric gain. A legacy general B/A task logs `{title} — 증거와 함께 완료` and a trophy `kind: "ach"` with `tier: legacyCertGrade(pts)` (A ≥ 550, B ≥ 250, C ≥ 100, D ≥ 50, else E). Certification and exam log strings belong to the scoring engine.

## Grade ladder (`RANKS`)
| grade | name | gate | req |
|---|---|---|---|
| 0 | 지망생 | 관심 단계, 실행 전 | 시작하면 됩니다 |
| 1 | 견습 | 배우는 중 | 학습 기록이 존재해야 함 |
| 2 | 초심자 | 작은 결과물이 있음 | 직접 만든 산출물 1개 |
| 3 | 실무자 | 그 일로 실제 결과가 나옴 | 외부로 나간 산출물 · 첫 수익 · 실업무 수행 |
| 4 | 숙련자 | 안정적으로 반복 가능 | 검증된 결과 3건 이상 |
| 5 | 전문가 | 남이 돈 주고 맡기는 수준 | 유료 의뢰 · 취업 · 지속 수익 등 타인의 지갑이 열린 증거 |
| 6 | 리더 | 사람과 프로젝트를 이끎 | 팀 운영 · 가르친 기록 · 사업 운영 |
| 7 | 마스터 | 업계가 알아봄 | 수상 · 초청 · 지명 의뢰 같은 외부 인정 |
| 8 | 거장 | 분야에 영향을 줌 | 업계의 레퍼런스가 된 증거 |
| 9 | 정점 | 그 분야의 정상 | 대체 불가능한 위치의 증거 |

The home CV shows each area as one row (`AreaGradeRow`) — a grade box, `{name}`, `등급 {cur.name} · 다음 관문 {next.name}` (or `정점 도달` at grade 9) — and tapping the row is the only way to reach `PromoteModal` ([Rule 11](core-beliefs.md#rule-11)); the card carries no separate promote button (2026-09-15, [home.md](../product-specs/home.md); the same row lived on the growth tab before it was removed — [growth.md](../product-specs/growth.md)).

## Promotion (`PromoteModal` → `promoteArea`)
`승급 심사 — {next.name}` opens on a tap of the area row (not a button of its own) and offers `GATE_CHIPS[area.grade + 1]` ([table](../generated/onboarding-tables.md#gate_chips)) plus a memo, under a lead card stating `'{area.name}' 영역 · {RANKS[grade].name} → {next.name}`, `next.gate`, and — moved here from the tab's per-area card, 2026-09-13 — `필요 증거: {next.req}`. At least one chip is required (`해당하는 증거가 없다면 아직 이 등급이 아닌 거예요.`); the evidence text is
```
composeEvidence(chips, memo) = chips.join(" · ") + (memo.trim() ? ` — ${memo.trim()}` : "")
```
`promoteArea(areaId, evidenceText)` does, in one state update: return unchanged when the area is already at grade 9 (`RANKS.length - 1`); `grade += 1`; push `{ text: evidenceText, date: dstr(), grade: <new grade> }` to `area.achievements`; add a trophy `kind: "rank"` labelled `{area.name} {RANKS[grade].name}`; compute `roleGap(...).match` before and after and open the RANK UP overlay, which shows `롤모델 근접도 {from}% → {to}%` or, when equal, `롤모델 근접도 변화 없음 — 이미 요구를 충족한 영역` (`roleTargeted` = `role.targets[areaId] > 0`) / `롤모델 요구 외 영역 — 근접도 변화 없음`. This is the only promotion path; the knowledge quiz (QuizModal) was never implemented ([Rule 11](core-beliefs.md#rule-11)).

## Exception: language specialisation
When an exam completion establishes specialisation ([Rule 2](core-beliefs.md#rule-2): two exams of the same language at D ≥ 75), the area named `어학` is set directly to grade 5 if it is below 5, with the log line `🎖 {language} 전문화 — 고난도 시험(D75+) 2종 달성`. No rank trophy, no RANK UP overlay — the exam path adds a `spec` trophy `{language} 전문화` instead. Onboarding (`computeGrades`) starts an area at grade 6 at most (`Math.min(grade, 6)`).
