# Evidence, activity log and study verification modals
<!-- src: SPEC-4-6 -->

Completing a 실행 (task) is not a click. `tryComplete` routes the task to the modal its own kind demands, and only that modal's `onDone` reaches `completeTask`. Photo evidence is mandatory for certifications and exams ([Rule 16](../design-docs/core-beliefs.md#rule-16)), study tasks are graded against `STUDY_REQ`, and activity tasks (`kind`) log their own artefact ([Rule 17](../design-docs/core-beliefs.md#rule-17)). Engine detail: [../design-docs/evidence-and-promotion.md](../design-docs/evidence-and-promotion.md).

## Routing (`tryComplete`)
| Condition (in order) | Modal |
|---|---|
| `isStudy && !evidence` | `StudyVerifyModal` (`modal.type === "study"`) |
| `kind && !evidence` | `ActivityLogModal` (`"activity"`) |
| `needsEvidence(task) && !evidence` | `EvidenceModal` (`"evidence"`) |
| otherwise | `completeTask(task.id, null)` immediately |

A task that already carries `evidence` (a repeated daily completion) never re-opens a modal.

## `EvidenceModal`
`needPhoto = task.isCert || task.isExam`; `docName` is `성적표` for exams and `합격증` for certifications.

- Title: `시험 성적 — 성적표 제출` / `자격증 취득 — 합격증 제출` / `{diff}급 완료 — 증거 선택`.
- Lead line, photo required: `「{title}」 — {docName} 사진을 첨부해야만 완료됩니다. 텍스트만으로는 인정되지 않아요.` Otherwise: `「{title}」 — 이 등급은 증거 없이는 완료되지 않아요. 해당하는 항목을 골라 주세요.`
- Attachment (only when `needPhoto`): dashed button `📎 {docName} 사진 첨부 (필수)` with the sub-label `JPG·PNG · 기록에 원본 저장` → `resizeImage` (256 × 320, JPEG quality 0.82) → preview (`object-contain`, `max-h-48`) with an ✕ to clear and the confirmation `첨부 완료 — 제출 시 기록에 저장됩니다`. A read failure sets `이미지를 읽지 못했어요.`
- **Score field, `task.isExam` only (2026-09-16, schema v22)** — see below.
- `EvidencePicker` is always shown: the four `TASK_EV_CHIPS` (`합격·취득 완료`, `결과물 완성·제출`, `계약·판매·수익 발생`, `공식 기록·인증 있음`) plus `한 줄 메모 (선택)`.
- Submit validation, in order: no photo while `needPhoto` → `{docName} 사진을 첨부해야 완료할 수 있어요.`; for an exam task, the score error (below) if any; no chip while `!needPhoto` → `증거 항목을 하나 이상 선택해 주세요.`
- On success the photo is written to `liferpg-img-ev-{task.id}` and `evidence` becomes `📎 {docName} 첨부 · {selected chips joined by " · "}` plus ` — {memo}` when a memo was typed. For an exam task, `onSubmit(text, score.trim())` also carries the score to `completeTask`'s third argument.
- Button: `제출하고 완료`, or `제출하고 완료 — 첨부 필요` while it is disabled (disabled only when `needPhoto && !img` — the score is validated on submit, not by disabling the button).

