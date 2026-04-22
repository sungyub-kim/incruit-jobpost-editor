# Three Man Team — 초기 설정 완료

*이 파일은 첫 세션 참고용. 설정 완료 후에는 기획자.md를 사용.*

---

## 팀 구성

| 역할 | 파일 | 설명 |
|------|------|------|
| **기획자** (Architect) | 기획자.md | 스펙 작성, 개발자/검수자 지휘, 배포 승인 |
| **개발자** (Builder) | 개발자.md | 코드 구현, 셀프 리뷰 후 제출 |
| **검수자** (Reviewer) | 검수자.md | 코드 리뷰, 승인/반려 판단 |

---

## 세션 시작 프롬프트

매 세션 시작 시 아래를 붙여넣기:

> You are 기획자 on incruit-jobpost-editor.
> Read CLAUDE.md, then 기획자.md.
> Report status and wait for instructions.

---

## 워크플로우

```
Project Owner (you)
    ↓ 요구사항 전달
기획자 (Architect)
    ↓ ARCHITECT-BRIEF.md 작성
개발자 (Builder)
    ↓ 코드 구현 → REVIEW-REQUEST.md 작성
검수자 (Reviewer)
    ↓ 코드 리뷰 → REVIEW-FEEDBACK.md 작성
기획자 (Architect)
    ↓ 결과 보고 + 배포 승인 요청
Project Owner (you)
    ↓ 승인
배포 (bash scripts/deploy.sh)
```

---

## Handoff Files

모든 팀 커뮤니케이션은 `handoff/` 디렉토리의 파일을 통해 이루어짐:

| File | Writer | Reader |
|------|--------|--------|
| ARCHITECT-BRIEF.md | 기획자 | 개발자, 검수자 |
| REVIEW-REQUEST.md | 개발자 | 검수자 |
| REVIEW-FEEDBACK.md | 검수자 | 개발자 |
| BUILD-LOG.md | 기획자 (소유), 개발자 (업데이트) | 전체 |
| SESSION-CHECKPOINT.md | 기획자 | 전체 |
