# 인크루트 채용공고 에디터 — 종합 평가 보고서

> 작성일: 2026-02-13
> 평가 도구: Claude Code (Opus 4.6)
> 대상 브랜치: main (커밋 7c02ceb)

---

## 1. 프로젝트 개요 요약

| 항목 | 수치 |
|------|------|
| 총 소스 코드 | ~20,300줄 (핵심 파일 기준) |
| 메인 파일 (app.js) | **8,688줄 / 328KB** |
| CSS (styles.css) | 4,018줄 / 84KB |
| HTML (index.html) | 1,129줄 / 68KB |
| 서비스 모듈 | 6개 (aiService, urlExtractor, fileExtractor, ruleConverter, workspaceManager, fileService) |
| 백엔드 | 2개 (cors-proxy.py 247줄, convert-server.py 1,629줄) |
| 문서 | 12개 markdown 파일 + CLAUDE.md |
| 함수 수 (app.js) | **178개** |
| innerHTML 사용 | **119회** (전체 JS) |
| localStorage 접근 | **66회** |
| try/catch 블록 | **46개** (app.js) |

---

## 2. AI 에이전트 현황: 총 9개

### 2-1. `callAI()`를 호출하는 에이전트 (실제 AI 추론) — 7개

| # | 에이전트 | 트리거 | 프롬프트 빌더 | 위치 |
|---|---------|--------|-------------|------|
| 1 | **채용공고 변환** | "AI 변환 시작" 버튼 | `buildConversionPrompt()` | `app.js:4150` `handleConvert()` |
| 2 | **변환 검증** | "검증하기" 버튼 | 로컬 텍스트 비교 → 실패 시 AI 상세 분석 | `app.js:2241` `verifyConversion()` |
| 3 | **OCR 텍스트 추출** | 이미지 기반 공고 감지 시 자동 | `buildOcrMessages()` (Vision API 멀티모달) | `app.js:4764` `performOcrConversion()` |
| 4 | **동적 파서 생성** | 미지의 URL + confidence < 60 | `buildPageAnalysisPrompt()` | `app.js:7080` |
| 5 | **KV JSON 추출** | 채팅에서 KV 관련 요청 | `buildKvPrompt()` | `app.js:7451` |
| 6 | **일반 채팅** | 채팅 입력 (자유 대화) | 인라인 contextPrompt | `app.js:5157` |
| 7 | **채팅 내 변환/검증** | 채팅에서 "변환"/"검증" 키워드 | `buildConversionPrompt()` 재사용 | `app.js:6669` `handleAiSend()` |

### 2-2. API 호출하지만 추론이 아닌 에이전트 — 2개

| # | 에이전트 | 트리거 | 설명 | 위치 |
|---|---------|--------|------|------|
| 8 | **연결 테스트** | 설정 > "연결 테스트" 버튼 | API 키 유효성 확인 (간단한 API 호출) | `app.js:1737` `testProviderConnection()` |
| 9 | **모델 목록 조회** | 설정 > 프로바이더 선택 시 | 사용 가능 모델 리스트 fetch | `app.js:1495` `fetchAndRenderModels()` |

### 2-3. 에이전트 호출 구조도

```
callAI()  ← 통합 진입점 (자동 이어쓰기 포함, 최대 2회)
  └─ callProvider()  ← 프로바이더 라우터
       ├─ callOpenAI()   ← GPT-4o 등
       ├─ callClaude()   ← Sonnet 4.5 (CORS 프록시 경유)
       └─ callGemini()   ← Gemini 2.5 Flash 등
```

### 2-4. 에이전트별 프롬프트 특성

