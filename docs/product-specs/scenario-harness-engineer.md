# Reference scenario — landing a wiring-harness design engineer job
<!-- src: PL --><!-- src: SPEC-2 -->

The demo data (`demoState`) reproduces this scenario; the numbers below are the ones the code computes (checked by `npm run smoke`). Korean strings are the actual UI copy.

## Persona
Engineering graduate (기계·전자 전공), job-seeking status, target role: wiring-harness design engineer at a tier-1 automotive supplier. Areas created at onboarding: 사업 (grade 2), 직업·커리어 (grade 3, directions `[전기·기계]`), 기본지식 (grade 2, `[IT·개발, 재테크·금융]`), 건강 (grade 1).

## Walk-through
1. **Onboarding** — the six steps compute starting grades from the selected options ("선택지 조합으로 자동 산정된 시작점이에요. 이후 승급은 오직 관문 통과로만 가능합니다."). The 직업·커리어 area gets the job direction **전기·기계**.
2. **Goal** — "하네스 설계 엔지니어 취업" (D-150) with KRs: ① `cert` 전기기사 취득, ② `count` CATIA·도면 연습 30회. A second goal "서류 어학 컷 넘기기" carries an `exam` KR TOEIC 800.
3. **KR bridge** — from the goal, "＋ 실행 연결" opens `AddTaskModal`; the cert KR row reads "📜 전기기사 — 자격 마일스톤 · +900P · 등록 ›". 전기기사 is D67 (grade B), base P = certP(67) = 900; the area's job 전기·기계 rates category 전기·기계·설비 as **S ×1.0**, so actual P = **900 P**. Had the same certificate been registered under a 마케팅 area it would be C ×0 = 0 P ([Rule 15](../design-docs/core-beliefs.md#rule-15)). The count KR row "채우기 ›" prefills a daily task (difficulty E by default).
4. **Daily loop** — completing a CATIA practice task shows the delta toast "완료 · 🎯 하네스 설계 엔지니어 취업 3→5%" and advances the streak 🔥. Completing a fitness task with weight entered updates the same-named metric KR of the 건강 goal ([Rule 17](../design-docs/core-beliefs.md#rule-17)).
5. **Milestone** — passing 전기기사: submit the certificate photo (mandatory, [Rule 16](../design-docs/core-beliefs.md#rule-16)) → ACHIEVEMENT overlay "전기기사 · D67 · +900P · 직무 적합 S · 전기·기계 기준 ×1", trophy on the achievement wall, the cert KR auto-completes, and the goal delta shows (from the demo's initial state 3 % → 55 %; after the daily completion in step 4 it reads 5 % → 57 %, i.e. (1 + 4/30) / 2).
6. **Promotion** — the 직업·커리어 area passes the 실무자 → 숙련자 gate by submitting evidence chips; the RANK UP overlay shows the area name and the new rank, with no percentage of any kind since the [Rule 14](../design-docs/core-beliefs.md#rule-14) amendment of 2026-09-18.
7. **Weekly review** — on the review modal, this week's wins and blocks are recorded; if pace is behind, the rose text says so first.

## Known deviations recorded, not fixed
- The original planning text said "12→15 %" for the daily delta; the code computes 3→5 % from the demo state. Kept as computed.
- Passing a certificate does not change the role model's requirement-gap facts (`roleAreas`) by itself — they depend only on area grades, which change at promotion (step 6); there is no proximity figure to recompute since the [Rule 14](../design-docs/core-beliefs.md#rule-14) amendment of 2026-09-18. Recorded in the tech-debt tracker as a spec clarification.
- In the demo the cert KR one-click button shows "등록됨" (already registered); delete the existing milestone to exercise the one-click path.
