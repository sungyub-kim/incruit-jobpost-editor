# 🚀 배포담당자 (Deployer) 가이드

검수자의 최종 승인을 받은 코드를 프로덕션 배포하는 역할입니다.

---

## 배포 체크리스트

### 1️⃣ 배포 전 상태 확인

```bash
git status          # 커밋되지 않은 변경 확인
git log -1 --oneline  # 최신 커밋 확인 (검수자 완료 커밋)
```

**체크:**
- [ ] 모든 파일이 커밋된 상태 (working tree clean)
- [ ] 최신 커밋이 검수자 최종 승인 커밋

---

### 2️⃣ 버전 결정

현재 버전을 확인하고 증가 규칙을 따릅니다.

```bash
grep "ver-badge" fair-builder.html | head -1  # 현재 버전 확인
```

**버전 증가 규칙:**

| 상황 | 규칙 | 예시 |
|------|------|------|
| Phase/Step 단위 완료 (큰 기능) | `0.X.0` | v0.15.0 → v0.16.0 |
| 개별 기능 추가 | `0.X.Y` | v0.15.3 → v0.15.4 |
| 버그 핫픽스 | `0.X.Y+1` | v0.15.3 → v0.15.3+1 |

**이번 배포 버전:**
- 현재: `v0.15.3`
- 대상: `v0.15.4` ← 개별 기능 추가 (포맷팅 지속성)

---

### 3️⃣ 패치노트 작성

이전 커밋의 `git commit timestamp`를 기준으로 합니다.

```bash
git log --format="%ai %s" -1
# 예: 2026-04-24 13:14:05 +0900 Step 1 Fix: ...
```

**패치노트 위치:** `fair-builder.html` 내 `PATCH_NOTES` 배열 맨 위

**형식:**
```javascript
{
  date: '2026.04.24 13:14 (v0.15.4)',  // YYYY.MM.DD HH:MM (vX.Y.Z)
  items: [
    '<strong>[v0.15.4]</strong> 주요 변경사항 요약',
    '<strong>[v0.15.4]</strong> 세부 구현 1',
    '<strong>[v0.15.4]</strong> 세부 구현 2',
  ]
}
```

**주의:**
- 시간은 `git log` 타임스탐프 기준 (개발자 기억 금지)
- `YYYY.MM.DD` (마침표 구분), `HH:MM` (24시간제)
- `<strong>[vX.Y.Z]</strong>` 태그 반드시 포함
- PATCH_NOTES 배열 맨 위에 추가

---

### 4️⃣ 버전 배지 + 패치노트 커밋

fair-builder.html 수정:
1. `ver-badge` 값 변경: `v0.15.3` → `v0.15.4`
2. PATCH_NOTES 배열 맨 위에 새 버전 항목 추가

**커밋 메시지 형식:**
```
chore: 버전 업데이트 v0.15.3 → v0.15.4 + 패치노트

[변경사항 한줄 요약]

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

**명령어:**
```bash
git add fair-builder.html
git commit -m "chore: 버전 업데이트 v0.15.3 → v0.15.4 + 패치노트

[요약]

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### 5️⃣ 푸시 및 배포

```bash
git push origin main
# 또는 특정 브랜치: git push origin feature-branch:main
```

**배포 확인:**
- [ ] Push 성공 (에러 없음)
- [ ] `git status` → "up to date with 'origin/main'"

---

### 6️⃣ 배포 결과 확인 (1~2분 후)

**GitHub Pages URL:**
```
https://sungyub-kim.github.io/incruit-jobpost-editor/fair-builder.html
```

**확인 항목:**
1. **브라우저 캐시 초기화:**
   ```
   Ctrl+Shift+R (또는 Cmd+Shift+R)
   ```

2. **버전 배지 확인:**
   - 좌상단 버전 뱃지가 `v0.15.4`로 변경되었나?
   - ✅ 변경됨 = 배포 완료
   - ❌ 여전히 v0.15.3 = 배포 지연 (5분 더 대기)

3. **패치노트 확인:**
   - 우상단 "패치노트" 버튼 클릭
   - 맨 위에 `v0.15.4` 항목 표시되나?

4. **기능 테스트 (선택):**
   - 해당 버전에서 수정된 기능이 정상 동작하는가?

---

## 배포 실패 대응

### 버전 배지가 업데이트 안 됨

**원인 1: 캐시**
```
Ctrl+Shift+R → 1~2분 더 대기
```

**원인 2: GitHub Pages 지연**
```
1~2분 추가 대기 후 재확인
(드물게 최대 5분)
```

**원인 3: Push 실패**
```bash
git status  # origin/main과 비교
git log --oneline -3  # 최신 커밋 확인
```

### 패치노트가 보이지 않음

**HTML 문법 오류 확인:**
```bash
# 브라우저 개발자도구 콘솔 (F12)에서 JavaScript 에러 확인
# 또는 fair-builder.html의 PATCH_NOTES 배열 구문 검증
```

---

## 규칙 (반드시 준수)

| 규칙 | 이유 |
|------|------|
| **버전 + 패치노트 한 커밋** | 버전만 올리고 패치노트 누락 방지 |
| **git 타임스탐프 사용** | 배포 시각 일관성 보장 |
| **배포 전 status 확인** | 실수로 대기 중인 변경사항 커밋 방지 |
| **Ctrl+Shift+R 강조** | 사용자 캐시로 인한 "배포 안 됨" 리포트 감소 |

---

## 배포 후 (선택사항)

```bash
# Slack/이메일 알림
# 예: "v0.15.4 배포 완료 (포맷팅 지속성 고정)"
```

---

## 참고 자료

- [CLAUDE.md](./CLAUDE.md) — 프로젝트 전체 규칙
- [.claude/rules/version-badge-sync.md](./.claude/rules/version-badge-sync.md) — 버전 배지 규칙
- [.claude/rules/deploy-check.md](./.claude/rules/deploy-check.md) — 배포 확인 절차