| 에이전트 | 프롬프트 유형 | 입력 | 출력 |
|---------|-------------|------|------|
| 채용공고 변환 | 시스템 지시 + 원문 | 텍스트/HTML (전체) | HTML + JSON (KV) |
| OCR | 멀티모달 (이미지 배열) | base64 이미지 | HTML 텍스트 |
| 동적 파서 | 구조 분석 결과 | DOM 분석 JSON | 파서 설정 JSON |
| KV JSON | 추출 지시 | 원문 앞 4,000자 | KV 필드 JSON |
| 일반 채팅 | 컨텍스트 + 질문 | 상태 요약 + 사용자 입력 | 자유 텍스트 |
| 변환 검증 | 원문 vs 결과 비교 | 원문 HTML + 변환 HTML | 등급/점수/상세 분석 |
| 채팅 내 변환 | 사용자 추가 지시 포함 | 원문 + 사용자 메시지 | HTML + JSON |

---

## 3. 강점 (Strengths)

### 3-1. 완성도 높은 기능 세트
- **멀티 프로바이더 AI 지원**: OpenAI, Claude, Gemini 3개 프로바이더를 통합하고 모델 자동 조회까지 구현
- **5개 채용 플랫폼 파서**: 인크루트, 잡코리아, 사람인, 원티드, 뉴워커 각각에 맞춤 추출 로직
- **AI 동적 파서**: 미지의 사이트도 AI가 분석하여 자동으로 파서 생성 — 확장성 우수
- **HWP 변환 파이프라인**: LibreOffice → DOCX → python-docx 4단계 폴백으로 한국 특수 포맷 대응
- **자동 이어쓰기**: finish_reason/stop_reason 감지로 잘림 방지 (최대 2회)
- **품질 검증 시스템**: A/B/C/F 등급 + 감점 기준의 정량적 검증

### 3-2. 사용자 경험
- **Progress UI**: Claude Code 스타일의 단계별 실시간 진행 표시
- **다크/라이트 모드**: CSS 변수 기반의 일관된 테마 시스템
- **워크스페이스**: 멀티 작업 지원 + 백그라운드 변환 완료 알림
- **한국어 UI**: 모든 에러 메시지를 한국어로 변환

### 3-3. 운영 안정성
- **CORS 프록시**: EUC-KR 자동 변환, 60초 타임아웃, 에러 원본 전달 등 실전적 설계
- **세션 영속화**: localStorage 기반으로 브라우저 닫아도 작업 복원
- **빌드 도구 없음**: 의존성 관리 부담 0, 정적 파일 서빙만으로 동작

### 3-4. 문서화
- **CLAUDE.md**: 아키텍처 결정, 버그 수정 이력, 코딩 규칙, AI 기능 가이드까지 체계적
- **12개 설계/분석 문서**: 기획 → 설계 → 분석 단계별 문서 구비

### 3-5. 백엔드 품질
- **HWP OLE2 파서** (convert-server.py): Python stdlib만으로 구현한 200줄의 OLE2 파서 — 생산 수준
- **PUA 문자 매핑**: 한국어 폰트 특수문자 68개 매핑
- **Python 3.13 호환**: deprecated cgi 모듈 대신 수동 multipart 파서 사용

---

## 4. 약점 및 리스크 (Weaknesses)

### 4-1. 아키텍처: 모놀리식 app.js (심각도: 높음)

**app.js = 8,688줄, 178개 함수, 328KB** — 가장 큰 구조적 문제.

하나의 파일에 모두 포함:
- 템플릿 렌더링 (line 16~120)
- 상태 관리 (state 객체, 50+ 프로퍼티)
- 세션 저장/복원
- 워크스페이스 관리
- AI 설정 모달
- AI API 호출 (callAI, callOpenAI, callClaude, callGemini)
- 프롬프트 빌더 (buildConversionPrompt)
- HTML 변환 로직 (convertSourceToHtml, applyGroupToContainer)
- 검증 시스템 (verifyConversion)
- KV 생성 (전체 키비주얼 로직)
- 이미지 검색 API (Unsplash, Pexels)
- 복사 기능
- 채팅 UI
- 이벤트 리스너 설정

