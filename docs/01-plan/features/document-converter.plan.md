# Plan: Document Converter (문서 변환기)

> 다양한 문서 파일(PDF, HWP/HWPX, Word, Excel 등)을 HTML로 변환하는 앱 내장 모듈

---

## 1. 개요

### 1.1 기능명
**Document Converter** - 문서 파일 → HTML 변환 서비스

### 1.2 목적
채용공고 원본 파일(PDF, HWP, HWPX, DOC, DOCX, XLSX, XLS, CSV, TXT, HTML)을 **인크루트 표준 HTML 템플릿**으로 변환한다. 전체 파이프라인은 두 단계로 구성된다:

1. **포맷 변환** — 파일을 Raw HTML/텍스트로 추출 (서버 + 브라우저)
2. **시맨틱 변환** — Raw HTML을 인크루트 섹션 구조로 재구성 (AI)

### 1.3 방식
**3레이어 아키텍처**

| 레이어 | 담당 | 역할 |
|--------|------|------|
| 브라우저 CDN | mammoth.js, pdf.js 등 | 파일 → Raw HTML 추출 (1차) |
| Python 백엔드 | convert-server.py | 파일 → Raw HTML 추출 (폴백) |
| AI | callAI() → buildConversionPrompt() | Raw HTML → 인크루트 템플릿 변환 |

### 1.4 관련 파일

| 파일 | 유형 | 역할 |
|------|------|------|
| `js/services/fileExtractor.js` | 수정 | 브라우저 측 파일 추출 (1차) |
| `convert-server.py` | 신규 생성 | Python 백엔드 변환 서버 (폴백) |
| `js/app.js` | 수정 | handleFileAttach 개선, 백엔드 폴백 연동 |
| `index.html` | 수정 | CDN 라이브러리 로드, hwpx accept 추가 |

---

## 2. 아키텍처

```
사용자 파일 첨부 (드래그&드롭 또는 파일 선택)
       │
       ▼
┌──────────────────────────┐
│  js/app.js               │
│  handleFileAttach()      │
│  - 확장자 판별            │
│  - extractFromFile() 호출 │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐     실패 시
│  fileExtractor.js        │ ─────────────┐
│  extractFromFile()       │              │
│  - 브라우저 라이브러리    │              │
│    mammoth (DOCX)        │              │
│    SheetJS (XLSX)        │              │
│    pdf.js (PDF)          │              │
│    JSZip (HWPX)          │              │
└───────────┬──────────────┘              │
            │                              │
            │ 성공                         ▼
            │                   ┌──────────────────────────┐
            ▼                   │  extractViaBackend()     │
┌──────────────────┐           │  POST localhost:8082      │
│ 원문 에디터 로드   │           │  /api/convert            │
│ sourceEditor     │           └───────────┬──────────────┘
│ innerHTML 설정   │                       │
└────────┬─────────┘                       ▼
         │                      ┌──────────────────────────┐
         │                      │  convert-server.py       │
         │                      │  - python-docx (DOCX)    │
         │                      │  - openpyxl (XLSX)       │
         │                      │  - pdfplumber (PDF)      │
         │                      │  - textutil (DOC, HWP)   │
         │                      │  - zipfile (HWPX)        │
         │                      └──────────────────────────┘
         │
         │  ※ 여기까지가 "포맷 변환" (Raw HTML 추출)
         │  ※ 아래부터 "시맨틱 변환" (AI 구조화)
         │
         ▼
┌──────────────────────────────────────────┐
│  [채용공고 변환] 버튼 클릭                  │
│                                          │
│  handleConvert()                         │
│    → buildConversionPrompt(rawHtml)      │
│    → callAI(prompt)                      │
│                                          │
│  AI가 수행하는 작업:                       │
│  1. 섹션 자동 분류 (12개 HR-JSON 섹션)     │
│  2. 인크루트 HTML 템플릿 래핑              │
│  3. 원문 기호/번호 체계 보존               │
│  4. PDF 줄 끊김/테이블 복원               │
│  5. KV JSON 메타데이터 생성               │
└───────────┬──────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────┐
│  후처리                                   │
│  extractHtmlFromResponse() → HTML 추출    │
│  applyHasMarkerClass()    → 마커 CSS 적용 │
│  tryApplyKvJson()         → KV 필드 채움  │
│  verifyConversion()       → 원문 보존 검증 │
└──────────────────────────────────────────┘
```

