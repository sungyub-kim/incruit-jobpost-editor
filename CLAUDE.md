# CLAUDE.md - Incruit Jobpost Editor

> 이 파일은 Claude Code가 프로젝트 작업 시 참조하는 강화학습 문서입니다.
> 대화에서 발생한 모든 결정사항, 버그 수정, 패턴, 규칙을 기록합니다.

---

## 프로젝트 개요

- **이름**: 인크루트 채용공고 에디터 (Incruit Jobpost Editor)
- **목적**: 채용공고 원문을 인크루트 HTML 템플릿으로 변환하고, 키비주얼(KV) 이미지를 자동 생성하는 웹 도구
- **기술 스택**: Vanilla JS (ES6 modules), Tailwind CSS (CDN), Python 표준라이브러리 (CORS proxy)
- **프레임워크**: 없음 (No React, No Vue, No build tools)
- **서버**: 정적 파일 + Python CORS proxy (localhost:8787)

---

## 아키텍처 결정 사항

### 1. CORS 프록시 패턴
- Anthropic API는 브라우저 직접 호출 시 CORS를 차단함
- **해결**: `cors-proxy.py` (Python stdlib, port 8787)를 경유
- **이중 경로**: 프록시 헬스체크 성공 → 프록시 경유 / 실패 → 직접 호출 (fallback)
- **필수 헤더**: 브라우저 직접 호출 시 `anthropic-dangerous-direct-browser-access: true` 필요
- **프록시 헤더 정리**: 프록시는 서버→서버 요청이므로 `anthropic-dangerous-direct-browser-access`, `origin`, `referer` 를 skip_headers에 포함하여 제거

```javascript
// 프록시 이중 경로 패턴
try {
  const h = await fetch('http://localhost:8787/health', { signal: AbortSignal.timeout(2000) });
  url = h.ok ? proxyBase + encodeURIComponent(targetUrl) : targetUrl;
} catch {
  url = targetUrl;
}
```

### 2. Anthropic API 버전
- **유효한 버전**: `2023-06-01` (최신이자 유일한 유효 버전)
- **주의**: `2025-01-01` 등 존재하지 않는 버전을 사용하면 "not a valid version" 에러 발생
- **출처**: https://docs.anthropic.com/en/api/versioning

### 3. AI API 에러 처리
- CORS 프록시는 API 에러 응답을 **원본 그대로** 전달 (body + Content-Type)
- 래핑하지 않음 (과거 `{ error, body }` 형태로 래핑했다가 클라이언트 파싱 문제 발생)
- 401 인증 에러 시 사용자 친화적 메시지: "Claude API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요."

### 4. 원본 소스 보존 패턴
- 3단계: state.originalSource (메모리) → localStorage (영속) → UI 탭 (원본/편집 전환)
- 모든 입력 지점에서 `saveOriginalSource()` 호출: paste, file attach, URL extract

### 5. HWP 변환 파이프라인
- **문제**: HWP는 독점 바이너리 포맷으로 브라우저에서 테이블 구조 추출 불가
- **해결**: LibreOffice `soffice --headless`로 HWP → DOCX 변환 후 python-docx로 HTML 추출
- **변환 우선순위** (convert-server.py):
  1. LibreOffice → DOCX → python-docx (테이블 완벽 보존)
  2. hwp5 라이브러리 (설치 시)
  3. macOS textutil
  4. 바이너리 텍스트 추출 (테이블 소실)
- **클라이언트 우선순위** (app.js):
  - HWP/HWPX: **백엔드 우선** → 브라우저 폴백 (다른 파일은 브라우저 우선)
- **서버 요건**: LibreOffice 설치 필요 (Docker 컨테이너 또는 VPS)
  - 서버리스(Vercel, Cloudflare, Firebase Functions)에서는 실행 불가
  - 적합 호스팅: Railway, Render, Cloud Run, VPS
