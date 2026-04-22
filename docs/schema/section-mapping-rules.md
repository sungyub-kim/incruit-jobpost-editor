# 섹션 매핑 규칙 (Section Mapping Rules)

> 인크루트 채용공고 에디터의 섹션 감지, 키워드 매칭, 검증 로직 참조 문서

---

## 1. 개요

**목적**: 채용공고 원문(HWP, PDF, DOCX, XLSX, URL)을 12개 HR-JSON 섹션으로 자동 분류하는 규칙 정의

**참조 파일**:
- `js/services/ruleConverter.js` — 규칙 기반 변환 엔진 (SECTION_DEFS, 키워드 매칭, 신뢰도)
- `js/app.js` — AI 변환 프롬프트 (`buildConversionPrompt()`), 검증 (`verifyConversion()`)
- `js/services/fileExtractor.js` — 파일 형식별 텍스트/HTML 추출
- `js/services/urlExtractor.js` — URL에서 채용공고 추출

**스키마 파일**: `docs/schema/incruit-jobpost.schema.json`

---

## 2. 변환 파이프라인 흐름도

### 2.1 전체 흐름

```
입력 소스
├── 파일 (HWP/PDF/DOCX/XLSX/HTML/TXT/CSV/RTF)
│     → fileExtractor.js (브라우저 CDN 또는 convert-server.py)
│     → { html, text, warnings, metadata }
│
└── URL (인크루트/잡코리아/사람인/원티드/기타)
      → urlExtractor.js (플랫폼별 파서 또는 AI 동적 파서)
      → { html, text, confidence }
          ↓
    원문 영역에 표시 (state.originalSource에 보존)
          ↓
    ┌──────────────────┐     ┌──────────────────┐
    │ 규칙 기반 변환     │     │ AI 변환           │
    │ convertByRules()  │     │ callAI()          │
    │ (ruleConverter.js)│     │ (app.js)          │
    └────────┬─────────┘     └────────┬─────────┘
             ↓                         ↓
    12개 섹션 <div> 래핑              12개 섹션 <div> 래핑
    (data-hr-property +               + KV JSON 블록 출력
     data-incruit-field)
             ↓                         ↓
             └──────────┬──────────────┘
                        ↓
              verifyConversion() 검증
                        ↓
              등급 판정 (A/B/C/F)
                        ↓
              미리보기 + KV 자동 채우기
```

### 2.2 파일 형식별 추출 특성

| 형식 | 파서 | 테이블 보존 | 특이사항 |
|------|------|------------|---------|
| **DOCX** | mammoth.js (CDN) | 최고 | colspan/rowspan 완벽 |
| **XLSX** | SheetJS (CDN) | 최고 | 멀티시트 → `<h3>시트명</h3>` |
| **PDF** | pdf.js (CDN) | 중간 (위치 추론) | 폰트 크기 기반 제목 감지, PUA 문자 복원 |
| **HWP** | 브라우저 OLE2 → 백엔드 LibreOffice | 높음 (서버) | 4단계 폴백, EUC-KR |
| **HWPX** | JSZip + XML (CDN) | 높음 | section*.xml 파싱 |
| **HTML/TXT/CSV** | 기본 파서 | 원본 의존 | 직접 전달 |

모든 형식은 동일한 `{ html, text, warnings, metadata }` 구조로 통합됩니다.

---

## 3. 입력 형식 감지

> 소스: `ruleConverter.js:143-152` `detectInputType()`

| 형식 | 감지 조건 | 처리 |
|------|----------|------|
| `already_incruit` | `data-hr-property`, `data-incruit-field`, `tempNew-wrap` 존재 | pass-through (confidence: 100) |
| `structured_html` | `<h1-6>`, `<table>`, `<ul>`, `<ol>`, `<tr>`, `<td>`, `<th>`, `<div>`, `<p>`, `<strong>`, `<b>` 태그 존재 | `segmentByHtmlString()` |
| `plain_text` | HTML 태그 없음 | `segmentPlainText()` |
| `empty` | 빈 문자열 또는 `<br>` | 빈 결과 반환 |

---

## 4. 12-섹션 매핑 테이블

> 소스: `ruleConverter.js:13-62` `SECTION_DEFS`

