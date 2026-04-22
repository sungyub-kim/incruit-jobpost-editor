# Plan: URL Extractor (채용공고 URL 추출기)

> 채용공고 URL에서 콘텐츠를 자동 추출하여 에디터에 로드하는 앱 내장 모듈

---

## 1. 개요

### 1.1 기능명
**URL Extractor** - 채용공고 URL 콘텐츠 추출 서비스

### 1.2 목적
채용공고 URL(인크루트 및 외부 ATS 플랫폼)을 입력하면 해당 페이지에서 채용 정보만 추출하여 에디터 원문 영역에 자동 로드한다. 복사-붙여넣기 없이 URL만으로 작업을 시작할 수 있도록 워크플로우를 간소화한다.

### 1.3 방식
앱 내장 방식 (별도 슬래시 커맨드가 아닌, 앱 UI에 통합)

### 1.4 관련 파일

| 파일 | 유형 | 역할 |
|------|------|------|
| `js/services/urlExtractor.js` | 신규 생성 | URL 추출 핵심 로직 |
| `cors-proxy.py` | 신규 생성 | CORS 우회 로컬 프록시 서버 |
| `js/app.js` | 수정 | URL 감지, 추출 호출, 모달 연동 |
| `index.html` | 수정 | URL 분석 버튼, 추출 프리뷰 모달 |
| `css/styles.css` | 수정 | 추출 모달 스타일 |

---

## 2. 아키텍처

```
사용자 입력 (URL)
       │
       ▼
┌─────────────────────┐
│  js/app.js          │
│  handleAiSend()     │
│  - URL 패턴 감지     │
│  - extractUrlsFromText() │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  urlExtractor.js    │
│  extractFromUrl()   │
│  - 5단계 추출 전략   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌─────────────────────┐
│  fetchViaProxy()    │ ───▶ │  cors-proxy.py      │
│  (브라우저 fetch)    │      │  localhost:8787     │
└─────────────────────┘      │  /proxy?url=...     │
                             └──────────┬──────────┘
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │  대상 웹사이트       │
                             │  (인크루트, ATS 등)  │
                             └─────────────────────┘
```

---

## 3. 핵심 컴포넌트

### 3.1 urlExtractor.js

#### 3.1.1 Public API

```javascript
// 단일 URL 추출
export async function extractFromUrl(url, options = {})
// → { html, text, metadata, confidence, warnings }

// 복수 URL 배치 추출
export async function extractFromUrls(urls, onProgress)
// → Array<{ url, html, text, metadata, confidence, warnings, error }>

// URL 타입 감지
export function detectUrlType(url)
// → 'incruit-popup' | 'incruit-desktop' | 'incruit-mobile' | 'incruit' | 'ats-known' | 'external' | 'unknown'

// 텍스트에서 URL 추출
export function extractUrlsFromText(text)
// → string[]

// URL 유효성 검사
export function isValidUrl(str)
// → boolean

// 캐시된 패턴 조회
export function getCachedPatterns()
// → { [domain]: { lastSuccess, confidence, count } }
```

#### 3.1.2 5단계 추출 전략

추출은 신뢰도 기반으로 순차 시도하며, 충분한 신뢰도에 도달하면 하위 전략을 건너뛴다.

| 순서 | 전략 | 신뢰도 | 조건 |
|------|------|--------|------|
| 1 | **Schema.org JSON-LD** | 90 | `JobPosting` 타입의 JSON-LD 존재 |
| 2 | **플랫폼별 셀렉터** | 80 | PLATFORM_PARSERS에 매칭되는 도메인 |
| 3 | **OpenGraph 메타태그** | 40 | `og:description` 100자 이상 |
| 4 | **Readability 범용 추출** | 35-55 | nav/ads/footer 제거 후 최대 콘텐츠 블록 |
| 5 | **폴백** | 0-30 | body 텍스트 직접 사용 |

#### 3.1.3 플랫폼별 파서 설정 (PLATFORM_PARSERS)