- **health 엔드포인트**: `GET /health` → `{ libreoffice: path|false, hwp_table_support: bool }`
- **Python 3.13 호환**: `cgi` 모듈 제거됨 → `parse_multipart()` 수동 구현

```
HWP 파일 업로드 흐름:
브라우저 → POST /api/convert (convert-server:8082)
         → soffice --headless --convert-to docx
         → python-docx → <table> HTML
         → JSON 응답 { html, text, metadata }
```

### 6. EUC-KR 인코딩 처리
- **프록시**: 응답 바이트를 EUC-KR → UTF-8 자동 변환 (Content-Type charset 감지)
- **클라이언트**: `fetchViaProxy()`에서 TextDecoder('euc-kr') fallback
- 한국 채용사이트(인크루트, 잡코리아 등)는 EUC-KR 페이지가 많음

---

## 핵심 기능별 학습

### URL 추출 (urlExtractor.js)
- **플랫폼별 파서**: 인크루트, 잡코리아, 사람인, 원티드, 뉴워커 각각 전용 파서
- **iframe 추출**: 잡코리아(`GI_Read_Comt_Ifrm`), 사람인(`view-detail`), 인크루트(`jobpostcont.asp`)
- **원티드**: `__NEXT_DATA__` JSON에서 직접 추출 (Next.js SSR)
- **뉴워커**: `[id^="jobContent_"]` 셀렉터로 직접 추출 (인크루트 계열 단기알바)
- **AI 동적 파서**: 미지의 URL → `analyzePageStructure()` → AI 분석 → `registerDynamicParser()` → 자동 재추출
- **쿠키 배너 제거**: `removeCookieBanners()` — 셀렉터 기반 + 텍스트 휴리스틱
  - 주요 SDK: OneTrust, TrustArc, Cookiebot
  - 한국 패턴: `[class*="privacy-popup"]`, `[class*="개인정보"]`
  - 스타일 감지: `position:fixed/sticky` + 쿠키 관련 텍스트 + 500자 미만

### 문서 변환 (fileExtractor.js)
- **이중 레이어**: 브라우저 CDN (mammoth.js, SheetJS, pdf.js, JSZip) + 백엔드 fallback (convert-server.py)
- **지원 형식**: PDF, DOCX, XLSX, HWP/HWPX, HTML, TXT, CSV, RTF
- **HWP 특별 처리**: HWP/HWPX는 백엔드(LibreOffice) 우선 → 브라우저 폴백
  - 변환 경로: HWP → LibreOffice(soffice --headless) → DOCX → python-docx → HTML (테이블 보존)
  - LibreOffice 미설치 시: hwp5 → textutil → 바이너리 텍스트 추출 (테이블 소실)
- **테이블 보존 우선순위**: DOCX(최고) > XLSX > PDF(추론) > HWP(서버 필요)

### 키비주얼 (KV) 자동 생성
- AI 변환 시 프롬프트에 KV JSON 블록 생성 지시 포함
- `tryApplyKvJson()`: AI 응답에서 ```json 블록 파싱 → KV 필드 자동 채우기
- `tryAutoFillKvFromSource()`: 정규식 기반 텍스트 추출 (기업명, 공고번호, 마감일 등)
- **업종별 배경 이미지 자동 선택**: `pickBgImageByKeywords()` — 17개 업종 매핑
- **이미지 검색 키워드 자동 제안**: `suggestImageKeyword()` — 소스 텍스트 업종 감지 → 영어 키워드 자동 입력
- `extractHtmlFromResponse()`: ```json 블록 이전까지만 HTML로 추출

### KV 이미지 검색 API
- **검색 패널**: 키비주얼 탭 > "이미지 검색" 접이식 패널
- **키워드 자동 제안**: 패널 열 때 소스 텍스트에서 업종 감지 → `KV_SEARCH_KEYWORDS` 매핑 → 영어 키워드 자동 입력
- **지원 소스 및 API 현황**:

