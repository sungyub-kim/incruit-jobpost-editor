# 💻 개발담당자 (Builder) 가이드

기획자의 스펙을 바탕으로 기능을 구현하고, **구현 과정의 변경사항을 메모리에 반영**하는 역할입니다.

---

## 개발 프로세스

### 1️⃣ 스펙 분석

개발 시작 전:

```
기획자 요청 확인 → request_*.md 읽기 → 기술 스펙 이해 → 구현 계획 수립
```

**체크리스트:**
- [ ] 기획자의 `request_*.md` 파일 읽음?
- [ ] 데이터 구조 변경이 무엇인지 이해?
- [ ] 필요한 함수/UI는 무엇인지 파악?
- [ ] 예상 난이도와 시간 확인?

---

### 2️⃣ 구현 진행 및 메모리 업데이트

#### **A) 구현 시작 시**

메모리 파일 업데이트: `project_fair_builder.md`

```markdown
### 진행 중 (다음 순서)
- **Step 1**: 웹폰트 추가 + 굵기 설정
  - ⏳ 개발 중 (kim 담당, 시작: 2026-04-24 14:00)
```

#### **B) 구현 과정 중 발견사항 기록**

**발견한 이슈/결정사항이 있으면 즉시 메모리 추가:**

```markdown
---
name: Step 1 구현 과정 노트
description: 웹폰트 추가 구현 중 발견된 이슈 및 해결
type: project
---

## 구현 진행

### 2026-04-24 14:00~15:30
- [ ] WEBFONTS 배열 생성
  - Paperozi, GMarketSans, YeogiOttaeJalnan, Pretendard
  - 각 폰트별 weight 배열 (100, 200, 300, ..., 900)
  
- [ ] sectionData 필드 추가
  - fontFamily, fontWeight
  
- [ ] 포맷 툴바 UI 추가
  - fmt-font-select 드롭다운
  - fmt-weight-select 드롭다운

### 이슈 발견

1. **폰트 로드 문제**
   - 나눔고딕이 로드 안 됨 → @import 추가 필요
   - 해결: 나눔폰트 CDN URL 추가

2. **weight 드롭다운 동적 생성**
   - 폰트 선택 시 weight 옵션 변경 필요
   - 해결: updateFmtWeightOptions() 함수로 처리

3. **포맷팅 지속성**
   - 폰트 변경 후 새로고침 시 날라짐 ⚠️
   - 원인: sectionData가 plain text만 저장
   - 해결 방안: pcHtml/mHtml 필드로 형식화 HTML 저장
   - 우선순위: 높음 (별도 Step으로 분리)
```

#### **C) 구현 완료 시**

메모리 업데이트 (최종 상태):

```markdown
### 완료 ✅
- **Step 1** (v0.15.1): 텍스트 편집 + 웹폰트 지원
  - contenteditable PC/모바일 제목 텍스트
  - 나눔고딕, 나눔명조 (기존)
  - Paperozi, GMarketSans, YeogiOttaeJalnan, Pretendard (신규)
  - 각 폰트별 weight 100~900 지원 + 동적 드롭다운

## 구현 파일 및 라인수
- **fair-builder.html**
  - Line 12-34: @font-face 정의
  - Line 1481-1490: WEBFONTS 배열
  - Line 2181-2209: execFmtFontName()
  - Line 2211-2233: execFmtFontWeight()
  - Line 2235-2259: updateFmtWeightOptions()

## 버그 및 미해결
- [ ] 포맷팅 지속성: 별도 Step 2로 분리 예정
```

---

## 개발자의 메모리 책임

### 개발 시작 시
- [ ] 스펙 확인 완료 메모리에 기록
- [ ] 예상 완료 시간 기입

### 개발 과정 중
- [ ] 예상치 못한 이슈 발견 시 즉시 메모리 기록
- [ ] 다른 구현이 필요해 보이면 메모리 추가
- [ ] 파일/함수 위치 구체적으로 기록