---

## 3. AI 시맨틱 변환 레이어

서버/브라우저가 추출한 Raw HTML은 **비정형** 상태다. AI는 이를 인크루트 표준 구조로 재구성한다.

### 3.1 서버 vs AI 역할 비교

| 구분 | 서버/브라우저 (포맷 변환) | AI (시맨틱 변환) |
|------|--------------------------|-----------------|
| **입력** | 바이너리 파일 (HWP, PDF 등) | Raw HTML/텍스트 |
| **출력** | 비정형 HTML (테이블, 단락) | 인크루트 템플릿 HTML + KV JSON |
| **핵심 능력** | 파일 포맷 디코딩 | 한국어 채용공고 섹션 인식 |
| **한계** | 의미 파악 불가 | 파일 포맷 디코딩 불가 |

서버가 할 수 없는 것: **한국어 채용공고의 섹션 경계를 인식하고, 인크루트 표준 HTML 템플릿으로 재구성하는 것** — 이것이 AI의 핵심 역할이다.

### 3.2 AI가 수행하는 작업

#### 3.2.1 섹션 자동 분류
비정형 텍스트에서 12개 HR-JSON 섹션을 인식하여 시맨틱 속성 부여:

```html
<!-- 서버 출력 (비정형) -->
<p>ABC 주식회사 소개...</p>
<p>모집 직무: 소프트웨어 엔지니어</p>
<p>자격: 경력 5년 이상</p>

<!-- AI 변환 후 (구조화) -->
<div data-hr-property="description" data-incruit-field="company_info">
  <h2>회사소개</h2>
  <p>ABC 주식회사 소개...</p>
</div>
<div data-hr-property="title" data-incruit-field="recruit_title">
  <h2>모집부문</h2>
  <p>모집 직무: 소프트웨어 엔지니어</p>
</div>
<div data-hr-property="qualifications" data-incruit-field="qualification">
  <h2>자격요건</h2>
  <ul><li>경력 5년 이상</li></ul>
</div>
```

#### 3.2.2 인크루트 템플릿 표준화
- 모든 섹션 제목 → `<h2>` (CSS `::before`로 불릿 추가)
- 불릿 스타일: 체크, 동그라미, 화살표, 별 등 사용자 선택
- CSS 변수 `--tpl-accent`, `--tpl-title-color` 기반 테마 적용
- 7개 인크루트 템플릿 변형 지원 (IT, 스타트업, 클래식, 뉴스 등)

#### 3.2.3 원문 기호/번호 체계 보존
한국식 목록 기호를 `<li>` 안에 텍스트 그대로 유지:
- 한글 번호: `가. 나. 다.` → 그대로 보존
- 특수 기호: `① ② ③`, `○ ● ■`, `※` → 변경 금지
- 클라이언트 후처리: `applyHasMarkerClass()`로 CSS 이중 마커 방지

#### 3.2.4 PDF 텍스트 복원
PDF 추출 시 발생하는 구조 손실을 AI가 복원:
- 문장 중간 줄 끊김 → 복원
- 텍스트로 풀린 테이블 → 재구성
- 깨진 특수문자(PUA 영역) → 문맥 추론

#### 3.2.5 KV JSON 메타데이터 생성
채용공고에서 키비주얼(배너) 데이터를 추출:

```json
{
  "jobCode": "공고 제1234호",
  "title": "ABC Company\nSoftware Engineer",
  "description": "IT 선도기업\n인재 채용",
  "date": "2025년 3월 15일",
  "companyName": "ABC 주식회사",
  "industry": "IT"
}
```
- `tryApplyKvJson()`으로 KV 입력 필드 자동 채움
- `industry` 값으로 업종별 배경 이미지 자동 선택 (17개 카테고리)

### 3.3 AI 변환 제약 조건

| 제약 | 설명 |
|------|------|
| 원문 100% 보존 | 글자 하나 변경/추가/삭제 금지 |
| 환각 금지 | 원문에 없는 내용 생성 절대 불가 |
| 구조 보존 | 기존 table, ul/ol, heading 레벨 유지 |
| temperature 0.1 | 창의적 변형 최소화, 원문 충실도 극대화 |

### 3.4 후처리 및 검증