| 서비스 | API 연동 | 무료 한도 | 비고 |
|--------|---------|----------|------|
| **Unsplash** | O (연동 완료) | 50요청/시간 | 고품질, 가로형 풍경/사무실 이미지 풍부 |
| **Pexels** | O (연동 완료) | 200요청/시간 | 다양한 카테고리 |
| **Pixabay** | △ (추가 가능) | 100요청/분 | 공개 API 있음, 미연동 |
| 클립아트코리아 | X (연동 불가) | — | 공개 API 없음 (유료 스톡 서비스, 웹에서 직접 검색/다운로드만 가능) |

- **API 키 설정**: 설정 모달 > "이미지 검색 API 키" 섹션에서 Unsplash/Pexels 키 입력
- **다운로드 트래킹**: Unsplash 이미지 선택 시 API 가이드라인 준수 (`download_location` 호출)

### AI 변환 프롬프트 구조
```
블록1: 채용공고 HTML (순수 HTML, <h1>부터 시작)
블록2: 키비주얼 JSON (jobCode, title, description, date, companyName, industry)
```
- 원문 100% 보존 (글자 변경/추가/삭제 금지)
- 환각(hallucination) 절대 금지
- 기존 구조 요소 보존 (table, ul/ol, heading 레벨)

### Progress UI (Claude Code 스타일)
- `createProgressMessage()`: 단계별 실시간 표시
- 인크루트 favicon 아이콘 사용
- 6단계: 원문 읽기 → 프롬프트 구성 → API 호출 → HTML 추출 → 원문 보존 검증 → KV 초안 생성
- 스피너(spinning) → 체크마크(✓) / 실패(✗) + 소요시간 표시

### 복사 버튼
- **변환 완료 시**: HTML 복사, 미리보기 전체 복사, 키비주얼 복사 (3개 버튼 그룹)
- **코드 블록**: hover 시 우상단 📋 버튼
- `copyToClipboard()`: navigator.clipboard → textarea fallback
- "✓ 복사됨" 피드백 1.5초 후 복귀

---

## AI 기능 목록

### 현재 AI 기능

| # | 기능 | 트리거 | 핵심 함수 | 설명 |
|---|------|--------|-----------|------|
| 1 | **채용공고 변환** | "채용공고 변환" 버튼, 채팅 | `handleConvert()` → `callAI()` | 원문을 인크루트 HTML 템플릿으로 변환 |
| 2 | **변환 검증** | "검증하기" 버튼 | `verifyConversion()` | 로컬 텍스트 비교 → 실패 시 AI 상세 분석 |
| 3 | **KV JSON 자동 추출** | 변환 완료 후 자동 | `tryApplyKvJson()` | AI 응답의 JSON 블록에서 KV 필드 채우기 |
| 4 | **KV 원문 자동 채우기** | "키비주얼 추가" 버튼 | `tryAutoFillKvFromSource()` | 정규식으로 기업명/공고명/마감일 추출 |
| 5 | **업종별 배경 선택** | 자동 채우기 시 자동 | `pickBgImageByKeywords()` | 17개 업종 키워드 → Unsplash 이미지 매칭 |
| 6 | **일반 채팅** | 채팅 입력 | `handleAiSend()` → `callAI()` | 자유 대화 (짧은 질문/요청) |
| 7 | **API 연결 테스트** | 설정 모달 | `testProviderConnection()` | API 키 유효성 확인 |
| 8 | **모델 목록 조회** | 설정 모달 | `fetchAndRenderModels()` | API에서 사용 가능한 모델 실시간 조회 |

### AI 기능 흐름도

```
문서(파일/URL) → 원문 추출 → 원문 영역 표시
                                    ↓
                         [채용공고 변환 버튼]
                                    ↓
              buildConversionPrompt() → callAI()
                                    ↓
                            AI 응답 수신
                           ↙            ↘
              extractHtmlFromResponse()   tryApplyKvJson()
                     ↓                        ↓
              미리보기/코드 표시           KV 필드 자동 채움
                     ↓
              verifyConversion()
                     ↓
              검증 결과 표시
```

