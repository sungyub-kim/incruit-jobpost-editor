# 🔍 검수담당자 (Reviewer) 가이드

개발자의 구현을 검수하고, **모든 요청/결정사항을 메모리에 기록**하는 역할입니다.

> **핵심:** 검수 완료 시점에 **메모리 업데이트**를 반드시 수행합니다.

---

## 검수 프로세스

### 1️⃣ 개발자 작업 검토

```
개발자 완료 → 내용 확인 → 테스트 → 최종 검수
```

**체크리스트:**
- [ ] 코드가 요청사항을 모두 충족하는가?
- [ ] 예상치 못한 부작용은 없는가?
- [ ] PC/모바일/태블릿 환경에서 모두 정상 작동하는가?
- [ ] 기존 기능이 깨지지 않았는가?

---

### 2️⃣ 메모리 업데이트 (⭐ 가장 중요)

**검수 완료 직후 반드시 수행합니다.**

메모리 파일 위치:
```
~/.claude/projects/c--SOURCE-IMG-claude/memory/
```

#### **A) 프로젝트 진행상황 업데이트**
`project_fair_builder.md` 수정:

```markdown
## 메인 비주얼(section_visual) 개선 진행상황
### 완료 ✅
- **Step 1** (v0.15.4): [변경 내용]
  - 포맷팅 지속성 고정 (pcHtml/mHtml 필드)
  - blur 핸들러로 자동 저장
```

**업데이트 항목:**
- 완료된 Step 정보
- 각 Step의 주요 기능 및 파일 위치
- 남은 작업 목록
- 발견된 버그/개선사항

#### **B) 버그 및 변경사항 기록**
`project_fair_builder.md`의 "버그/개선 사항" 섹션:

```markdown
## 버그/개선 사항
- [x] ~~포맷팅 변경 시 새로고침 후 날라짐~~ → 고정됨 (v0.15.4)
- [ ] 편집 드로어 이미지 미리보기: 아직 미해결
- [ ] [새로 발견한 버그/개선사항]
```

#### **C) 기술적 결정사항 기록** (필요시)
새 메모리 파일 생성:

```
technical_decisions_[날짜].md
```

예시:
```markdown
---
name: 포맷팅 지속성 구현
description: Step 1에서 폰트/굵기 변경 후 새로고침 후에도 유지되도록 구현
type: project
---

## 결정사항
- pcHtml/mHtml 필드로 형식화 HTML 저장
- blur 이벤트 핸들러로 자동 캡처
- 좌측 패널 편집 시 HTML 초기화

## 구현 파일
- fair-builder.html:
  - Line 598-612: sectionData 구조 확장
  - Line 1708-1756: renderVisualTexts() 개선
  - Line 3099-3114: onEditableBlur() 활용
```

---

## 메모리 작성 규칙

### 상황별 작성 예시

#### 1️⃣ 새 기능 완료
```markdown
- **Step 3** (v0.15.3): 요소 여백 설정 ✅ 완료
  - margin/padding 상하좌우 독립 설정
  - updateVisualElementSpacing: 함수로 값 업데이트
  - 편집 패널에 margin/padding 섹션 추가
```

#### 2️⃣ 버그 발견 및 해결
```markdown
## 버그/개선 사항
- [ ] 포맷팅 변경 후 새로고침 시 날라짐
  - 원인: sectionData가 plain text만 저장 (HTML 미저장)
  - 해결 방안: pcHtml/mHtml 필드로 형식화 HTML 저장
  - 우선순위: 높음 (사용자 경험에 영향)
```

#### 3️⃣ 다음 단계 계획
```markdown
### 진행 중 (다음 순서)
- **Step 4**: AOS 애니메이션 (효과/딜레이/속도)
  - 예상 구현 시간: 2시간
  - 관련 파일: fair-builder.html (renderVisualTexts)
```

---

## 검수-메모리 연동 체크리스트

검수 완료 후:

- [ ] `project_fair_builder.md` 업데이트 완료?
- [ ] 완료된 기능을 "완료 ✅" 섹션으로 이동?
- [ ] 새로 발견된 버그를 "버그/개선 사항"에 추가?
- [ ] 다음 단계 예상 시간/파일을 메모?
- [ ] 시간 필드 업데이트? (lastUpdated: YYYY-MM-DD)

---

## 메모리 파일 구조

```
~/.claude/projects/c--SOURCE-IMG-claude/memory/
├── MEMORY.md                          # 인덱스 (보조)
├── user_profile.md                    # 사용자 정보
├── project_fair_builder.md            # ⭐ 주 관리 파일
├── project_infra.md                   # 배포/인프라
├── feedback_*.md                      # 사용자 피드백
└── technical_decisions_[date].md      # 기술 결정사항
```

**가장 중요한 파일:** `project_fair_builder.md`
- 검수자가 매번 업데이트해야 함
- 다음날 또는 다음 세션에서 참고

---

## 메모리 업데이트 비용/효과

| 항목 | 내용 |
|------|------|
| **비용** | 검수 후 5~10분 메모리 작성 |
| **효과** | 대화 과정 중 요청사항/결정사항 유실 방지 |
| **ROI** | 매우 높음 (장기 프로젝트일수록 가치 ↑) |

---

## 메모리 업데이트 체크 포인트

### 매 세션마다 확인

```bash
# 메모리 파일 최신 확인
cat ~/.claude/projects/c--SOURCE-IMG-claude/memory/project_fair_builder.md
```

**체크:**
- [ ] 최신 버전의 단계별 상태가 기록되어 있는가?
- [ ] 미해결 버그가 명시되어 있는가?
- [ ] 다음 단계가 명확한가?

### 발견된 정보 유실 시

"지금까지 뭐가 완료됐지?" 하고 싶을 때:
1. `project_fair_builder.md` 먼저 확인
2. 메모리 내용이 명확하면 → 빠른 재개
3. 메모리가 오래됐으면 → 검수 후 메모리 갱신

---

## 이전 세션 메모리 활용 예시

**상황:** 며칠 후 다시 작업

```
"지난번에 Step 3까지 완료했고, 
 Step 4는 AOS 애니메이션이었던 것 같은데..."

→ project_fair_builder.md 열기
→ 정확한 상태/계획이 나옴 ✅
→ 즉시 Step 4 재개
```

---

## 자동화 팁

VS Code 확장이나 스크린샷으로 메모리 파일을 자주 확인하면:
- 대화 중 "이거 어디 적어뒀더라?" 방지
- 다음 세션에서 즉시 재개 가능
- 요청사항 중복 요청 방지

---

## 참고 자료

- [Memory System Guide](../../memory/MEMORY.md)
- [메모리 타입별 작성 규칙](../../memory/MEMORY.md#types-of-memory)
- [project_fair_builder.md](../../memory/project_fair_builder.md) - 현재 프로젝트 상태