**영향**:
- IDE 성능 저하 (328KB 단일 파일)
- 함수 간 암묵적 의존성으로 수정 시 부작용 파악 어려움
- 새 개발자 온보딩 시 진입장벽 극도로 높음
- 테스트 불가능 (모든 것이 전역 `state`에 의존)

### 4-2. 보안 (심각도: 중간~높음)

**innerHTML 119회 사용** — XSS 공격 표면이 넓음:
- `app.js:416`: `elements.sourceEditor.innerHTML = state.originalSource.raw` — 외부 URL에서 가져온 HTML을 직접 삽입
- `app.js:1231`: `elements.originalViewer.innerHTML = html` — 같은 패턴
- DOMPurify는 **조건부**(`typeof DOMPurify !== 'undefined'`)로만 적용 (`app.js:2755`) — 1곳에서만 사용

**API 키 localStorage 저장**: 브라우저 DevTools에서 바로 노출. 로컬 도구이므로 실질적 위험은 낮지만, XSS 취약점과 결합되면 API 키 탈취 가능.

**CORS 프록시 도메인 검증 비활성화** (`cors-proxy.py:119-126`): 주석 처리되어 모든 도메인에 프록시 허용. 로컬 전용이므로 문제 없으나, 외부 배포 시 위험.

**SSL 인증서 검증 비활성화** (`cors-proxy.py:24-27`): MITM 공격 가능. 역시 로컬 전용 맥락에서는 수용 가능.

### 4-3. 성능 (심각도: 중간)

- **초기 로딩**: app.js 328KB + styles.css 84KB + index.html 68KB = **~480KB** (minification 없음)
- **CDN 의존**: marked, DOMPurify, mammoth, pdf.js, SheetJS 등 런타임 CDN 로딩 (~2-3MB)
- **DOM 조작**: `innerHTML` 대량 사용으로 불필요한 DOM 재구성

### 4-4. 코드 중복 (심각도: 중간)

- `callOpenAI()`, `callClaude()`, `callGemini()` — 3개 함수가 유사한 패턴을 반복 (헤더 구성, 에러 처리, 스트리밍)
- 각 프로바이더별 `fetchXXXModels()` 함수도 동일 패턴

### 4-5. 사용하지 않는 코드 (심각도: 낮음)

이전 아키텍처의 잔재로 보이는 파일들이 존재:
- `js/components/` — Preview.js, FileTree.js, ChatPanel.js, Editor.js
- `js/stores/` — workflowStore.js, index.js, createStore.js
- `js/steps/` — Step1_FolderSetup.js, StepManager.js

app.js에서 import하지 않으므로 dead code.

### 4-6. 테스트 부재 (심각도: 높음)

- 자동화된 테스트가 없음
- 테스트 프레임워크 미도입
- CI/CD 파이프라인 없음
- 리팩토링 시 회귀 위험 높음

---

## 5. 산출물 평가

### 5-1. 핵심 산출물 (변환된 HTML)

| 평가 항목 | 점수 | 설명 |
|----------|------|------|
| 원문 보존 | 우수 | 5단계 검증(텍스트 일치율, 환각 감지, 구조 보존, 테이블 셀, 핵심 데이터) |
| 템플릿 다양성 | 양호 | 6개 템플릿 (Standard, Incruit, Modern, Corporate, Creative, Compact) |
| 인크루트 호환 | 우수 | v3 섹션 구조, 공식 CSS 링크, #isIncruit 태그 자동 삽입 |
| 테이블 보존 | 양호 | DOCX(최고) > XLSX > PDF(추론) > HWP(서버) |

### 5-2. 키비주얼 (KV) 산출물

| 평가 항목 | 점수 | 설명 |
|----------|------|------|
| 자동 생성 | 우수 | 정규식 + AI 이중 추출로 기업명/공고번호/마감일 자동 채움 |
| 업종 매칭 | 양호 | 17개 업종 → Unsplash 배경 이미지 자동 선택 |
| 프리셋 | 양호 | 카드 기반 프리셋 선택 UI |
| 이미지 검색 | 양호 | Unsplash + Pexels API 통합 (업종별 키워드 자동 제안) |