---

## 버그 수정 이력

### 1. "Failed to fetch" (HTML 파일 첨부 + 변환)
- **원인**: `callClaude()`가 `api.anthropic.com`을 직접 호출 → 브라우저 CORS 차단
- **수정**: CORS 프록시 헬스체크 후 경유하도록 변경

### 2. 원시 JSON 에러 표시
- **원인**: cors-proxy.py가 API 에러를 `{ error, body }` 형태로 래핑
- **수정**: 원본 에러 body + Content-Type을 그대로 전달

### 3. "anthropic-version: 2025-01-01 is not a valid version"
- **원인**: 존재하지 않는 API 버전 사용
- **수정**: 모든 위치를 `2023-06-01`로 변경 (5곳: app.js 4곳 + aiService.js 1곳)

### 4. "CORS requests must set 'anthropic-dangerous-direct-browser-access' header"
- **원인**: Anthropic API 브라우저 직접 호출 시 필수 헤더 누락
- **수정**: 모든 Anthropic API 호출 지점에 헤더 추가 (5곳)

### 5. 미리보기/다운로드 테이블 클래스 불일치
- **원인**: `applyIncruitTableClasses()`(문자열 기반)는 다운로드용에만 적용, 미리보기 DOM에는 미적용 → 미리보기와 다운로드 결과 불일치
- **수정**: DOM 기반 `applyIncruitTableClassesToDom()` 추가하여 `updatePreview()` 시점에 적용
- **추가 수정**: 문자열 기반 함수에 `table_type` 중복 체크 + `width="100%" border="1"` 속성 강제 적용

### 6. 미리보기/다운로드/복사 HTML 구조 불일치
- **원인**: 미리보기는 `wrapInV3Sections()` (DOM 기반), 다운로드는 `detectSectionsFromHtml()` (문자열 기반)으로 각각 독립적으로 HTML을 생성하여 섹션 래핑, 테이블 클래스, 마커 처리, 인라인 편집 반영이 모두 달랐음
- **차이 항목**: data-hr-property 무시, "채용개요" 유령 섹션 추가, 제목 번호 제거 방식, fixDoubleMarkers 미적용, 인라인 편집 무시 (총 6가지)
- **수정**: **미리보기 DOM을 Single Source of Truth로 통일**
  - `generateFullHtml()`: `.templ_content` innerHTML을 미리보기 DOM에서 직접 추출 (편집용 속성 제거)
  - `copyResultData('html')`: `#templwrap_v3` outerHTML을 미리보기 DOM에서 직접 추출
  - 미리보기가 없는 경우 기존 `detectSectionsFromHtml()` 방식으로 폴백

---

## 용어 정의

| 용어 | 정의 | UI 위치 |
|------|------|---------|
| **문서** | 입력 소스 (첨부 파일 또는 URL) | 파일 첨부, URL 입력 |
| **원문** | 문서에서 추출한 채용공고 내용 (변환 전) | 원문 입력 영역 |
| **코드** | AI 변환 후 HTML 코드 | HTML 코드 탭 |
| **미리보기** | 변환된 HTML의 렌더링 결과 | 미리보기 탭 |
| **키비주얼(KV)** | 채용공고 배너 이미지 | 키비주얼 탭 |
| **프리셋** | KV 디자인 템플릿 | 프리셋 선택 영역 |

---

## 코딩 규칙

### 빌드 번호 관리 (필수)
- **위치**: `js/app.js` 상단 `APP_VERSION`, `APP_BUILD`, `APP_BUILD_DATE`
- **규칙**: **"배포해줘" 요청 시에만** `APP_BUILD` +1, `APP_BUILD_DATE` 당일 날짜로 갱신
- **코드 수정 중에는 절대 빌드 번호 건드리지 않음** — 배포 단위와 빌드 번호가 1:1 대응
- **표시 형식**: `v2.0 build N` (헤더, 크레딧 모달, 콘솔 로그)