## Exam score field (2026-09-16, schema v22)
The user asked for the exact score, not just the band, to be recorded and shown. `tasks[].score?` and
`exams.best[famId].score?` hold the score exactly as entered, a trimmed string, on exam milestones completed from
this version on — a **display field only**: `calcExamPayout`, the band snapshot (`label`, `d`, `p`, `ver`,
`date`) and the `q.band.p > prevBest.p` replacement test are all byte-identical to before
([Rule 1](../design-docs/core-beliefs.md#rule-1), [Rule 2](../design-docs/core-beliefs.md#rule-2)). A save from
before v22 simply has no score and shows its band label instead
([state-lifecycle.md](../design-docs/state-lifecycle.md), [scoring-engine.md](../design-docs/scoring-engine.md)).

Strings, not numbers: four families are graded by level (`opic` `IH`, `cambridge` `B2 First`, `jlpt` `N2`, `hsk`
`5급`), and a numeric family must keep exactly what was typed (an IELTS `6.5` must not become `6.50`).

- `examScoreNumeric(fam)` → `true` when every band label of that family matches `EXAM_LABEL_NUM =
  /^\d+(\.\d+)?(?=\s|$)/` — a number, alone or followed by a space (TEPS `268 (3+)` reads `268`) or the string's
  end. This is stricter than "starts with a digit": it also rejects a label like HSK's `1급`, which starts with a
  digit but is not itself numeric. Numeric today: `toeic`, `toeicsp`, `ielts`, `toefl`, `teps`, `gtelp`, `pte`,
  `duolingo`, `jpt`, `sat`, `gmat`, `lsat`, `mcat` (13 families); the other 4 — `opic`, `cambridge`, `jlpt`, `hsk`
  — take free text.
- `EvidenceModal`, only when `task.isExam`: under the photo block, a `점수` input —
  `placeholder="성적표에 적힌 점수 — 숫자만"` (numeric family) or `"성적표에 적힌 등급·점수 그대로"` (level
  family), `inputMode="decimal"` for a numeric family — and a note `점수는 기록용이에요 — 지급 P·등급·난이도는
  {band.label} 구간 기준 그대로예요.`
- `examScoreError(fam, band, raw)` → `""` or, checked in order: empty → `성적표에 적힌 점수를 입력해 주세요.`;
  longer than 20 chars → `점수는 20자까지예요.`; for a numeric family, not `/^\d{1,4}(\.\d{1,2})?$/` →
  `점수는 숫자로 입력해 주세요.`; below `parseFloat(band.label)` →
  `{band.label} 구간 미만 점수예요 — 이 마일스톤은 {band.label} 이상일 때 완료해요.`; above the family's top band
  (the scale maximum) → `{fam.n} 최고 점수는 {max}예요.` A level family accepts any 1–20 character text.
- The below-band refusal is deliberate: completing an `800` milestone with a `790` score report would record an
  achievement the score report itself does not support. It tightens the evidence gate; it changes no payout.
- `examScoreBetter(fam, next, prev)`: for a numeric family, `prev == null || parseFloat(next) > parseFloat(prev)`;
  for a level family, always `true` — free text has no order, so a newer entry at the same band simply replaces
  the shown score.
- The write (`completeTask`): `if (evidence) q.evidence = evidence;` then `if (q.isExam && score) q.score =
  score;`. In the exam branch, the existing `exams.best[q.famId]` replacement gains `score` as an extra field
  under the same condition; a same-band retake (`score && prevBest && q.band.p === prevBest.p &&
  examScoreBetter(...)`) updates only the shown `score`, leaving `label`, `d`, `p`, `ver` and `date` untouched. A
  lower band never touches `best`, exactly as before this change.
- Display: `examBestText(id, b)` → `{examOf(id)?.n || id} {b.score}` when a score exists, else
  `{name} {b.label} 구간` — read by the home CV's `시험` row and `ProfileModal`'s `보유 기록` line and nowhere
  else. `AchievementWallModal`'s exam row keeps `{fam.n} {label}` and its `D{d} · 누적 {P}P` right side, adding
  ` · 점수 {score}` when present. `TaskDetailModal`'s `증거` row reads `성적표 사진 + 점수 필수` for an exam task;
  a `점수` row appears when `q.score` is set ([tasks.md](tasks.md)).

## `EvidenceViewModal`
Added 2026-09-07 as the reader side of the key convention. Opened from the `증거 보기` button on a completed row; title `증거 — {title}`.

- Shows `완료일 {doneAt or the last doneDates entry or "-"}` and the stored `evidence` text, or `기록된 텍스트 없음`.
- Loads `liferpg-img-ev-{id}`, `liferpg-img-study-{id}-1` and `-2` through `store.get`, then renders `{doc} 사진 {n}장` where `doc` is `합격증` / `성적표` / `산출물` / `증거` by task type. While loading: `사진 불러오는 중...`; when none exist: `첨부된 사진이 없습니다 — 텍스트 증거만 기록됐어요.`
- Read-only. Deleting the task or resetting the app removes the same keys.

## `ActivityLogModal`
One modal, two shapes keyed by `task.kind`. Title: `독후감 — {title}` / `운동 기록 — {title}`.

### `book` — reading
Five ⭐ buttons (`rating`), `한 줄 감상 (15자 이상)` textarea (placeholder `어떤 책이었고, 무엇이 남았는지`), and `기억에 남는 문장 (선택)`.
Errors: `별점을 선택해 주세요.` and `한 줄 감상을 15자 이상 적어 주세요.`
Evidence: `독후감 ★{rating} · {review, 60 chars}` plus ` · "{quote, 40 chars}"` when a quote was typed.

### `fit` — exercise
Lead line: `기록은 전부 선택입니다 — 측정한 날만 적으세요. 수치는 활성 목표의 같은 이름 수치 KR("체중"·"골격근량")에 자동 반영돼요.`
Fields: `오늘 운동 — 예: 하체 + 유산소 40분`, numeric `체중 kg` and `골격근량 kg` (`step 0.1`). Nothing is required, so the button reads `완료 (기록은 선택)`. Footer: `이후의 일일 완료는 원탭이에요. 측정 갱신은 목표 탭의 수치 KR 체크인으로 언제든 가능합니다.`
Evidence: `운동 기록 · {workout, 40 chars} · 체중 {w}kg · 골격근량 {m}kg` from whichever parts were filled, or `null` when nothing was.
Measurements go to `applyMeasures`, which writes each value through `checkinKR` into the first `metric` KR of an active goal whose title contains that label — the only place a measurement can land ([Rule 17](../design-docs/core-beliefs.md#rule-17), [Rule 8](../design-docs/core-beliefs.md#rule-8)).

## `StudyVerifyModal`
Title `학습 검증 — {source || title}`; `req = STUDY_REQ[task.diff] || STUDY_REQ.D`.

| diff | `sum` | `art` | `crit` | `label` |
|---|---|---|---|---|
| E | 30 | 0 | no | `요약·새 지식 기재` |
| D | 30 | 1 | no | `기재 + 산출물 1건` |
| C | 60 | 1 | no | `요약 강화(60자+) + 산출물 1건` |
| B | 100 | 2 | yes | `요약 강화(100자+) + 한계·비판 + 산출물 2건` |

Only E and D can be created today; C and B stay for legacy data ([Rule 18](../design-docs/core-beliefs.md#rule-18)).

- Badge `{diff}급 기준 — {req.label}`.
- `핵심 요약 ({req.sum}자 이상)` with a live counter `{n}/{sum}` (rose below the threshold, emerald at or above it), placeholder `이 자료의 핵심 주장·내용을 자기 말로`.
- `새로 알게 된 것 1가지`, placeholder `읽기 전엔 몰랐던 것`.
- B only: `한계·비판 1줄 (B급 필수)`, placeholder `이 자료의 한계, 또는 동의하지 않는 지점`.
- When `req.art > 0`: the output panel `산출물 {req.art}건 필수 — 현재 {artCount}건`, up to two photo thumbnails (✕ to remove), a `📎 사진` button (disabled at two) and a link textarea (`정리 링크 (블로그·노션·발표자료, 줄바꿈으로 여러 개)`). `artCount` = photos + link lines that start with `https`. Footer: `인정: 손필기·정리 사진, 블로그/노션 정리 글, 발표자료. 사진은 기기에, 링크는 기록에 원문 보존.`
- Validation order: summary → `요약을 {sum}자 이상으로 적어 주세요 ({diff}급 기준).`; insight under 10 chars → `'새로 알게 된 것'을 구체적으로 적어 주세요.`; critique under 15 chars when required → `B급은 한계·비판 1줄(15자 이상)이 필요해요.`; outputs → `{diff}급은 산출물 {art}건이 필요해요 — 정리 사진 또는 정리 링크. (현재 {n}건)`.
- Photos are written to `liferpg-img-study-{task.id}-{n}` (n = 1, 2). Evidence records the insight, the critique, the photo count and the first link, ending with ` · {diff}급 산출물 검증 통과`. **The summary body itself is never stored** — it is a comprehension gate, not a record.
- Button: `검증 제출하고 완료`.
