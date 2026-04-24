# 📋 기획담당자 (Architect) 가이드

사용자 요청을 분석하고 구현 스펙을 정의하는 역할입니다.  
**메모리 관리의 첫 단계**로서, 모든 요청사항을 명확히 기록합니다.

---

## 기획 프로세스

### 1️⃣ 사용자 요청 수집

사용자로부터:
- 기능 요청
- 버그 리포트
- 개선사항 제안

**예시:**
> "메인 비주얼에서 폰트 추가해줄래? Paperozi, GMarketSans, 여기어때 잘난체, 프리텐다드 굵기 설정도 100~900 단위로"

---

### 2️⃣ 요청사항 분석 및 메모리 저장

#### **A) 요청내용 메모리화**

새 메모리 파일 생성 (또는 기존 파일 업데이트):

**파일명:** `request_[기능명].md`

**내용:**
```markdown
---
name: 메인 비주얼 웹폰트 추가
description: 4종의 웹폰트 + 가변 굵기(100~900) 지원
type: project
originSessionId: [session-id]
---

## 요청 내용

### 요청자
kim.sy@incruit.com (2026-04-24)

### 기능
메인 비주얼 텍스트 편집 시 폰트 선택 및 굵기 조절 기능

### 상세 요구사항
1. **추가 폰트:**
   - Paperozi
   - GMarketSans
   - YeogiOttaeJalnan (여기어때 잘난체)
   - Pretendard

2. **굵기 설정:**
   - 100~900 단위 (기본: 400)
   - 동적 드롭다운 (폰트별로 다른 weight 옵션)

3. **위치:**
   - 편집 모드 포맷 툴바 (#format-toolbar)
   - 폰트 선택 드롭다운 + 굵기 선택 드롭다운

4. **적용 범위:**
   - mvisual-text-1 (PC 버전)
   - mvisual-text-m (모바일 버전)
   - 각 요소별 독립 설정

### 우선순위
높음 - 메인 비주얼 Step 1 구현 필수 항목

### 관련 파일
- fair-builder.html (메인 빌더)
- temp.html (템플릿)
```

#### **B) 프로젝트 메모리 업데이트**

`project_fair_builder.md`의 "진행 중" 섹션 업데이트:

```markdown
### 진행 중 (다음 순서)
- **Step 1**: 웹폰트 추가 + 굵기 설정 (요청 2026-04-24)
  - 폰트: Paperozi, GMarketSans, YeogiOttaeJalnan, Pretendard
  - 굵기: 100~900 범위, 동적 드롭다운
  - 위치: 포맷 툴바 (#format-toolbar)
  - 예상 난이도: 중
  - 예상 시간: 3시간
```

#### **C) 기술 스펙 작성**

상세 스펙 메모리 (필요시):

```markdown
---
name: 메인 비주얼 Step 1 기술 스펙
description: 웹폰트 추가 및 굵기 설정 기술 스펙
type: project
---

## 데이터 구조

### sectionData 확장
```javascript
section_visual: {
  mvisual_texts: [{
    index: 1,
    pcText: '텍스트',
    mText: '텍스트',
    fontFamily: 'inherit',        // 새로 추가
    fontWeight: '400',            // 새로 추가
    // ...
  }]
}
```

## 함수 요구사항

### 1. updateVisualFontStyle(idx)
- fontFamily 드롭다운 + fontWeight 드롭다운 값 읽기
- 해당 요소의 fontFamily/fontWeight 업데이트
- 동적 weight 드롭다운 생성

### 2. execFmtFontName(fontFamily)
- 선택된 텍스트에 폰트 적용
- 포맷 툴바 활용

### 3. execFmtFontWeight(fontWeight)
- 선택된 텍스트에 굵기 적용

## UI 요구사항

### 포맷 툴바 (format-toolbar)
```
[폰트 선택 ▼] [굵기 선택 ▼]
```

### 좌측 편집 패널
```
메인 비주얼 편집
─────────────
요소 탭: [1] [2] [3]

PC 제목: [입력창]
모바일 제목: [입력창]

폰트: [선택▼]    굵기: [선택▼]
```

## 테스트 항목

- [ ] PC 환경에서 폰트 변경 적용 확인
- [ ] 모바일 환경에서 폰트 변경 적용 확인
- [ ] weight 드롭다운이 선택 폰트에 맞게 동적 생성
- [ ] 포매팅 변경 후 새로고침 시 유지 (데이터 persist)
```

---

## 요청사항 검증 체크리스트

기획 단계에서 반드시 확인:

- [ ] 요청이 명확하고 구체적인가?
- [ ] 구현 난이도는 적절한가?
- [ ] 필요한 데이터 구조 변경은 무엇인가?
- [ ] 새로운 UI 컴포넌트가 필요한가?
- [ ] 기존 기능과 충돌이 없는가?
- [ ] 우선순위와 예상 시간은 적절한가?

---

## 메모리 파일 구조

```
memory/
├── request_[기능명].md           # 새 기능 요청
├── request_[버그명].md           # 버그 리포트
├── project_fair_builder.md       # ⭐ 프로젝트 진행상황 (주관리)
└── technical_[결정].md           # 기술 결정사항
```

---

## 요청 vs 스펙 vs 결정사항 구분

| 항목 | 역할 | 파일 | 예시 |
|------|------|------|------|
| **요청** | 기획자 | `request_*.md` | "폰트 추가해줄래?" |
| **스펙** | 기획자 | `technical_*.md` | "fontFamily 필드 추가, updateVisualFontStyle() 구현" |
| **결정** | 개발자/검수자 | `project_*.md` | "pcHtml/mHtml로 포맷팅 저장" |

---

## 요청→스펙 예시

### 사용자 요청
> "메인 비주얼에서 폰트 추가해줄래?"

### 기획자 분석
```markdown
- 어떤 폰트? (Paperozi, GMarketSans, ...)
- 어디에 추가? (포맷 툴바)
- 굵기는? (100~900)
- 저장되어야 하나? (Yes, sectionData)
```

### 스펙 정의
```markdown
1. WEBFONTS 배열 생성
2. sectionData.fontFamily / fontWeight 필드 추가
3. 포맷 툴바 UI 추가
4. updateVisualFontStyle() 함수 구현
5. blur 핸들러로 persist
```

---

## 기획자의 메모리 책임

### 매 요청마다
- [ ] `request_*.md` 파일 생성/업데이트
- [ ] `project_fair_builder.md`의 "진행 중" 섹션 업데이트
- [ ] 기술 스펙이 필요하면 `technical_*.md` 작성
- [ ] 우선순위/예상 시간 명시

### 주간 메모리 검토
- 미해결 요청이 있는가?
- 중복 요청은 없는가?
- 우선순위 변경이 필요한가?

---

## 참고 자료

- [CLAUDE.md](./CLAUDE.md) - 프로젝트 개요
- [Memory Guide](../../memory/MEMORY.md) - 메모리 작성 규칙
- [project_fair_builder.md](../../memory/project_fair_builder.md) - 현재 상태