### 배포 워크플로우 (빌드 업 시 필수)
- **빌드 번호 증가 + 커밋 후** 반드시 `scripts/deploy.sh`를 실행할 것
- 이 스크립트는 **git push + Dooray Task 자동 생성**을 수행
- 배포 플랫폼: Cloudflare Pages (GitHub push → 자동 배포)
- 배포 URL: https://incruit-jobpost-editor.pages.dev
- Dooray 프로젝트: incruit-jobpost-editor (ID: 4266990633799799451)
- 스크립트 위치: `scripts/deploy.sh`
- **기본 실행**: `bash scripts/deploy.sh` (커밋 완료 후)
- **관련 과제 댓글 포함**: `bash scripts/deploy.sh --reply 프로젝트ID/과제ID "댓글 내용"`
  - 배포 시 관련 Dooray 과제에 자동으로 답변 댓글을 등록
  - 댓글 하단에 배포 정보(버전, URL)가 자동 추가됨

### 파일 구조
```
/
├── index.html          # 메인 HTML (단일 페이지)
├── css/styles.css      # 스타일 (다크/라이트 모드)
├── js/
│   ├── app.js          # 메인 앱 로직 (모놀리식)
│   └── services/
│       ├── aiService.js      # AI API 호출
│       ├── urlExtractor.js   # URL에서 채용공고 추출
│       └── fileExtractor.js  # 파일에서 텍스트 추출
├── cors-proxy.py       # CORS 프록시 서버
├── convert-server.py   # 문서 변환 백엔드 (HWP→DOCX→HTML, LibreOffice)
└── docs/               # 설계/분석 문서
```

### JS 코딩 패턴
- **모듈**: ES6 `import`/`export` (type="module")
- **상태 관리**: `state` 객체에 중앙 집중 (localStorage 영속화)
- **DOM 참조**: `elements` 객체에 캐싱 (`document.getElementById`)
- **비동기**: `async/await` + `try/catch` (Promise chain 사용 금지)
- **에러 표시**: 사용자 친화적 한국어 메시지 (raw JSON/영어 에러 절대 노출 금지)

### CSS 패턴
- Tailwind CSS (CDN) + 커스텀 CSS (styles.css)
- CSS 변수: `--bg-primary`, `--text-primary`, `--accent-color` 등
- 다크 모드 기본, `:root[data-theme="light"]` 오버라이드

### 한국어 우선
- 모든 UI 텍스트는 한국어
- welcome 메시지: "안녕하세요! 채용공고 키비주얼을 만들어드릴게요."
- placeholder: "예: 인크루트 고객만족팀 고객만족담당자 채용공고 만들어줘"
- 에러 메시지도 한국어로 변환하여 표시

---

## AI 모델 설정

### 지원 모델
```javascript
AI_PROVIDERS = {
  claude: ['claude-sonnet-4-5-20250929'],
  openai: ['gpt-4o', 'gpt-4o-mini', ...],
  gemini: [
    'gemini-3.1-pro-preview',  // 최고성능
    'gemini-3-pro-preview',    // 이전 최고성능
    'gemini-3-flash-preview',  // 추천
    'gemini-2.5-pro',          // 안정
    'gemini-2.5-flash',        // 안정
    'gemini-2.5-flash-lite'    // 빠름
  ]
}
```

### API 호출 시 주의사항
- Claude: CORS 프록시 필수 + `anthropic-dangerous-direct-browser-access` 헤더
- Gemini: `generativelanguage.googleapis.com` 직접 호출 가능
- OpenAI: 직접 호출 가능

---

## CORS 프록시 (cors-proxy.py) 주의사항

