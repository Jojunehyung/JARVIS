# 인생 관리 (Life Manager) — Claude Code 개발 가이드

> 이 문서는 프로젝트의 단일 진실 원천이다. 코드를 수정하기 전에 반드시 전체를 읽을 것.

## 1. 컨셉 (v3 미니멀)

**목표를 세우고(OKR) → 실행하고(실행) → 증거로 증명하고(등급·성취) → 매일 이어가는(스트릭) 인생 관리 도구.**

게임 연출(XP·레벨·골드·크리티컬·보스·스토리·미연시)은 사용자 결정으로 **완전 폐기**되었다 — 백업 없음. 재도입 요청이 오면 그때 처음부터 다시 설계한다.

핵심 루프: 목표(OKR) 생성 → KR 브리지로 마일스톤·일일 실행 등록 → 증거 완료 → 등급 승급·인생 지표·롤모델 근접도 상승.

제품 기획 전문은 `PLANNING.md` 참조 — 하네스 설계 엔지니어 취업 시나리오로 전 시스템을 관통 설명하며, 데모 데이터가 그 시나리오와 일치한다.

## 2. 현재 상태

- Vite React 로컬 앱 (2026-09-03 스캐폴드) — 앱 본체는 `src/LifeManager.jsx` 단일 파일 (상태 스키마 **v14**), `npm run dev` / `npm run build`(통과 확인 2026-09-07)
- E2E 하니스: `tools/e2e`(설치된 Chrome/Edge를 puppeteer-core로 구동, 68단계 시나리오 + 커버리지·성능 측정). 변경 후 `node run.js`로 회귀 확인 — 클릭만 하지 않고 완료 표시까지 검증한다. 성능 비교는 `ab.js`처럼 두 빌드를 한 프로세스에서 **교차 측정**할 것(단발 측정은 머신 부하로 ±50%까지 흔들린다)
- 자격 DB는 **V1.3(2026-09-06)**: 현행 전체 국가자격 1,011종(신규 807종 · 카테고리 15 · 직무 21 · 단계군 80). 확장·검증 산출물은 스크래치패드(`calib_merged.json` 등)에 보존
- 스타일: Tailwind **v3** core utility 클래스만 사용 (임의값 문법 없음 — `bg-opacity-*` 사용 중이라 v4 업그레이드 금지) / 아이콘: `lucide-react`
- 2026-09-02 디자인 핸드오프 적용됨: PortraitSprite v3·TrophySvg v2·빈 상태 일러스트 5종(`EmptyGoalSvg` `EmptyQuestSvg` `EmptyWallSvg` `WallFrame` `OnboardingHeroSvg`)·전 화면 스타일 델타. 온보딩 타이틀 카피는 사용자 선택으로 "지금 위치를 숫자로 확인하세요. 평가는 시장 기준입니다." 채택(게임 카피 폐기)
- 데모 배포 파일: `npm run build:demo` → `release/life-demo.html` (JS·CSS 전부 내장한 단일 HTML, IIFE 클래식 스크립트를 `</body>` 직전에 배치 — file:// 로 폰·PC에서 직접 열림, localStorage 유지 확인 2026-09-03). 설정은 `vite.demo.config.js`, `release/`는 gitignore. iOS는 파일 직접 열기로 JS 실행 불가 → 호스팅 링크 필요
- 아직 실기기 스모크 테스트 전 — 반드시 수행 (§7 백로그 2번)

## 3. 플랫폼 시밍 (아티팩트 전용 API 교체)

### 3-1. `window.storage` → 스토리지 어댑터 — ✅ 완료 (2026-09-03)
- 위치: `const store =` 검색. 인터페이스: `store.get(key)` / `store.set(key, value)` / `store.del(key)` (JSON 직렬화 내장, 실패 시 메모리 폴백).
- 교체: 동일 인터페이스의 localStorage 어댑터. **호출부는 절대 수정하지 말 것.**
- 메인 상태 키: `KEY` 상수. 프로필 사진은 `liferpg-img-profile` 별도 키.

### 3-2. AI 미사용 (사용자 결정 2026-08-29)
`askClaude`와 모든 AI 기능(목표 코치, 난이도 판정, 승급 지식 체크, 학습 구술검증)이 코드에서 **완전히 제거**되었다. 시밍 대상은 §3-1 스토리지뿐이다. 커스텀 자격 난이도는 수동 D 입력(20~100), 학습 실행은 임시 "자기 기재" 모드다. AI 재도입은 사용자 명시 승인 없이는 금지.

## 4. 아키텍처 맵 (검색 앵커)

| 영역 | 심볼 |
|---|---|
| 유틸/저장 | `uid` `dstr` `shiftDay` `monthStr` `store` `KEY` `askClaude` |
| 조회 인덱스 | `CERT_BY_NAME` `CERTS_LONGEST_FIRST` `CERT_NAME_LC` `EXAM_BY_ID` `certOf` `examOf` `certByTitle`(제목별 캐시) — 1,011종 테이블을 렌더마다 순회하지 않도록 모듈 로드 시 1회 구성 |
| 성취 상수·계산 | `DIFF_RAW_VERSION` `POINT_POLICY_VERSION` `certP` `achGrade` `legacyCertGrade` `CERTS`(1011종 — 15 카테고리. V1.2 보건·의료 30종, V1.3 전체 국가자격 807종 추가) `EXAMS`(17패밀리) `calcExamPayout` `DIM_STEPS` `LANG_KO` `EVIDENCE_MIN` |
| 온보딩 상수 | `AREA_PRESETS` `AGE_OPTS`~`OUTPUT_OPTS` `gFromD` `computeGrades` `GATE_CHIPS` |
| v3 엔진 | `needsEvidence` `METRICS_META` `ddayStr` `krProgress` `krDoneCount` `goalProgress` `elapsedRatio` `paceOf` `krRemainText` `roleGap` `certGainOf` `examBandGain` `areaCatHints` `JOB_FIELDS` `WEIGHT_MATRIX` `CERT_W_EXC` `TIER_MULT` `jobWeightForCert` `certByTitle` `goalKinds` |
| 상태 수명 | `migrate`(v11 단발 변환) `applyDailyTick`(보호권 월 리셋만) `freshState` `demoState` |
| 일러스트 | `PortraitSprite`(useId 그라디언트·듀얼 림라이트) `Portrait` `resizeImage` `TrophySvg` |
| App 핸들러 | `completeTask` `promoteArea` `addGoal` `goalStatus` `checkinKR` `coachApply` `saveMetrics` `setAreaDir` `spawnTask` `applyMeasures` `tryComplete` |
| UI | `HomeTab` `GoalsTab` `AddGoalModal` `MetricsModal` `CatalogModal` `RoleAdviceModal` `StudyVerifyModal` `ActivityLogModal` `TaskTab` `AddTaskModal` `EvidenceModal` `GrowthTab` `PromoteModal` `RoleModelModal` `EvidenceViewModal` `ToastHost` `Onboarding` `Overlay`(gradeup/achieve) `Shell` `Modal` |

## 5. 디자인 불변 규칙 (어떤 리팩터에서도 유지)

**[성취 시스템 — 절대 유지]**
1. 성취(자격/시험) 지급은 **순수 지급**: 배율·보너스·상한 종류를 불문하고 적용하지 않는다.
2. **시험**: "시험×점수 밴드" 스냅샷. 같은 시험 상향은 차액만(`exams.best`). 같은 언어의 스킬버킷(RL/S/W) 중복은 100→70→50→30% 감쇠하며 배율은 **첫 등록 시 고정**(`exams.dim`). 같은 언어 D75+ 서로 다른 시험 2종 = 전문화(`exams.spec`, 감쇠 하한 70%, 어학 영역 전문가 인정).
3. **자격증**: 항상 전액. 단 stage_group(`cph/acc/tax/lnx/kh/fp/cfa/cissp/cisa/pmp`)만 차액(`certBest`).
4. **스냅샷 소급 금지**: D/P 테이블이 갱신돼도 기지급분은 불변(성취 기록에 `ver`).
5. 등급 문자 컷 통일: A 82+ / B 65+ / C 50+ / D 35+ / E (`achGrade`).
6. `CERTS`/`EXAMS` 수치 테이블은 기획 확정본이다 — 임의 수정 금지. V1.3(2026-09-06)에서 현행 전체 국가자격 807종을 추가했고(총 1011종, 3렌즈 산정 + 적대적 검증), 기존 D값은 그대로다. 종목 개칭은 D를 바꾸지 않고 이름만 갱신하며, 시행일이 도래하지 않은 개칭·신설은 반영하지 않는다.

**[v3 미니멀 정체성]**
7. XP·레벨·골드·상점·크리티컬·랜덤 보상·보스 연출·스토리·미연시를 **재도입하지 않는다**.
8. 인생 지표(`metrics.asset/infl/body`)는 성취·승급·목표 달성 시 자동 반영(`metricsGain`, D/10 기반) + 체크인 수동 보정만. 방치형(시간 경과) 성장 금지. `body`(외형 — 운동·식단·관리)는 자기평가 전용 — 자동 소스를 만들지 말 것. 객관 측정이 필요하면 목표의 metric형 KR(체지방률 등)을 쓴다.
9. 목표 진행률은 **파생 계산**(`krProgress`/`goalProgress`) — 진행률을 상태에 중복 저장하지 말 것. count형 KR은 `tasks[].goalId`에서 파생.
10. 증거 게이트: `needsEvidence`(자격·시험·pts≥150)는 증거 없이 완료 불가.
11. 승급은 관문으로만: 증거 제출(`PromoteModal`). 지식 체크(QuizModal)는 기획에만 있고 구현된 적이 없어 문구에서 제거했다(2026-09-07 확인) — 도입하려면 새 결정이 필요하다.
12. 마이그레이션은 버전 증가 + 순차 블록. v11은 구(≤10) 세이브를 방어적으로 단발 변환하고, v12는 `metrics.risk`(위험도)를 `metrics.body`(외형)로 전환하며(의미가 반전되므로 값은 기준 15로 재설정), v13은 트로피 `kind: "boss"`(구 보스 연출 잔재)를 `"ach"`로 변환하고, v14는 게임 용어 개명에 맞춰 `quests`→`tasks`·`parts`→`areas`·`partId`→`areaId`로 필드를 옮긴다(값·의미 동일). 진입부에서 `v`가 숫자가 아니면 0으로 정규화해 구세이브가 블록을 건너뛰지 않게 한다. **저장 키(`liferpg-*`)는 데이터 호환을 위해 그대로 둔다.** 기존 변환 로직 수정 금지, 새 버전 블록 추가만.
13. **톤 규칙 — 현실·객관**: 모든 UI 카피·연출·AI 프롬프트에서 격려·낙관·희망 문구 금지, 수치와 사실만 쓴다. 페이스(시간 경과 대비 진행, `paceOf`)와 "목표 기여 없음"을 숨기거나 완곡화하지 않는다. 완료·체크인·코치 적용 등 상태가 변할 때마다 관련 목표의 진행률 변화(from→to)를 즉시 표시한다.
14. 롤모델 근접도(`roleGap`)는 **제곱 곡선** `mean((have/need)²)` — 요구 바로 아래 단계가 약 70%가 되도록 설계된 값이다. 선형으로 완화하지 말 것.
15. **직무 가중 체계(자격 한정)**: 자격 실지급 P = (기본 P − 단계 차액분) × 직무 적합 배율. 배율은 `WEIGHT_MATRIX`(직무 16 × 자격 카테고리 10, S/A/B = 1.0/0.8/0.5, C(무관) = 0 — 무관 자격은 시장에서 평가되지 않으므로 지급하지 않는다(사용자 확정 2026-08-29, 리서치 초기 제안 0.25에서 강화). 개발·데이터 행의 사무·회계/전문직은 C로 강등, 변리사(IT 특허)·사회조사분석사 2급(데이터·AI, 조사방법론 인접)만 예외 B) + `CERT_W_EXC`(개별 예외: 개발·데이터 직무의 컴활 = C, 영업의 지게차 = A)로 결정, 등록 영역 `dir` 기준 — 복수 지정 시 **교집합(최저 등급)** 적용: 지정한 모든 직무에서 통해야 만점이며, 최저 등급을 준 직무를 근거로 표기한다. 온보딩 지식 방향은 `DIR_ALIAS`로 매트릭스 직무에 매핑. 근거는 2026-08 시장 리서치(HRD코리아 공고 활용도 통계, 고용부 500대 기업 조사, 직무별 합격스펙·인사담당자 설문 — 매트릭스 셀별 근거강도 강/중/약 구분 있음). 직무 미지정 영역은 ×1.0(판단 근거 없음). 시험(어학)은 기존 스킬버킷 감쇠 체계를 유지하며 직무 가중을 이중 적용하지 않는다. 보건·의료 행(2026-09-04 추가)은 보건·의료 카테고리 S 1셀만 기재 — 면허는 법적 필수 요건이라 근거 [강], 나머지 셀은 근거 없음 → C. 매트릭스·예외를 새 근거 없이 임의 수정하지 말 것. V1.3에서 카테고리 15·직무 21로 확장하며 신설 교차 셀 150개를 명시율 기준(S≥30%/A≥15%/B≥5%)으로 검증한 결과 **전량 C**이며(신설 직무의 자기 카테고리 S만 인정), 법령 명문·공고 명시가 확인된 개별 종목 47개만 `CERT_W_EXC`에 있다 — 카테고리 전반에 해당하는 판단은 예외가 아니라 매트릭스 사안이므로 예외로 우회하지 말 것. `certByTitle`은 최장 이름 우선 매칭(의사⊂치과의사, 약사⊂한약사 등 오매칭 방지) — 부분일치 순서 의존으로 되돌리지 말 것.
16. **증거 규정**: 자격·시험 실행은 합격증/성적표 **사진 첨부 필수** — 텍스트 증거만으로는 완료 불가. 이미지는 `liferpg-img-ev-{taskId}` 키에 저장(완료 행의 "증거 보기" → `EvidenceViewModal`로 열람 가능. 실행 삭제·전체 초기화 시 해당 이미지 키도 함께 삭제)(파일 분리 시 이 키 규약 유지). 학습 실행(`isStudy`)는 **등급별 산출물 검증**(확정 2026-08-29, `STUDY_REQ`): E = 요약 30자+·새 지식 기재 / D = 기재 + 산출물 1건 / C = 요약 60자+ + 산출물 1건 / B = 요약 100자+ · 한계·비판 1줄 + 산출물 2건. 산출물 = 손필기·정리 사진(`liferpg-img-study-{questId}-{n}`) 또는 정리 링크(evidence에 원문 보존). 신규 학습 실행은 하루분량 원칙(규칙 18)에 따라 **E·D만 생성 가능** — C·B 정의는 레거시 데이터용으로만 유지. 등급 기준·사진 필수 조건 완화 금지.
17. **일상 활동 유형**(`task.kind`: book/fit/meet, `ActivityLogModal`): 독서 = 독후감(별점 + 감상 15자+) 필수 / 미팅 = 회의록(상대·안건 필수, 액션 아이템은 `spawnTask`로 팔로업 실행 전환) 필수 / 운동 = 첫 완료 시 기록 선택, 이후 원탭. 운동 측정값(체중·골격근량)은 활성 목표의 **같은 이름 metric KR에 `checkinKR`로만 반영**한다 — 외형 지표 직접 반영 금지(규칙 8 유지). 활동 기록은 영역 성취 로그에 남고 트로피·지표는 지급하지 않는다. 실행 템플릿은 유형·난이도·주기를 함께 적용하고, 제목-유형 불일치(`detectKind`)는 등록을 차단하며, 유형 실행의 **난이도 상한은 C**(pts<150 — 증거 게이트 우회 방지)다.
18. **목표-우선 구조**(확정 2026-08-30): 실행은 목표에서만 생성한다 — `goalId` 필수, 영역은 목표에서 상속(실행 모달에 영역 선택 없음). 모든 실행은 **하루분량**: 일반·활동 상한 C, 학습은 E·D만. 자격·시험·학습은 "마일스톤"으로 하루분량 예외이며 실행 탭에서 목표 하위에 구분 표시된다. 목표 미연결 레거시 실행은 "미분류" 섹션에서 완료·삭제만 가능. 자유 실행 생성으로 되돌리지 말 것.
19. **KR-실행 브리지**(확정 2026-08-30): 자격·시험 마일스톤 실행은 목표의 해당 KR에서 **원클릭 등록으로만** 생성한다 — 실행 모달의 자격·시험 자유 탐색 모드는 제거됨(모드는 [일일 실행 · 학습] 둘뿐이며, 템플릿·활동 유형·학습 모드 노출은 `goalKinds`(목표 제목·메모·KR 추론)로 **목표 관련 항목만** 스코프 — 무관 유형은 화면에 나타나지 않음). exam KR → 시험 마일스톤(달성/등록됨 상태 표시), cert KR → 자격 마일스톤(직무 적합·실지급 P 표기), count KR → 일일 실행 프리필, metric KR → 체크인 전용 안내. cert KR의 수동 "취득 완료" 버튼은 제거 — 완료 경로는 마일스톤 실행의 합격증 제출뿐이다.

## 6. 상태 스키마 (v14)

```js
{
  v: 14,
  profile: { nick, gender, age, status, edu, majorField, directions[], look{skin,hair,hairColor,outfit,face}, startDate, roleModel? },
  areas: [{ id, name, grade(0~9), dir?, achievements[{id,text,date,grade}] }],
  tasks: [{ id, title, areaId, goalId(신규 필수 — 레거시만 미연결), diff(E~A), pts?, type("daily"|"once"), status, doneDates[], doneAt?, evidence?,
             isCert?, certD?, sg?, isExam?, famId?, band{label,d,p,conf}, isStudy?, source?, scope?, kind?("book"|"fit"|"meet"), createdAt }],
  goals: [{ id, title, areaId, deadline?, note?, status("active"|"done"), createdAt,
            krs: [{ id, type:"metric", title, start, target, current, unit }
                | { id, type:"count",  title, need }
                | { id, type:"exam",   title, famId, band{label,d,p,conf} }
                | { id, type:"cert",   title, certName, done? }] }],
  act: { streak, lastActive, shieldMonth, shieldsLeft },      // 보호권: 월 2개, 하루 공백 자동 소모
  metrics: { asset, infl, body },                              // 0~100 · body=외형(운동·관리, 자기평가)
  exams: { best{famId:{label,d,p,ver,date}}, dim{famId:mult}, spec{lang:true}, policy },
  certBest: { sg: { p, name, d } },
  room: { trophies[{id,kind:"ach"|"rank"|"spec",label,tier?,date}] },
  role: { name, targets{areaId: 요구등급(1~8)} } | null,   // 근접도는 roleGap으로 파생
  lastTick, dModel
}
```

## 7. 백로그 (우선순위 순)

1. ~~스토리지 시밍(§3-1) → `npm run dev` 구동~~ — ✅ 완료 (2026-09-03, Vite 베이스 스캐폴드·Node LTS 설치 포함)
2. **실기기 스모크**: 데모 파일을 폰에서 직접 열어 확인(자동 E2E는 `tools/e2e`로 데스크톱 Chrome에서 60단계 통과 — 2026-09-07). 데모 시작 → 실행 탭(목표별 그룹·마일스톤) → 목표 ＋실행에서 KR 원클릭 등록 → 일일 완료(목표 델타 토스트) → 전기기사 마일스톤 합격증 사진 제출(직무 S ×1.0 · **+900P** 확인) → 지표 체크인 → 새로고침 유지
3. 파일 분리 리팩터: `src/data`(CERTS/EXAMS/온보딩 상수) · `src/engine`(성취 계산·goal 계산·migrate) · `src/components` — `calcExamPayout`/`krProgress`/`migrate` 단위 테스트와 함께
4. 주간 리뷰 플로우: 지표 체크인을 "잘된 점/막힌 점" 회고와 묶은 주간 단위 화면으로 확장
5. 성장 그래프(지표·등급 히스토리 — 히스토리 저장 구조 신설 필요), 온보딩 마지막에 "첫 목표" 단계
6. 성취 v2: unified rescaling(기획 문서 §41 앵커 캘리브레이션), GRE 컴포짓, HSK 3.0 별도 버전
7. PWA 패키징(모바일 홈 화면) — 파비콘·매니페스트 아이콘(`public/icon.svg` + index.html 데이터 URI)은 2026-09-07 적용(콘솔 404 해소, 단일 파일 데모에도 포함). iOS apple-touch-icon PNG·서비스워커가 남음
8. **직무 가중 v3(신설 카테고리 근거 보강)**: V1.3에서 신설 카테고리 5 × 기존 직무 16, 신설 직무 5 × 기존 카테고리 14의 교차 셀 150개는 채용공고 명시율 근거 부족으로 전량 C다. 실제로는 인접 직무(예: 전기·기계 × 금속재료·비파괴, 화학·소재 × 산업안전)에서 평가될 여지가 있으므로, 직무별 공고 표본(직종 코드 필터 100건+)으로 명시율을 집계해 재판정한다. 개별 예외 47종목은 근거강도와 함께 코드 주석에 있다.
9. 종목 개편 추적: 시행 예정분 반영 대기 — 임업종묘기사→산림종묘기사(2027-01-01), 기상기사→기상기후기사·어로산업기사→어업산업기사·건축구조기사·피부미용장·로봇시스템통합기사/기능사(2028-01-01). 매년 Q-Net 변경사항 공고와 대조.
10. 직무 가중 v2: 목표 기업유형(공기업/사기업/스타트업) 토글로 예외 재계산(컴활·정보처리기사·한국사의 공기업 가점 축), 어학 직무별 통과선 모듈(해외영업 토익 800+/OPIc IH+ 등), 6개월 주기 채용공고 명시율 재검증(S≥30%/A≥15%/B≥5% 기준)

## 8. 컨벤션

- **용어(2026-09-07 전면 개명)**: 실행(task) · 영역(area) · 인생 관리. 게임 용어였던 퀘스트·파트·상태창·실드는 코드 식별자·UI 문구·문서에서 모두 대체했다. 유지한 것: 등급·성취·마일스톤·스트릭·트로피(제품 개념), 저장 키 `liferpg-*`(데이터 호환), 마이그레이션 블록 내부의 구필드 이름(구세이브 해석용).

- UI 텍스트는 한국어(해요체), 코드 식별자는 영문.
- 상태 변경은 `setState(prev => { const s = structuredClone(prev); ...; return s; })` 패턴.
- 연출·토스트는 `queueMicrotask`(+필요시 `setTimeout`) 체인 관행. 연출은 gradeup/achieve 2종뿐 — 새 오버레이 추가는 신중히.
- 새 기능은 `demoState`에 시연 데이터를 함께 갱신.
- 검증: `vite build` + §7-2 스모크 플로우.