### 개발 완료 시
- [ ] `project_fair_builder.md`의 "완료" 섹션으로 이동
- [ ] 구현 파일과 라인수 명시
- [ ] 발견된 버그/개선사항 기록
- [ ] 검수자에게 인수

---

## 구현 과정 메모리 예시

### 좋은 예 ✅
```markdown
## Step 1 구현 노트

### 발견사항 1: 나눔폰트 로드 실패
- 문제: 브라우저에서 나눔고딕이 로드 안 됨
- 파일: fair-builder.html Line 12-14
- 해결: @import 추가
  ```
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR&display=swap');
  ```

### 발견사항 2: weight 드롭다운 미작동
- 문제: 폰트 선택 후 weight 옵션이 업데이트 안 됨
- 파일: fair-builder.html Line 2235-2259 (updateFmtWeightOptions)
- 해결: focus 이벤트 핸들러 추가
```

### 나쁜 예 ❌
```markdown
## Step 1 구현 완료

나눔폰트 문제를 고쳤고 드롭다운도 작동함.
혹시 다른 문제가 있을 수도 있음.
```

---

## 스펙 vs 구현 vs 버그 구분

| 단계 | 역할 | 메모리 위치 | 예시 |
|------|------|-----------|------|
| **스펙** | 기획자 | `technical_*.md` | "fontFamily 필드 추가" |
| **구현** | 개발자 | `project_*.md` | "Line 1481-1490: WEBFONTS 배열 생성" |
| **버그** | 개발자→검수자 | `project_*.md` | "[x] 포맷팅 지속성 미해결" |

---

## 개발 체크리스트

구현 시작 전:

```
[ ] 스펙 명확한가?
[ ] 데이터 구조 이해?
[ ] 함수/UI 위치 파악?
[ ] 충돌 예상되는 기능?
```

개발 진행 중:

```
[ ] 매 단계마다 git commit?
[ ] 버그 발견 시 메모리 기록?
[ ] 예상치 못한 변경사항 메모?
```

개발 완료 시:

```
[ ] 전체 기능 테스트?
[ ] 예상치 못한 부작용?
[ ] 메모리 최종 업데이트?
[ ] 검수자에게 인수?
```

---

## 개발 과정 팁

### 메모리 활용
- 개발 시작 전에 메모리에서 관련 내용 검색
- 구현 중 비슷한 문제를 과거에 해결했는가?
- 이전 Step의 구현 방식과 일관성 유지

### Git 커밋
```bash
# 한 번에 하나의 기능/버그 수정
# 메모리와 git log가 일치하도록

git commit -m "feat: Step 1 웹폰트 추가

- WEBFONTS 배열에 4종 폰트 추가
- 포맷 툴바에 폰트/굵기 드롭다운 추가
- updateFmtFontName/Weight() 함수 구현

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### 문제 해결 시
1. 메모리에서 유사한 문제 찾기
2. git log에서 관련 커밋 찾기
3. 같은 실수 반복 방지

---

## 개발자에서 검수자로 넘기기

검수자에게 전달할 정보:

```
✅ 구현 완료
- 기능: [스펙 요약]
- 파일: fair-builder.html
- 커밋: [hash] [메시지]

📋 메모리 업데이트 완료
- project_fair_builder.md 최신화
- 발견된 버그 기록

🧪 테스트 확인
- PC 환경: ✅
- 모바일 환경: ✅
- 기존 기능: ✅

⚠️ 미해결 이슈
- [있으면 나열]
```

---

## 참고 자료

- [ARCHITECT.md](./ARCHITECT.md) - 스펙 확인
- [CLAUDE.md](./CLAUDE.md) - 프로젝트 규칙
- [REVIEWER.md](./REVIEWER.md) - 검수 기준
- [Memory Guide](../../memory/MEMORY.md) - 메모리 작성법