- **포트**: 8787
- **타임아웃**: 60초
- **EUC-KR 자동 변환**: Content-Type charset 감지 → UTF-8 변환
- **skip_headers**: host, connection, accept-encoding, transfer-encoding, anthropic-dangerous-direct-browser-access, origin, referer
- **에러 전달**: HTTPError 시 원본 body + Content-Type 그대로 forward
- **재시작**: `pkill -f 'python3.*cors-proxy.py' && python3 cors-proxy.py &`
- **헬스체크**: `GET /health` → `{"status": "ok"}`

---

## 변환 서버 (convert-server.py) 주의사항

- **포트**: 8082
- **엔드포인트**: `POST /api/convert` (multipart/form-data), `GET /health`
- **LibreOffice 자동 감지**: macOS/Linux/Windows 경로 탐색 + PATH 검색
- **HWP 변환**: LibreOffice → DOCX → python-docx (4단계 폴백)
- **Python 3.13 호환**: `cgi` 모듈 대신 `parse_multipart()` 수동 파서 사용
- **Flask 선택적**: Flask 있으면 Flask, 없으면 stdlib HTTPServer
- **재시작**: `pkill -f 'python3.*convert-server.py' && python3 convert-server.py &`
- **의존성**: `pip3 install python-docx openpyxl pdfplumber` (선택: flask)

---

## 사용자 수정 파일 (되돌리지 말 것)

사용자가 직접 수정한 파일들은 절대 되돌리면 안 됩니다:
- `cors-proxy.py`: EUC-KR 자동 변환, timeout 60s
- `convert-server.py`: LibreOffice HWP→DOCX 파이프라인, multipart 파서
- `js/services/urlExtractor.js`: 잡코리아/사람인/원티드/뉴워커 파서, iframe 추출, EUC-KR 처리, AI 동적 파서
- `js/services/aiService.js`: 프록시 지원, 모델 설정

---

## Three Man Team

에이전트 기반 개발 워크플로우. 기획 → 개발 → 검수 3단계로 작업을 진행.

| 역할 | 파일 | 설명 |
|------|------|------|
| **기획자** (Architect) | 기획자.md | 스펙 작성, 개발자/검수자 지휘, 배포 승인 |
| **개발자** (Builder) | 개발자.md | 코드 구현, 셀프 리뷰 후 제출 |
| **검수자** (Reviewer) | 검수자.md | 코드 리뷰, 승인/반려 판단 |

Handoff files: `handoff/` 디렉토리 (ARCHITECT-BRIEF, BUILD-LOG, REVIEW-REQUEST, REVIEW-FEEDBACK, SESSION-CHECKPOINT)

세션 시작 프롬프트:
> You are 기획자 on incruit-jobpost-editor. Read CLAUDE.md, then 기획자.md.

---

## 향후 작업 시 참고

1. **새 AI 모델 추가**: `AI_PROVIDERS` 객체에 모델 ID와 이름 추가, default 플래그 설정
2. **새 채용사이트 파서 추가**: `PLATFORM_PARSERS` 객체에 hostname → parser 매핑, iframe URL 구성 함수 작성
3. **API 호출 추가**: 반드시 CORS 프록시 이중 경로 패턴 사용
4. **에러 메시지**: 항상 한국어, 사용자 친화적, raw 데이터 노출 금지
5. **KV 배경 이미지**: `KV_BG_IMAGES`에 업종 추가 시 Unsplash URL 사용 (w=800&q=80)
6. **스타일 추가**: 다크/라이트 모드 양쪽 모두 작성

---

## 변환 품질 보증

### API 파라미터 (정밀 변환용)
| 파라미터 | OpenAI | Claude | Gemini | 이유 |
|----------|--------|--------|--------|------|
| **temperature** | 0.1 | 0.1 | 0.1 | 창의적 변형 최소화, 원문 충실도 극대화 |
| **max_tokens** | 16,384 | 8,192 | 65,536 | 프로바이더별 최대치로 설정하여 잘림 방지 |

### 자동 이어쓰기 (Auto-continuation)
- **잘림 감지**: 각 프로바이더의 `finish_reason` 확인
  - OpenAI: `finish_reason === 'length'`
  - Claude: `stop_reason === 'max_tokens'`
  - Gemini: `finishReason === 'MAX_TOKENS'`