### 5-3. 문서 산출물

| 문서 | 평가 |
|------|------|
| CLAUDE.md | **A+** — 프로젝트의 두뇌. 아키텍처 결정, 버그 이력, 코딩 패턴, AI 기능 가이드까지 포괄적 |
| 기획 문서 (01-plan/) | **B+** — 기능별 계획 문서 구비 |
| 설계 문서 (02-design/) | **B** — 설계 의도 기록 |
| 분석 문서 (03-analysis/) | **B** — 경쟁 제품 비교 등 포함 |
| Gemini Gem 프롬프트 | **A** — v1/v2 + 검증 문서로 프롬프트 엔지니어링 체계적 |

---

## 6. 종합 등급

| 영역 | 등급 | 점수 |
|------|------|------|
| **기능 완성도** | A | 92/100 |
| **사용자 경험** | A- | 88/100 |
| **코드 아키텍처** | C+ | 62/100 |
| **보안** | B- | 72/100 |
| **성능** | B- | 70/100 |
| **문서화** | A | 93/100 |
| **유지보수성** | C | 58/100 |
| **산출물 품질** | A- | 87/100 |
| **테스트** | F | 0/100 |
| **백엔드 품질** | A- | 88/100 |
| | | |
| **종합** | **B+** | **78/100** |

---

## 7. 개선 제언

### 즉시 개선 가능 (Quick Wins)

1. **Dead code 정리**: `js/components/`, `js/stores/`, `js/steps/` — 사용하지 않는 파일 삭제
2. **DOMPurify 필수 적용**: CDN `<script>` 로드를 보장하고, `innerHTML` 삽입 전 반드시 `DOMPurify.sanitize()` 적용
3. **sanitizeHtml() 헬퍼 생성**: 모든 innerHTML 할당을 래핑하는 단일 함수

### 중기 개선 (1-2개월)

4. **app.js 모듈 분리** — 권장 구조:
   ```
   js/
   ├── app.js             (진입점 ~200줄)
   ├── state.js           (상태 관리)
   ├── ai/
   │   ├── providers.js   (callOpenAI, callClaude, callGemini 통합)
   │   ├── prompts.js     (buildConversionPrompt, buildKvPrompt 등)
   │   └── verification.js (verifyConversion)
   ├── ui/
   │   ├── workspace.js   (워크스페이스 UI)
   │   ├── settings.js    (설정 모달)
   │   ├── chat.js        (채팅 패널)
   │   └── preview.js     (미리보기/에디터)
   ├── kv/
   │   ├── generator.js   (KV 생성/프리셋)
   │   └── imageSearch.js (Unsplash/Pexels)
   ├── conversion/
   │   ├── templateConverter.js (convertSourceToHtml)
   │   └── bulletConverter.js   (applyGroupToContainer)
   └── services/          (기존 유지)
   ```
5. **AI 프로바이더 추상화**: 3개 프로바이더 호출 로직을 공통 인터페이스로 통합
6. **기본 테스트 도입**: 서비스 모듈(urlExtractor, fileExtractor, ruleConverter)부터 단위 테스트

### 장기 과제 (3-6개월)

7. **빌드 도구 도입**: esbuild 또는 Vite로 번들링 + minification → 초기 로딩 개선
8. **TypeScript 점진 도입**: 새 모듈부터 .ts로 작성
9. **E2E 테스트**: Playwright로 핵심 워크플로우 (URL 추출 → 변환 → 검증) 자동화

---

## 8. 한 줄 요약

> 기능적으로 매우 인상적인 도구이며 문서화도 우수하지만, 8,700줄짜리 단일 파일 구조가 유지보수와 확장의 병목이다. 기능은 A급, 구조는 C급 — 구조 개선이 이루어지면 전체적으로 A급 프로젝트가 될 잠재력이 있다.