| # | 섹션 ID | data-hr-property | data-incruit-field | 키워드 |
|---|---------|------------------|--------------------|--------|
| 1 | `company_info` | `description` | `company_info` | 기업소개, 회사소개, 회사개요, 기업개요, 기관소개, 법인소개, 조합소개, 기관 소개, 회사 소개, 기업 소개 |
| 2 | `recruit_title` | `title` | `recruit_title` | 모집부문, 모집직종, 채용분야, 모집분야, 채용직무, 모집개요, 채용개요, 모집인원, 모집 부문, 채용 분야, 모집 인원 |
| 3 | `job_description` | `responsibilities` | `job_description` | 담당업무, 주요업무, 직무내용, 업무내용, 수행업무, 직무소개, 업무소개, 하는 일, 담당 업무, 주요 업무, 직무 내용, 업무 내용, 직무기술서 |
| 4 | `qualification` | `qualifications` | `qualification` | 자격요건, 지원자격, 필수자격, 필수요건, 자격조건, 응시자격, 지원요건, 자격 요건, 지원 자격, 필수 자격, 필수 요건 |
| 5 | `preferred` | `preferredQualifications` | `preferred` | 우대사항, 우대조건, 가점사항, 우대요건, 선호사항, 우대 사항, 우대 조건, 가점 사항 |
| 6 | `work_condition` | `jobLocation + employmentType` | `work_condition` | 근무조건, 근무환경, 근무형태, 근무장소, 근무지, 근무시간, 근무처, 근무 조건, 근무 환경, 근무 형태, 근무 장소, 고용형태, 고용 형태, 채용조건, 채용 조건 |
| 7 | `salary` | `baseSalary` | `salary` | 급여, 연봉, 보수, 임금, 급여조건, 처우, 보상, 연봉수준, 급여 조건, 처우조건, 처우 조건, 보수조건 |
| 8 | `benefits` | `jobBenefits` | `benefits` | 복리후생, 복지혜택, 복지제도, 사내복지, 복리 후생, 복지 혜택, 복지 제도, 사내 복지, 지원제도, 사내문화 |
| 9 | `hiring_process` | `applicationProcess` | `hiring_process` | 전형절차, 채용절차, 선발절차, 전형과정, 심사절차, 채용과정, 채용프로세스, 전형방법, 전형 절차, 채용 절차, 선발 절차, 채용 과정, 채용 프로세스, 전형일정 |
| 10 | `deadline` | `validThrough` | `deadline` | 접수기간, 마감일, 모집기간, 지원기간, 접수마감, 서류접수, 원서접수, 지원마감, 접수 기간, 모집 기간, 지원 기간, 접수 마감, 채용기간, 공고기간 |
| 11 | `apply_method` | `applicationContact` | `apply_method` | 접수방법, 지원방법, 지원서접수, 지원서 접수, 제출서류, 접수처, 서류제출, 지원서 제출, 접수 방법, 지원 방법, 제출 서류, 서류 제출, 지원서류 |
| 12 | `etc_info` | `additionalInfo` | `etc_info` | 기타안내, 참고사항, 유의사항, 기타사항, 주의사항, 비고, 안내사항, 기타 안내, 참고 사항, 유의 사항, 기타 사항, 주의 사항, 문의처, 기타문의 |

### HTML 출력 예시

```html
<div data-hr-property="responsibilities" data-incruit-field="job_description">
  <h2>담당업무</h2>
  <ul>
    <li>서비스 기획 및 운영</li>
    <li>고객 응대 및 불만 처리</li>
  </ul>
</div>
```

---

## 5. 키워드 매칭 규칙

> 소스: `ruleConverter.js:157-186` `matchSectionKeyword()`

### 5.1 전처리 (prefix/suffix 스트리핑)

| 단계 | 정규식 | 설명 |
|------|--------|------|
| 앞쪽 기호 제거 | `/^[\s○●■□▶▷★☆※•◆◇▪◎▣☐☑▲△►▻·\-\u2022\u2023\u2043\[\]【】<>《》「」『』]+/` | 목록 기호, 괄호류 |
| 뒤쪽 기호 제거 | `/[\s:：>\]】》」』]+$/` | 콜론, 닫는 괄호 |
| 숫자 접두사 제거 | `/^\d{1,2}[.)]\s*/` | "1.", "2)" 등 |

### 5.2 매칭 조건

- **최소 2자**: 1자 오탐 방지
- **최대 60자**: 긴 문장 차단

### 5.3 매칭 우선순위