```javascript
// 한국 플랫폼
'job.incruit.com'           // 인크루트 데스크톱
'm.incruit.com'             // 인크루트 모바일
'team.greeting.com'         // Greeting
'career.rememberapp.co.kr'  // Remember Career
'www.rocketpunch.com'       // Rocketpunch
'www.jumpit.co.kr'          // Jumpit
'www.wanted.co.kr'          // Wanted

// 글로벌 ATS
'jobs.lever.co'             // Lever
'boards.greenhouse.io'      // Greenhouse
```

각 파서에 포함된 설정:
- `name`: 플랫폼 표시명
- `selectors[]`: 콘텐츠 셀렉터 (우선순위 순)
- `metaSelectors`: 제목/회사명 추출 셀렉터
- `cleanup[]`: 제거할 요소 셀렉터 (광고, 네비게이션 등)
- `useJsonLd`: JSON-LD 파싱 활성화 여부
- `jsonPath`: Next.js 데이터 경로 (Wanted 등)

#### 3.1.4 인크루트 전용 셀렉터

```javascript
// 데스크톱 (job.incruit.com)
'#divContent', '#content_area', '.job_post_detail',
'#divJobPostDetail', '.jobcompany_info .conts .job_info_detail',
'.detail_info_area'

// 모바일 (m.incruit.com)
'.c-r-tab-body .contents', '.c-r-tab-body',
'.job_post_area', '.job_detail_content', '#tab1'
```

#### 3.1.5 HTML 정제 (sanitizeExtractedHtml)

DOMPurify 사용 시 허용 태그:
```
h1-h6, p, br, hr, div, span, ul, ol, li, dl, dt, dd,
table, thead, tbody, tfoot, tr, th, td, caption, colgroup, col,
strong, b, em, i, u, s, sub, sup, a, img, blockquote, pre, code
```

추가 정제:
- 빈 태그 제거
- 연속 `<br>` 3개 이상 → 2개로 축소
- 연속 개행 3줄 이상 → 2줄로 축소

#### 3.1.6 출력 형식

```javascript
{
  html: '<div>...</div>',          // 정제된 HTML
  text: '...',                      // 플레인 텍스트
  metadata: {
    title: '채용공고 제목',
    company: '회사명',
    location: '근무지',
    salary: '급여',
    source: 'incruit-popup',        // detectUrlType() 결과
    url: 'https://...'              // 원본 URL
  },
  confidence: 85,                   // 추출 품질 점수 (0-100)
  warnings: []                      // 경고 메시지 배열
}
```

### 3.2 cors-proxy.py

#### 3.2.1 기본 사양

| 항목 | 값 |
|------|-----|
| 포트 | `localhost:8787` (인자로 변경 가능) |
| 의존성 | Python 표준 라이브러리만 사용 |
| 모듈 | `http.server`, `urllib`, `ssl`, `json` |

#### 3.2.2 엔드포인트

```
GET  /health              → { status: 'ok' }
GET  /proxy?url=<target>  → 대상 URL 응답 포워딩
POST /proxy?url=<target>  → 바디/헤더 포함 포워딩
OPTIONS /proxy            → CORS preflight 응답 (204)
```

#### 3.2.3 동작 방식

1. 브라우저 → 프록시 요청 수신
2. `url` 파라미터에서 대상 URL 추출
3. 요청 헤더 포워딩 (hop-by-hop 제외: Host, Connection, Accept-Encoding, Transfer-Encoding)
4. User-Agent 기본값 자동 설정 (Chrome 브라우저 UA)
5. POST 바디 포워딩
6. 대상 서버 응답을 CORS 헤더 추가하여 브라우저에 전달