- **자동 재시도**: 잘림 감지 시 대화 이력에 이전 응답을 포함하여 최대 2회 이어쓰기
- **상태 추적**: `state.lastContinuations` (0=잘림 없음, 1-2=이어쓰기 횟수, -1=여전히 잘림)
- **진행 UI 표시**: 이어쓰기 발생 시 Step 3에 "(이어쓰기 N회)" 표시

### 품질 등급 시스템 (`verifyConversion()`)
| 등급 | 점수 | 의미 |
|------|------|------|
| 🟢 A | 95+ | 우수 — 원문 완벽 보존 |
| 🟡 B | 80-94 | 양호 — 사소한 차이 허용 |
| 🟠 C | 60-79 | 주의 — 일부 변경 가능성, 확인 필요 |
| 🔴 F | 0-59 | 실패 — 원문 훼손, 재변환 권장 |

### 감점 기준
- 텍스트 일치율 95% 미달: 미달 %당 1점
- 환각 1건당: 5점
- 핵심 데이터 누락 1건당: 10점 (전화번호/이메일/급여/날짜/URL)
- 테이블 셀 누락 1건당: 3점
- 테이블 완전 소실: 20점

### 검증 항목
1. **텍스트 완전성**: 문장 단위 1:1 대조 (80% 부분 매칭 포함)
2. **환각 감지**: 변환 결과에만 존재하는 새 문장 탐지
3. **구조 보존**: 테이블/리스트/제목 개수 비교
4. **테이블 셀 검증**: `<td>`/`<th>` 셀 내용 대조
5. **핵심 데이터**: 전화번호, 이메일, 급여, 날짜, URL 정규식 매칭

---

## AI 기능 개발 가이드

### 새 AI 기능 추가 시 따라야 할 패턴

#### 1. API 호출 패턴
```javascript
// callAI()를 통해 호출 (프로바이더 자동 라우팅)
const response = await callAI(prompt);
// 내부: openai → callOpenAI() / claude → callClaude() (프록시 경유) / gemini → callGemini()
```
- **필수**: `callAI()` 를 통해 호출 (프로바이더 직접 호출 금지)
- **Claude**: 반드시 CORS 프록시 이중 경로 패턴 사용
- **에러**: 한국어 사용자 친화적 메시지, raw JSON 노출 금지

#### 2. 프롬프트 구조 패턴
```javascript
function buildMyFeaturePrompt(input) {
  const parts = [];
  parts.push(`시스템 지시사항 (역할, 규칙, 제약)`);
  parts.push(`\n\n--- 입력 ---\n${sanitizeForAI(input)}`);
  parts.push(`\n\n--- 출력 형식 ---\n...`);
  return parts.join('');
}
```
- **필수**: 원문 보존 지시 (변경/추가/삭제 금지)
- **필수**: 환각(hallucination) 금지 명시
- **필수**: 입력은 `sanitizeForAI()` 로 정제

#### 3. Progress UI 패턴
```javascript
const progress = createProgressMessage();
const step1 = progress.addStep('단계 설명', '📋');
progress.completeStep(step1, '완료 상세');
progress.finalize('최종 요약');
```

#### 4. 응답 처리 패턴
```javascript
const html = extractHtmlFromResponse(response);  // HTML 부분
const kvData = tryApplyKvJson(response);          // JSON 부분
addMessage('assistant', formatMessage(response)); // 채팅에 표시
```

#### 5. 새 기능 추가 체크리스트
1. `js/app.js`에 함수 작성 (기존 패턴 따르기)
2. UI 트리거 추가 (버튼/채팅 명령)
3. 에러 메시지 한국어 작성
4. 다크/라이트 모드 CSS 대응
5. `CLAUDE.md` AI 기능 목록 테이블에 추가
6. Progress UI 적용 (2초 이상 걸리는 작업)