| 순위 | 매칭 유형 | 조건 | 예시 |
|------|----------|------|------|
| 1 | **정확 일치** | `cleaned === keyword` | "담당업무" → `job_description` |
| 2 | **부분 일치** | `cleaned.includes(keyword) && cleaned.length <= keyword.length + 12` | "모집부문 (정규직)" → `recruit_title` |
| - | **불일치** | 길이 초과 | "담당업무 관련 경력 3년 이상 필수" → null |

### 5.4 헤더 감지 소스 (HTML)

> 소스: `ruleConverter.js:191+` `segmentByHtmlString()`

| 우선순위 | HTML 요소 | 비고 |
|---------|----------|------|
| 1 | `<h1>`~`<h6>` 태그 | 정규식으로 전체 HTML에서 탐색 |
| 2 | `<strong>`/`<b>` 블록 | `<p><strong>키워드</strong></p>` 패턴 |
| 3 | `<td>`/`<th>` 셀 | 테이블 내 짧은 키워드 셀 → 해당 `<tr>` 전체를 분할점 |

### 5.5 헤더 감지 소스 (plain text)

> 소스: `ruleConverter.js:70-82` `PLAIN_HEADER_PATTERNS`

| # | 패턴 | 예시 |
|---|------|------|
| 1 | `^[■●○▶▷★◆◇▪◎▣☐☑※]\s*(.+)$` | ■ 자격요건 |
| 2 | `^\[(.+)\]$` | [모집부문] |
| 3 | `^<(.+)>$` | <근무조건> |
| 4 | `^【(.+)】$` | 【전형절차】 |
| 5 | `^「(.+)」$` | 「복리후생」 |
| 6 | `^《(.+)》$` | 《접수기간》 |
| 7 | `^(?:\d{1,2}[.)]\s*)(.+)$` | 1. 모집부문 |
| 8 | `^(?:[IVX]{1,4}[.)]\s*)(.+)$` | III. 자격요건 |
| 9 | `^(?:[가-힣][.)]\s*)(.+)$` | 가. 담당업무 |
| 10 | `^(?:#{1,3})\s*(.+)$` | ## 우대사항 |
| 11 | `^(.+)\s*[:：]\s*$` | 근무조건: |

### 5.6 중복 방지

- heading 내부 `<strong>`은 제외 (heading이 이미 분할점)
- 같은 위치 ±10자 내 마커 중복 제외
- 같은 섹션 ID가 ±50자 내 연속 시 첫 번째만

---

## 6. 신뢰도 점수 알고리즘

> 소스: `ruleConverter.js:505-522` `calculateConfidence()`

### 공식

```
총점 = min(100, 섹션비율점수 + 핵심섹션보너스 + 타이틀보너스)
```

| 요소 | 최대 배점 | 계산 |
|------|----------|------|
| 섹션 비율 | 60점 | `min(60, (감지된 고유 섹션 수 / 12) × 100)` |
| 핵심 섹션 | 30점 | `(핵심 섹션 발견 수 / 3) × 30` |
| 타이틀 | 10점 | `<h1>` 타이틀 존재 시 |

**핵심 섹션** (3개): `job_description`, `qualification`, `work_condition`

### 해석

| 신뢰도 | 의미 | 권장 행동 |
|--------|------|----------|
| 100 | 이미 변환됨 (already_incruit) | pass-through |
| 80+ | 섹션 대부분 감지 | 규칙 기반 변환 사용 |
| 60-79 | 일부 섹션 감지 | AI 변환 권장 |
| < 60 | 섹션 거의 미감지 | AI 변환 필수 |

---

## 7. 검증 점수/등급

> 소스: `js/app.js:1598-1812` `verifyConversion()`

### 7.1 검증 5단계

| 단계 | 검증 항목 | 방법 |
|------|----------|------|
| 1 | **텍스트 완전성** | 문장 단위 1:1 대조. 직접 포함 또는 80% 단어 부분 매칭 |
| 2 | **환각 감지** | 변환 결과에만 존재하는 문장. 50% 미만 단어 매칭 시 환각 |
| 3 | **구조 보존** | table / list / heading 개수 비교 (source vs converted) |
| 4 | **핵심 데이터** | 전화번호, 이메일, 급여, 날짜, URL 정규식 매칭 |
| 5 | **테이블 셀** | `<td>`/`<th>` 셀 내용 개별 대조 |

### 7.2 감점 기준