#### 3.2.4 CORS 헤더

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Expose-Headers: *
Access-Control-Max-Age: 86400
```

#### 3.2.5 보안

- `ALLOWED_DOMAINS` 화이트리스트 정의 (현재 미적용 — 로컬 전용)
- 필요 시 주석 해제하여 도메인 제한 가능
- SSL 인증서 검증 비활성화 (로컬 프록시 전용)
- localhost 바인딩 (외부 접근 차단)

---

## 4. UI 통합

### 4.1 URL 분석 퀵 액션 버튼

```html
<button class="ai-quick-btn" data-action="url-analyze">URL 분석</button>
```

- 클릭 시 채팅 입력창에 포커스
- 안내 메시지 표시: "URL을 입력하세요"

### 4.2 URL 자동 감지 (app.js handleAiSend)

채팅 입력 시 URL 패턴을 자동 감지하여 추출 모드로 전환:

```javascript
const detectedUrls = extractUrlsFromText(content);
if (detectedUrls.length > 0 && !attachedFileText) {
  await handleUrlExtraction(detectedUrls);
  return;
}
```

### 4.3 추출 프리뷰 모달

모달 구성:
- **메타데이터 영역**: 제목, 회사명, 출처, URL
- **경고 메시지**: warnings 배열 표시
- **콘텐츠 미리보기**: 추출된 HTML 렌더링
- **복수 URL 탭**: 여러 URL 결과 탭 전환
- **진행률 바**: 배치 추출 시 진행률 표시
- **신뢰도 배지**: confidence 값에 따른 색상 표시
- **액션 버튼**: 취소 / 다시 추출 / 이 내용으로 계속

### 4.4 신뢰도 배지

| 범위 | 색상 | 표시 |
|------|------|------|
| 80-100 | 초록 (#22c55e) | 높음 |
| 50-79 | 노랑 (#eab308) | 보통 |
| 0-49 | 빨강 (#ef4444) | 낮음 |

### 4.5 "이 내용으로 계속" 동작

1. 추출된 HTML → `sourceEditor.innerHTML`에 설정
2. `state.sourceContent` 업데이트
3. `updateLivePreview()` 호출
4. 모달 닫기
5. 성공 메시지 표시

---

## 5. 캐싱

### 5.1 구현

- 저장소: `localStorage`
- 키: `url_extract_patterns`
- 만료: 30일

### 5.2 캐시 구조

```javascript
{
  "job.incruit.com": {
    "lastSuccess": 1707321600000,
    "confidence": 85,
    "count": 12
  }
}
```

### 5.3 캐시 관리

- `cachePattern(url, confidence)`: 추출 성공 시 자동 저장
- `getCachedPatterns()`: 조회 시 만료 항목 자동 정리

---

## 6. 에러 핸들링

| 상황 | 처리 |
|------|------|
| CORS 프록시 미실행 | 프록시 시작 안내 메시지 (`python3 cors-proxy.py`) |
| 네트워크 타임아웃 | 15초 기본 타임아웃, 에러 메시지 표시 |
| 추출 실패 | warnings 배열에 메시지 추가, 모달에서 확인 가능 |
| 낮은 신뢰도 (<50) | 빨강 배지 + "원문 직접 입력" 안내 |
| 짧은 콘텐츠 (<300자) | 신뢰도 30 이하로 제한 + 경고 |
| 지원하지 않는 URL | `external` 타입으로 범용 추출 시도 |

---

## 7. 실행 방법

### 7.1 CORS 프록시 시작

```bash
python3 cors-proxy.py        # 기본 포트 8787
python3 cors-proxy.py 9090   # 커스텀 포트
```

### 7.2 사용 방법

1. CORS 프록시 실행
2. 브라우저에서 앱 열기 (`localhost:8081` 등)
3. AI 채팅 입력창에 채용공고 URL 입력 (또는 "URL 분석" 버튼 클릭)
4. 추출 프리뷰 모달에서 결과 확인
5. "이 내용으로 계속" 클릭하여 에디터에 로드

### 7.3 테스트 URL 예시

```
https://job.incruit.com/jobdb_info/popupjobpost.asp?job=2601300001893
https://m.incruit.com/job/jobdb_info/jobpost.asp?job=2601300001893
```

---

## 8. 향후 확장 (Phase 4)

- ATS 플랫폼 파서 확장 (Workday, Ashby 등)
- 성공한 새 패턴 자동 학습/저장
- AI 기반 콘텐츠 식별 (신뢰도 < 50일 때 AI에 구조 분석 위임)
- 추출 결과 diff 비교 (재추출 시 변경점 하이라이트)

---

*Created: 2026-02-07*
*Status: 구현 완료 (Phase 1)*
