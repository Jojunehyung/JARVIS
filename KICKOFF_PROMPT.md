# Claude Code 킥오프 — 첫 세션용

## 준비 (터미널에서, Claude Code 실행 전)

```bash
mkdir life-manager && cd life-manager
# 이 폴더에 life-rpg.jsx, PLANNING.md, CLAUDE.md 세 파일을 넣는다
claude
```

## 첫 메시지 (아래 전체를 복사해 붙여넣기)

---

PLANNING.md(제품 기획 — 하네스 엔지니어링 취업 시나리오)를 먼저 읽어 제품의 의도를 파악하고, CLAUDE.md(개발 규칙·불변 규칙 19개)를 정독해줘. 이 프로젝트는 단일 파일 React 앱(life-rpg.jsx)이고, 목표는 로컬에서 실행 가능한 Vite 프로젝트로 이관하는 거야. 아래 순서를 지켜서 진행해줘.

1. 현재 폴더에 Vite React 프로젝트를 스캐폴드하고(react 템플릿), Tailwind와 lucide-react를 설치해. Tailwind는 core utility 클래스만 쓰고 있으니 표준 설정이면 충분해.
2. life-rpg.jsx를 src/LifeRPG.jsx로 옮기고 main.jsx에서 렌더해. **이 단계에서 파일 분리는 하지 마** — 통으로 옮겨서 먼저 돌게 만드는 게 목표야.
3. CLAUDE.md §3-1의 스토리지 시밍을 구현해: `store`를 localStorage 어댑터로 교체 (인터페이스 유지, 호출부 수정 금지). AI 연동은 없다 — §3-2 참조.
4. `npm run dev`로 띄우고 CLAUDE.md §7-2 스모크 플로우를 직접 확인해: 데모 시작 → 퀘스트 탭(목표별 그룹·마일스톤 확인) → 목표의 ＋퀘스트에서 KR 원클릭 등록 확인 → 일일 퀘스트 완료(목표 진행 델타 토스트) → 전기기사 마일스톤 합격증 사진 제출(직무 적합 S ×1.0 · +900P 지급 확인) → 성장 탭 지표 체크인 → 새로고침 후 상태 유지.
5. 전부 통과하면 git 초기화하고 커밋해. 그 다음에만 파일 분리 리팩터 계획을 **제안만** 해줘 — 실행은 내 승인 후에.

주의: CLAUDE.md §5의 불변 규칙은 어떤 변경에서도 유지해야 하고, 특히 CERTS/EXAMS 수치 테이블은 절대 수정하지 마.

---

## 이후 세션에서 쓸 짧은 프롬프트 예시

- 파일 분리: "CLAUDE.md §7-3을 진행해줘. calcExamPayout, krProgress, migrate에 단위 테스트를 먼저 만들고, 테스트가 통과하는 상태를 유지하면서 data/engine/components로 분리해."
- 주간 리뷰: "CLAUDE.md §7-4 주간 리뷰 플로우를 기획부터 제안해줘. 지표 체크인(MetricsModal)을 확장하는 방향으로."
- 기능 추가 전 항상: "불변 규칙(§5)과 충돌하는지 먼저 확인하고 시작해."