| 항목 | 감점 |
|------|------|
| 텍스트 일치율 95% 미달 | `(95 - 일치율)` 점 |
| 환각 1건당 | 5점 |
| 핵심 데이터 누락 1건당 | 10점 |
| 테이블 셀 누락 1건당 | 3점 |
| 테이블 완전 소실 (원문에 있는데 변환에 없음) | 20점 |

**점수 계산**: `score = max(0, 100 - 총감점)`

### 7.3 등급 체계

| 등급 | 점수 | 의미 | 표시 |
|------|------|------|------|
| A | 95-100 | 우수 — 원문 완벽 보존 | 🟢 |
| B | 80-94 | 양호 — 사소한 차이 허용 | 🟡 |
| C | 60-79 | 주의 — 확인 필요 | 🟠 |
| F | 0-59 | 실패 — 재변환 권장 | 🔴 |

**통과 기준**: `grade !== 'F'` (즉 score >= 60)

---

## 8. 핵심 데이터 정규식

> 소스: `js/app.js:1695-1701`

| 타입 | 라벨 | 정규식 |
|------|------|--------|
| 전화번호 | `전화번호` | `/(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\|(?:\+82\|82)[-.\s]?\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g` |
| 이메일 | `이메일` | `/[\w.-]+@[\w.-]+\.\w{2,}/g` |
| 급여 | `급여` | `/\d{1,3}(?:,\d{3})+\s*(?:원\|만원\|만\s*원)/g` |
| 날짜 | `날짜` | `/\d{4}[.\-\/년]\s*\d{1,2}[.\-\/월]\s*\d{1,2}[일]?/g` |
| URL | `URL` | `/https?:\/\/[^\s<>"']+/g` |

---

## 9. KV (키비주얼) JSON 스키마

### 9.1 AI 출력 JSON 필드

> 소스: `js/app.js:3520-3530` `buildConversionPrompt()`

AI 변환 시 HTML 출력 뒤에 ` ```json ``` ` 블록으로 출력:

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `jobCode` | string | O | 공고 번호 | `"공고 제2026-123호"` |
| `title` | string | O | 기업명 + 공고명 (최대 3줄, `\n` 줄바꿈) | `"인크루트\n채용담당자 모집"` |
| `description` | string | O | 회사/직무 소개 (최대 3줄) | `"국내 1위 채용 플랫폼"` |
| `date` | string | O | 마감일 (YYYY년 MM월 DD일) | `"2026년 3월 15일"` |
| `companyName` | string | O | 기업명 | `"인크루트"` |
| `industry` | string | △ | 업종 키워드 | `"IT"` |

> **참고**: `buildConversionPrompt()`는 `industry` 포함, `buildKvPrompt()`는 미포함

### 9.2 업종별 배경 이미지 매핑 (17개 카테고리)

> 소스: `js/app.js:6651-6760` `KV_BG_IMAGES` + `pickBgImageByKeywords()`

| # | 키 | 업종 | 감지 키워드 (정규식) |
|---|-----|------|---------------------|
| 1 | `ai` | AI/인공지능 | `ai\|인공지능\|머신러닝\|딥러닝\|llm` |
| 2 | `data` | 데이터 | `데이터\|data.*scientist\|data.*engineer\|분석` |
| 3 | `dev` | 개발 | `개발\|developer\|engineer\|프로그래머\|프론트엔드\|백엔드\|풀스택\|devops\|소프트웨어` |
| 4 | `it` | IT | `it\|정보기술\|시스템\|클라우드\|인프라\|네트워크\|보안\|sre` |
| 5 | `design` | 디자인 | `디자인\|designer\|ux\|ui\|그래픽\|영상\|크리에이티브` |
| 6 | `marketing` | 마케팅 | `마케팅\|marketing\|광고\|홍보\|pr\|콘텐츠\|seo\|퍼포먼스` |
| 7 | `finance` | 금융/재무 | `재무\|회계\|finance\|금융\|투자\|증권\|은행\|보험` |
| 8 | `medical` | 의료 | `의료\|의사\|간호\|약사\|병원\|클리닉\|헬스케어` |
| 9 | `bio` | 바이오 | `바이오\|제약\|연구원\|r&d\|임상` |
| 10 | `education` | 교육 | `교육\|강사\|교수\|학교\|academy\|에듀` |
| 11 | `manufacturing` | 제조 | `제조\|생산\|공장\|품질\|qc\|qa\|설비` |
| 12 | `construction` | 건설 | `건설\|건축\|시공\|토목\|인테리어` |
| 13 | `logistics` | 물류 | `물류\|배송\|운송\|유통\|supply.*chain\|scm\|창고` |
| 14 | `retail` | 유통/판매 | `유통\|리테일\|매장\|판매\|영업\|retail` |
| 15 | `hr` | 인사 | `인사\|hr\|채용\|교육훈련\|노무\|총무` |
| 16 | `service` | 서비스 | `고객\|cs\|서비스\|상담\|지원\|support\|헬프데스크` |
| 17 | `business` | 경영 | `경영\|기획\|전략\|사업\|비즈니스\|컨설팅` |