| 단계 | 함수 | 설명 |
|------|------|------|
| HTML 추출 | `extractHtmlFromResponse()` | AI 응답에서 HTML과 JSON 블록 분리 |
| 마커 처리 | `applyHasMarkerClass()` | 원문 기호가 있는 `<li>`에 `has-marker` CSS 클래스 적용 |
| KV 채움 | `tryApplyKvJson()` | JSON 블록에서 KV 필드 자동 채움 |
| 원문 검증 | `verifyConversion()` | 텍스트 매칭률, 환각, 핵심 데이터 누락 검사 → 등급 부여 (A/B/C/F) |

### 3.5 관련 함수 (js/app.js)

| 함수 | 역할 |
|------|------|
| `handleConvert()` | 변환 트리거, Progress UI 표시 |
| `buildConversionPrompt()` | 원문 + 시스템 지시사항 → AI 프롬프트 조립 |
| `callAI()` | 프로바이더 자동 라우팅 (Claude/OpenAI/Gemini) |
| `extractHtmlFromResponse()` | AI 응답에서 HTML 블록 추출 |
| `tryApplyKvJson()` | AI 응답에서 KV JSON 파싱 |
| `verifyConversion()` | 로컬 텍스트 비교 → 실패 시 AI 상세 분석 |

---

## 4. 브라우저 측 변환 (fileExtractor.js)

### 4.1 지원 포맷

| 포맷 | CDN 라이브러리 | 보존 항목 |
|------|---------------|----------|
| DOCX | mammoth.js 1.6.0 | 단락, 볼드/이탤릭, 테이블, 리스트, 이미지(인라인) |
| XLSX/XLS | SheetJS 0.20.2 | HTML 테이블, 시트명, 셀 값 |
| PDF | pdf.js 3.11.174 | 텍스트, 페이지 구분 |
| HWPX | JSZip (내장) | 텍스트 (hp:t 태그 추출) |
| HWP | hwp.js (CDN) | 텍스트 (제한적) |
| TXT/CSV/HTML | 내장 파서 | 원본 텍스트/마크업 |

### 4.2 CDN 라이브러리 로드 (index.html)

```html
<!-- mammoth.js: Word 문서 변환 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>

<!-- SheetJS: Excel 파일 변환 -->
<script src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"></script>

<!-- pdf.js: PDF 파일 변환 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
</script>
```

### 4.3 extractFromFile() API

```javascript
export async function extractFromFile(file)
// file: File 객체
// Returns: { html, text, metadata }
// Throws: Error (변환 실패 시)
```

내부 라우팅:
```javascript
switch (extension) {
  case 'docx': return extractDocx(file);    // mammoth
  case 'xlsx':
  case 'xls':  return extractExcel(file);   // SheetJS
  case 'pdf':  return extractPdf(file);     // pdf.js
  case 'hwp':  return extractHwp(file);     // hwp.js
  case 'hwpx': return extractHwpx(file);    // JSZip XML 파싱
  case 'txt':  return extractText(file);
  case 'csv':  return extractCsv(file);
  case 'html':
  case 'htm':  return extractHtml(file);
}
```

### 4.4 HWPX 추출 로직 (신규 추가)

```javascript
async function extractHwpx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // 1. ZIP 시그니처 확인 (PK\x03\x04)
  // 2. JSZip으로 ZIP 해제
  // 3. section*.xml 파일 찾기
  // 4. <hp:t> 태그에서 텍스트 추출
  // 5. 폴백: 모든 XML에서 일반 텍스트 추출
}
```

### 4.5 유틸리티 함수

```javascript
export function getSupportedExtensions()
// → ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'html', 'htm', 'csv', 'rtf']

export function getFileTypeLabel(ext)
// → 'PDF' | 'HWP' | 'HWPX' | 'DOCX' | ...

export function getFileTypeColor(ext)
// → '#dc2626' (PDF) | '#2b7ce9' (HWPX) | ...
```

---

## 5. 백엔드 변환 서버 (convert-server.py)

### 5.1 기본 사양

| 항목 | 값 |
|------|-----|
| 포트 | `localhost:8082` (인자로 변경 가능) |
| 프레임워크 | Flask (설치 시) / 표준 라이브러리 (폴백) |
| CORS | 모든 오리진 허용 |

### 5.2 엔드포인트

```
GET  /health        → { status: 'ok', formats: [...] }
POST /api/convert   → { html, text, metadata }
     Content-Type: multipart/form-data
     Body: file=<binary>
```

