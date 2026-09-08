# E2E 하니스

앱 본체(`src/LifeManager.jsx`)를 실제 브라우저로 끝까지 돌려 검증한다. 브라우저는 시스템에 설치된 Chrome 또는 Edge를 그대로 쓴다(다운로드 없음).

## 실행

```bash
npm run build            # 프로젝트 루트에서 (커버리지까지 볼 거면 --sourcemap)
npx vite preview --port 4173
cd tools/e2e && npm i    # 최초 1회
node run.js --tag run    # 67단계 시나리오
node perf.js --tag run   # 성능 측정(4배 CPU 스로틀)
node cov_map.js out/run-coverage.json   # 미실행 원본 라인 매핑(--sourcemap 빌드 필요)
node prof.js             # CPU 프로파일 상위 함수
node ab.js <urlA> <urlB> 5        # 두 빌드 교차 A/B (단발 측정은 노이즈가 커서 비교 불가)
node rows.js <url> "시작하기"      # 온보딩 4단계 마운트 행 수·DOM 노드 수
```

- `--headful` 로 창을 띄워 눈으로 확인할 수 있다.
- 실패 시 `out/<tag>-NN-FAIL-<단계>.png` 스크린샷과 `out/<tag>-result.json` 이 남는다.

## 시나리오 구성

| 파일 | 범위 |
|---|---|
| `flow.js` | 온보딩 6단계(신규 저장 스키마 v14 단언 포함) → 목표(OKR) 3종 KR → KR 브리지 실행 등록 → 완료 → 도감 → 지표 체크인 → 새로고침 지속성 |
| `flow2.js` | 자격 마일스톤 합격증 제출(증거 게이트 차단 확인 포함) · 학습 산출물 검증 · 독서 활동 기록 · 승급 · 롤모델 |
| `flow3.js` | 프로필 사진 · 시험 KR·성적표 제출 · 운동/미팅 활동 · 방향 제안 · 실행·목표 삭제 · 하루 공백(스트릭·보호권) |
| `flow.js` 말미 | 데이터 초기화 — 상태·프로필 사진 키 삭제 확인(가장 마지막에 실행) |
| `flow4.js` | 완주용 목표 생성→100% 달성 처리→기록 제거 · 구버전(v10) 세이브 마이그레이션 · v 필드 없는 세이브 마이그레이션(스키마 v13·트로피 kind 변환 단언) |

검증은 클릭만 하지 않고 결과를 확인한다(`assertDone`으로 완료 표시 확인, 모달 범위 한정 클릭 `clickInModal`, 오류 문구 확인 `modalError`).