**기본값**: `office` (매칭 없을 시)

---

## 10. LLM 프롬프트 구조

> 소스: `js/app.js:3414-3531` `buildConversionPrompt()`

AI 변환 프롬프트는 다음 블록으로 구성:

| 블록 | 내용 | 목적 |
|------|------|------|
| 1 | 역할 지시 + 원문 보존 규칙 | 변경/추가/삭제 금지, 환각 금지 |
| 2 | 입력 형식 감지 (HTML vs 텍스트) | 구조 보존 전략 결정 |
| 3 | PDF 특별 처리 (PUA 문자, 테이블) | PDF 추출 결함 보정 |
| 4 | 섹션 감지 지시 (12개 분류) | HR-JSON 매핑 |
| 5 | HTML 태그 규칙 | `<h1>` 제목, `<h2>` 섹션, `<table>` 보존 |
| 6 | 기호/번호 보존 (○●■□▶★①②③ 등) | 원문 충실도 |
| 7 | HR-JSON 속성 매핑 표 | `data-hr-property` + `data-incruit-field` |
| 8 | 원문 텍스트 (최대 50,000자) | 변환 입력 |
| 9 | KV JSON 출력 형식 | 키비주얼 자동 생성 |

### API 파라미터

| 파라미터 | 값 | 이유 |
|---------|-----|------|
| `temperature` | 0.1 | 창의적 변형 최소화, 원문 충실도 극대화 |
| `max_tokens` | 8,192 (Claude) / 16,384 (OpenAI) / 65,536 (Gemini) | 잘림 방지 |

### 자동 이어쓰기

`finish_reason === 'max_tokens'` (잘림) 감지 시 최대 2회 이어쓰기 시도.

---

## 11. 새 섹션/키워드 추가 가이드

### 11.1 새 섹션 추가 체크리스트

| # | 파일 | 위치 | 작업 |
|---|------|------|------|
| 1 | `js/services/ruleConverter.js` | `SECTION_DEFS` 배열 | `{ id, hrProp, incruitField, keywords[] }` 객체 추가 |
| 2 | `js/app.js` | `buildConversionPrompt()` 매핑 표 | 행 추가 |
| 3 | `docs/schema/incruit-jobpost.schema.json` | `sectionDefinitions.const` | 객체 추가 |
| 4 | `docs/schema/section-mapping-rules.md` | 섹션 4 테이블 | 행 추가 |

### 11.2 새 키워드 추가 체크리스트

| # | 파일 | 작업 |
|---|------|------|
| 1 | `js/services/ruleConverter.js` | 해당 섹션 `keywords` 배열에 추가 |
| 2 | `docs/schema/incruit-jobpost.schema.json` | `sectionDefinitions.const` 해당 항목에 추가 |
| 3 | `docs/schema/section-mapping-rules.md` | 섹션 4 테이블 해당 행에 추가 |

> **팁**: 공백 포함/미포함 변형 모두 추가 권장 (예: "기업소개", "기업 소개")

### 11.3 새 업종 배경 이미지 추가 체크리스트

| # | 파일 | 위치 | 작업 |
|---|------|------|------|
| 1 | `js/app.js` | `KV_BG_IMAGES` | `키: 'Unsplash URL'` 추가 |
| 2 | `js/app.js` | `pickBgImageByKeywords()` rules | `[/정규식/i, '키']` 추가 |
| 3 | `js/app.js` | `suggestImageKeyword()` rules | 동일 규칙 추가 |
| 4 | `js/app.js` | `KV_SEARCH_KEYWORDS` | `키: '영어 검색어'` 추가 |
| 5 | `docs/schema/incruit-jobpost.schema.json` | `industryDefinitions.const` | 객체 추가 |
| 6 | `docs/schema/section-mapping-rules.md` | 섹션 9.2 테이블 | 행 추가 |