### 5.3 의존성

```bash
pip3 install flask python-docx openpyxl pdfplumber
```

| 패키지 | 용도 | 필수 여부 |
|--------|------|----------|
| flask | HTTP 서버 | 권장 (없으면 stdlib 서버 사용) |
| python-docx | DOCX 변환 | 해당 포맷 사용 시 |
| openpyxl | XLSX 변환 | 해당 포맷 사용 시 |
| pdfplumber | PDF 변환 | 해당 포맷 사용 시 |

### 5.4 포맷별 변환기

#### 5.4.1 DOCX (python-docx)

보존 항목:
- 단락 스타일: Heading 1-3 → `<h1>`-`<h3>`, List → `<li>`, 기본 → `<p>`
- 인라인 서식: bold → `<strong>`, italic → `<em>`, underline → `<u>`
- 테이블: 행/열 구조 보존, 첫 행 `<th>` 처리

```python
def convert_docx(data, filename='')
# → { html, text, metadata: { paragraphs, tables, warnings } }
```

#### 5.4.2 DOC (textutil)

macOS `textutil` 사용:
```bash
textutil -convert html -output output.html input.doc
```

폴백: 바이너리에서 인쇄 가능 텍스트 추출 (한글/영문)

```python
def convert_doc(data, filename='')
# → { html, text, metadata: { warnings } }
```

#### 5.4.3 XLSX/XLS (openpyxl)

처리:
- 모든 시트 순회 (다중 시트 → `<h3>` 시트명 + `<table>`)
- 빈 행 건너뛰기
- 첫 행 `<th>` 처리

```python
def convert_xlsx(data, filename='')
# → { html, text, metadata: { sheets: [...], warnings } }
```

#### 5.4.4 PDF (pdfplumber)

처리:
- 테이블 우선 추출 (`extract_tables()`)
- 나머지 텍스트 추출 (`extract_text()`)
- 제목 감지: 40자 미만 + 마침표/쉼표 없음 → `<h3>`
- 50페이지 제한 (초과 시 경고)

```python
def convert_pdf(data, filename='')
# → { html, text, metadata: { pages, warnings } }
```

#### 5.4.5 HWP (hwp5 + textutil + 바이너리 폴백)

3단계 폴백:
1. `hwp5` 라이브러리 → `hwp5html` 명령어
2. macOS `textutil -convert html`
3. 바이너리 텍스트 추출 (UTF-16LE → 인쇄 가능 문자 필터링)

```python
def convert_hwp(data, filename='')
# → { html, text, metadata: { warnings } }
```

#### 5.4.6 HWPX (ZIP XML 파싱)

처리:
1. `zipfile.ZipFile`로 해제
2. `section*.xml` 파일 탐색
3. `<hp:t>` 태그에서 텍스트 추출
4. 폴백: `<t>` 또는 `<text>` 태그
5. 최종 폴백: 바이너리 텍스트 추출

```python
def convert_hwpx(data, filename='')
# → { html, text, metadata: { warnings } }
```

#### 5.4.7 TXT / CSV / HTML

| 포맷 | 처리 |
|------|------|
| TXT | 줄 → `<p>`, 빈 줄 → `<br>` |
| CSV | `csv.reader` → `<table>` (첫 행 `<th>`) |
| HTML/HTM | `<body>` 내용 추출, 없으면 전체 사용 |

### 5.5 stdlib 폴백 서버

Flask 미설치 시 `http.server.HTTPServer` + `cgi.FieldStorage`로 동일 API 제공.

```python
def run_stdlib_server(port)
# ConvertHandler(BaseHTTPRequestHandler) 기반
# do_GET: /health
# do_POST: /api/convert (multipart 파싱)
```

### 5.6 바이너리 텍스트 추출 유틸리티

```python
def extract_text_from_binary(data):
    # 1. UTF-16LE 디코딩 시도 (HWP)
    # 2. UTF-8 폴백
    # 3. 인쇄 가능 문자만 보존 (ASCII + 한글)
    # 4. 3개 이상 연속 공백 → 줄바꿈으로 변환
```

---

## 6. UI 통합

### 6.1 파일 입력 (index.html)

```html
<input type="file" id="ai-file-input"
  accept=".pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.txt,.html,.htm,.csv,.rtf"
  class="hidden">
```

### 6.2 handleFileAttach 흐름 (app.js)

```
파일 선택/드롭
    │
    ▼
확장자 판별
    │
    ├─ txt/html/csv → file.text() (직접 읽기)
    │
    └─ 바이너리 파일 (pdf, docx, hwp 등)
         │
         ▼
    extractFromFile(file) 호출
         │
         ├─ 성공 → 결과 html/text 사용
         │
         └─ 실패 → extractViaBackend(file) 폴백
                    │
                    ├─ 성공 → 결과 사용
                    │
                    └─ 실패 → 에러 메시지 표시
```

### 6.3 extractViaBackend()

```javascript
async function extractViaBackend(file) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('http://localhost:8082/api/convert', {
    method: 'POST',
    body: formData
  });
  if (!resp.ok) throw new Error(`서버 변환 실패 (${resp.status})`);
  return resp.json();
}
```

### 6.4 결과 적용

```javascript
// HTML이 있으면 에디터에 로드
if (result.html) {
  elements.sourceEditor.innerHTML = result.html;
  state.sourceContent = result.html;
  updateLivePreview();
}
// 텍스트는 AI 채팅 컨텍스트로 사용
attachedFileText = result.text || stripHtml(result.html);
```

---

## 7. 에러 핸들링

| 상황 | 1차 시도 | 2차 폴백 | 최종 |
|------|----------|---------|------|
| DOCX CDN 미로드 | mammoth.js | convert-server.py | 에러 메시지 |
| PDF CDN 미로드 | pdf.js | convert-server.py | 에러 메시지 |
| HWP (브라우저) | hwp.js | convert-server.py | 바이너리 텍스트 추출 |
| HWPX | JSZip XML | convert-server.py | 바이너리 텍스트 추출 |
| DOC | - | convert-server.py (textutil) | 바이너리 텍스트 추출 |
| 백엔드 미실행 | 브라우저 라이브러리만 | - | 에러 + 안내 메시지 |
| 지원하지 않는 포맷 | - | - | 지원 포맷 목록 표시 |
| 파일 크기 초과 | - | - | 크기 제한 안내 |

---

## 8. 실행 방법

### 8.1 브라우저 전용 (CDN 라이브러리만)

별도 서버 없이 DOCX, XLSX, PDF, HWPX, TXT, CSV, HTML 변환 가능.

### 8.2 백엔드 서버 포함 (전체 기능)

```bash
# 의존성 설치
pip3 install flask python-docx openpyxl pdfplumber

# 서버 실행
python3 convert-server.py        # 기본 포트 8082
python3 convert-server.py 9090   # 커스텀 포트
```

### 8.3 Flask 없이 실행

```bash
# 표준 라이브러리 서버로 자동 폴백
python3 convert-server.py
# → "Flask not found — using stdlib HTTP server"
```

### 8.4 지원 포맷 확인

```bash
curl http://localhost:8082/health
# → { "status": "ok", "formats": ["txt", "html", "htm", "csv", "docx", "xlsx", "xls", "pdf", "hwp", "hwpx", "doc"] }
```

---

## 9. 포맷별 변환 품질

| 포맷 | 텍스트 | 테이블 | 서식 | 이미지 | 비고 |
|------|--------|--------|------|--------|------|
| DOCX | A | A | A | B | mammoth.js 최고 품질 |
| XLSX | A | A | - | - | SheetJS 완벽 지원 |
| PDF | B | B | C | - | 테이블 인식 한계 |
| HWPX | B | C | D | - | XML 태그 기반 추출 |
| HWP | C | D | D | - | 바이너리 포맷 한계 |
| DOC | B | B | B | - | textutil (macOS 전용) |
| CSV | A | A | - | - | 표준 파서 |
| TXT | A | - | - | - | 원본 보존 |

(A: 우수, B: 양호, C: 보통, D: 제한적)

---

## 10. 향후 확장

- OCR 지원: 스캔 PDF에 Tesseract 연동
- 셀 병합 지원: Excel/Word 테이블 colspan/rowspan 보존
- HWP 전용 파서: 한컴 OLE 구조 직접 파싱
- 멀티시트 선택 UI: Excel 다중 시트 선택 모달
- 진행률 표시: 대용량 파일 변환 시 프로그레스 바
- 이미지 추출: DOCX/PDF 내장 이미지 → base64 인라인

---

*Created: 2026-02-07*
*Status: 구현 완료 (Phase 2)*
