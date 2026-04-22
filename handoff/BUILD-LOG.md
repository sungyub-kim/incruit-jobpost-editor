# Build Log
*기획자가 소유. 개발자가 각 스텝 완료 후 업데이트.*

---

## Current Status

**Active step:** Step 22 DEPLOYED (build 381, 2026-04-20)
**Last deployed:** build 381 — 2026-04-20 (편집기/KV/이미지맵 버그 수정 9건)
**Next:** 실사용 피드백 대기.

### 롤백 사유
rhwp 엔진이 실제 샘플의 **특정 표 행을 누락**함이 실증 (`samples/2026년 제1회 직원 채용 _모집공고문.hwp`의 4×3 연봉표 6급/7급 데이터가 `getPageRenderTree`/`renderPageHtml` 모두에서 전혀 반환되지 않음). 중첩 표 보존이라는 장점보다 데이터 유실 리스크가 더 크다고 판단. 에디터 측에서 복잡한 표를 더 잘 다루도록 보강하는 방향으로 전환.

### 발단 (2026-04-15)
2026-04-14 저녁부터 AI 변환 결과에서 텍스트 창작("인사담당자, 발급담당자", "상시 전일만" 등 원문에 없는 표현 생성) + 단어 소실("비상근", "직급" 등)이 급증. 모델 ID·프롬프트 변경 없음 → Anthropic 측 내부 업데이트 추정. **검증이 B등급으로 통과시켜 배포됨** — 검증 로직이 창작/단어 변조를 잡지 못하는 설계 결함 확인 (`verifyConversion()` 글자 LCS + 95% 누락 스킵 + 역방향 검사 부재). Step 13(모델 승격 응급)·Step 14(검증 재설계) 동시 승인.

---

## Step History

### Step 22 — 편집기 버그 수정 + 툴바 3행 + 프리셋 + 이미지맵 (build 378~381)
- **Status:** DEPLOYED (build 381, 2026-04-20)
- **Build 381** (c8cbaa3) 9건 일괄:
  1. 실사공고01/02/05 kv-job-code 인라인 포지셔닝 추가 (왼쪽 정렬 버그)
  2. KV gradient/color span 중첩 방지: `_getAncestorStyledSpan`/`_applyStyledSpan` 헬퍼, 4개 apply 함수 + 2개 color 함수 통합
  3. gradient padding:0.15em 0 복구 (text-clip 안정성 — 중첩 누적은 헬퍼가 막음)
  4. PNG 캡처: getComputedStyle로 CSS 클래스 배경 감지, blob: URL dataURL 변환, .kv-photo-top2 transparent gradient → solid 교체
  5. 외부 채용공고 copyright 누락 시 `<div style="display:block; width:900px; margin:0 auto;">` 주입
  6. 이미지맵 OCR을 imagemap 모드에서도 제공, 두 모드 HTML 공통 주입, `maxOutputTokens` 32768, 프롬프트 "중간 생략 금지" 명시
  7. 이미지맵 업로드 시 width > 900px면 canvas로 900px 비율 유지 리사이즈
- **Deploy (381):** run 24648252514 success (35s)
- **Build 380** (55e6eb3): 글자색 프리셋 맨 앞 `#121212` 추가. 테이블 배경색 스와치 클릭 시 hidden color input을 툴바 하단으로 `position:fixed` 동적 재배치 → 네이티브 picker가 아래쪽으로 열림(적용 버튼 가림 해소).
- **Deploy (380):** run 24646923499 success (31s)
- **Build 378** (a2b5ebb): 테이블 들여쓰기 분리 (handleIndent에서 table 블록 처리 제거) + 전용 `표←`/`표→` 버튼 + 툴바 2행→3행 재편 (행 1: 표-레벨, 행 2: 병합/행/열, 행 3: 헤더/정렬/배경/테두리/너비).
- **Build 379** (7beb61c): 6건 일괄 수정
  1. 일반 들여쓰기 연속 클릭 무반응 수정: `handleIndent`의 LI 교체 후 `currentSelection`을 새 블록으로 갱신
  2. 테이블 셀 배경색 `적용` 버튼 추가: 네이티브 color picker 사용 후 명시적 적용
  3. Shift+Enter trailing-BR 버그 수정: `execCommand('insertLineBreak')`로 교체
  4. 테이블 툴바가 위쪽 본문 덮는 위치 버그 수정: `showToolbar`에 테이블 상단 경계 검사 추가
  5. ol 번호 증감 기능 추가: `번호+`/`번호-` — `<li>` 앞에 `<i></i>` 시블링 add/remove
  6. 여백 추가 버튼 툴바 승격: `spacerInsert` 버튼으로 현재 커서 위치 기준 spacer picker 호출
- **Deploy:** run 24646497993 success (30s)
- **Scope discipline:** 편집 모드 UI 한정, PDF/Vision/HWP 업로드 경로 무변경

---

### Step 21 — 편집기 테이블 툴바 4개 기능 추가 (평탄화 복구 + 순서 이동)
- **Status:** DEPLOYED (build 377, 2026-04-20)
- **Files changed:**
  - `index.html` (1761–1786) — 새 버튼 6개: `insertNestedTable`(셀에 표↳), `splitCellByLines`(셀 분할↓), `moveRowUp/moveRowDown`(행↑/행↓), `moveColLeft/moveColRight`(열←/열→)
  - `js/app.js` — `executeCommand` switch에 6개 case + 메서드 8개(`insertNestedTable`, `updateNestedTableButton`, `_splitCellLines`, `splitCellByLines`, `_rowHasRowspan`, `_rowsHaveVerticalMerge`, `moveRow`, `moveCol`) + `showToolbar`에 `updateNestedTableButton()` 1줄 호출
  - `css/styles.css` (2878) — `.tbl-btn-disabled` 1줄
- **Key decisions:**
  - (a) `insertNestedTable`: 기존 `createNewTable` 셀 내부 동작은 유지, 명시 버튼 추가. activeCell 없으면 경고 + no-op.
  - (b) `splitCellByLines`: 줄 구분자 자동 선택(`<p>` > `<br>` > `\n`). 같은 행 제약 + 병합 셀 차단 + 단일 줄 차단.
  - (d) 행/열 이동: `buildGrid` 기반 병합 걸침 탐지로 부분 교환 금지. `<colgroup>`도 함께 교환.
  - (f) 다중 셀 배치 편집: 기존 `alignCells`/`valignCells`/`applyBgColor` 등 `selectedCells` 일관 순회 확인 — 코드 수정 없음.
- **검수 결론:** Clear / Must Fix 0 / Should Fix 2 (Known Gaps 이월) / Escalate 2 (기획자 단독 UX 결정으로 이월)
- **Scope discipline:**
  - 기존 툴바 버튼 동작 무변경, PDF/Vision/HWP 업로드 경로 무변경, 편집 모드 외부 코드 무변경, Undo/Redo 미구현(스코프 외)

---

### Step 20 — rhwp WASM HWP 파서 통합 (중첩 표 보존, opt-in) — **ROLLED BACK**
- **Status:** ROLLED BACK (build 376, 2026-04-20)
- **Initial deploy:** build 374 (5722b18) — 2026-04-20
- **Hotfix:** build 375 (9a8e5ba) — bbox 기반 rowSpan/colSpan 역산 + 1x1 페이지 래퍼 언래핑
- **Rollback:** build 376 — 2026-04-20, rhwp 경로 진입점 + 서비스 파일 + vendor/rhwp/ 전체 삭제
- **검증 결과:**
  - 매퍼 span 수정 후 6×4 채용분야 복잡 표의 병합(문화도시 3행, 관광 2행)은 정상 복원.
  - **그러나 4×3 연봉표에서 행 2·3(6급/7급)이 전체 9페이지 어디에서도 추출되지 않음** — `getPageRenderTree`/`renderPageHtml` 둘 다 키워드 0건. `convertToEditable` 비활성 상태에서도 복구 불가.
- **결론:** rhwp 엔진 자체 한계 — 중첩 표는 보존되나 임의의 표 행 누락이 발생. 데이터 유실 리스크가 중첩 표 가치보다 큼.
- **롤백으로 제거된 항목:**
  - `vendor/rhwp/*` (전체)
  - `js/services/rhwpService.js`, `js/services/hwpTreeMapper.js`
  - `index.html` `globalThis.measureTextWidth` 폴리필
  - `js/app.js`의 `?engine=rhwp` 분기 (기존 경로로 원복)
- **유지:**
  - `.github/workflows/deploy-aws.yml` vendor/ include 규칙 (미래 호환 여지)
  - `handoff/SPIKE-RHWP-FINDINGS.md`, `handoff/REVIEW-REQUEST.md`, `handoff/REVIEW-FEEDBACK.md` (이력 보존)
- **다음 방향 (Project Owner 지시):** rhwp 재시도 금지. **에디터 자체를 보강**하여 기존 LibreOffice 경로에서 오는 복잡한 표를 더 잘 편집/렌더하도록 개선.
- **Files added:**
  - `vendor/rhwp/{rhwp.js, rhwp_bg.wasm, LICENSE, README.md}` — `@rhwp/core@0.7.3` 정적 호스팅
  - `js/services/rhwpService.js` — WASM init(1회) + `parseHwp(bytes)`
  - `js/services/hwpTreeMapper.js` — `getPageRenderTree` JSON → 정규화 HTML (중첩 재귀)
- **Files changed (minimal):**
  - `index.html` — `globalThis.measureTextWidth` canvas 폴리필 1개 `<script>` 블록 삽입
  - `js/app.js` (~line 16952–16985) — `handleFileAttach`의 `isHwp` 분기에 `?engine=rhwp` opt-in 진입점 + 실패 시 기존 경로 자동 폴백
- **Key decisions:**
  - `getPageRenderTree()` 기반 매퍼 채택(SPIKE 권고). `renderPageHtml`은 `position:absolute` + `<tr>` 누락이라 미사용.
  - `<table class="hwp-table" border="1"><colgroup>…</colgroup><tbody><tr><td>…</td></tr></tbody></table>` 구조로 정규화. 중첩은 Cell.children 재귀.
  - 기존 경로에 단 한 줄만 수정(`if (state.convertServerAvailable)` → `if (!result && state.convertServerAvailable)`) — rhwp 미발동 시 의미 동일, 발동 시 backend 중복 호출 방지.
  - WASM 및 mapper 모듈은 dynamic `import()`로 로드 → 기본 경로 사용 시 번들/네트워크 영향 0.
  - 이미지/도형 노드는 `<!-- image placeholder -->` 주석으로 대체(크래시 방지). Header/Footer/PageBg/Rect/Line는 중첩 표 복원과 무관하여 skip.
- **Verification (node WASM round-trip on `samples/2026년 제1회 직원 채용 _모집공고문.hwp`):**
  - 9페이지 전체 렌더, html 6,909B, max table depth **2**, nested opens **6**, `<td><table>` strict **1**, Hangul 1,914자, warnings 0.
  - 샘플 1 / test.hwp(중첩 없음): nested 0 — 평탄화 아닌 원본 그대로.
- **Scope discipline:**
  - `APP_BUILD` 미증가 · `scripts/deploy.sh` 미실행 · `cors-proxy.py`/`convert-server.py`/`hop-main/`/`samples/`/`spike/` 무변경 · 편집 모드 코드 무변경 · PDF/Vision 경로 무변경.

---

### Step 18 — handleHwpPdfCombinedVision: Claude Vision 지원 + v2 우회 제거
- **Status:** COMPLETE — 검수 대기
- **Date:** 2026-04-19
- **Files changed:**
  - `js/app.js` (~line 17030) — `handleHwpPdfCombinedVision()` 수정
- **Changes:**
  1. 키 감지 로직 — 이미 dual-key로 되어 있었음 (이전 세션에서 부분 작업됨). `apiKeyVal = apiKey` (undefined 참조) 버그 수정.
  2. v2 우회 블록 — 함수 내에 존재하지 않았음 (이미 제거되었거나 원래 없었음).
  3. Gemini API 호출 → `if (useGemini) { ... } else { ... }` 분기로 교체.
  4. `userPartsText` 변수 추출 — 프롬프트 텍스트를 `if/else` 바깥에 선언하여 양쪽에서 재사용.
  5. Claude Vision 분기 추가 — CORS 프록시 헬스체크 → 프록시/직접 경로 분기, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access` (직접 호출 시만).
  6. `registerVisionContinue()` — `useGemini` 조건으로 게이트. Claude 분기에서 미호출.
  7. `buildContinueButton()` — `useGemini && totalPages > endPage` 조건으로 게이트.
- **Key decisions:**
  - `contBtn2`도 `useGemini`로 게이트 — `registerVisionContinue`가 미호출인 Claude에서 dead 버튼 노출 방지

---

### Step 1 — Standard 보더형 템플릿 추가
- **Status:** COMPLETE
- **Deploy:** confirmed — build 216, commit 1c035e6, pushed to main
- **Date:** 2026-04-10
- **Files changed:**
  - `js/app.js` (lines 65-101) — `standard_border` 템플릿 추가
  - `index.html` (lines 226-230) — 템플릿 카드 추가
  - `index.html` (line 295) — select option 추가
  - `css/styles.css` (line 5716) — 프리뷰 스타일 추가
- **Key decisions:**
  - 보더 이미지 3개를 render 함수 상단에 변수로 선언 (교체 용이)
  - `data.keyVisual`이 있으면 KV 이미지, 없으면 기본 상단 보더 이미지 사용
  - 보더형 고유 스타일을 style 블록에 포함

### Step 2 — Standard 이미지 보더형 템플릿 개선
- **Status:** COMPLETE
- **Deploy:** confirmed — build 217, commit b0cfbda, pushed to main
- **Date:** 2026-04-10
- **Summary:** 이름 변경(Standard 보더형→이미지 보더형), 상단 KV 삼항 패턴, 보더/하단 이미지 URL + 좌우 여백 입력 UI
- **Key decisions:**
  - `borderTopImg` 제거, 상단은 순수 KV만 사용
  - 빈 입력 시 기존 하드코딩 URL fallback
  - 좌우 여백 기본 40px, 40~60px 범위 슬라이더

### Step 3 — KV 폰트/프리셋 개선
- **Status:** COMPLETE
- **Deploy:** confirmed — build 218 (6e4a457), 232 (9479fa4), 234 (7787180)
- **Date:** 2026-04-10 ~ 2026-04-12
- **Summary:**
  - build 218: KV 폰트 출력에서 Pretendard 제외 (등록 사이트에 이미 적용)
  - build 232: 실사공고03 KV 최소 높이 500px로 변경
  - build 234: applyKvPreset에 photoContentMinHeight 복사 누락 해결

### Step 4 — 법률 N의M 번호 체계 지원
- **Status:** COMPLETE
- **Deploy:** confirmed — build 219~231, 233, 235~236, 238, 244~245 (17 commits)
- **Date:** 2026-04-10 ~ 2026-04-13
- **Summary:** 채용공고 내 법률 조항 번호(제1조의2 등) 자동 인식 및 구조화
- **Key milestones:**
  - build 219: 프롬프트 지시 + 후처리 + CSS 기초
  - build 221: 원문 기반 AI 누락 복원
  - build 224: 평문 번호 리스트(`<p>` 안 번호) → `<ol>/<li>` 자동 구조화
  - build 225: 변환 전 effectiveSourceText에서 사전 추출
  - build 228: 3단계 fallback (세션 복원/재렌더링 시에도 동작)
  - build 229: 인덱스 기반 매칭으로 전환 (snippet 불안정 해소)
  - build 231: localStorage 영속화
  - build 233: DOM 구조 추론 (entries 없어도 하위 ol 패턴으로 자동 복원)
  - build 235-236: Phase 1b 인덱스 기반 + ol 확장
  - build 238: hanging indent를 N의M 항목에만 적용
  - build 244-245: Phase 1b 오탐 방지 + 트리거 조건 확장
- **Key decisions:**
  - 인덱스 기반 매칭 (snippet 매칭 폐기)
  - localStorage 영속화 (sourceContent fallback 제거)
  - Phase 1b는 원본 소스에 N의M 패턴 존재 시에만 동작

### Step 5 — HTML 다운로드/복사 기능 개선
- **Status:** COMPLETE
- **Deploy:** confirmed — build 237 (1293d4d), 239~241
- **Date:** 2026-04-12 ~ 2026-04-13
- **Summary:**
  - build 237: 다운로드/복사 HTML에 N의M legal-manual-num CSS 인라인 포함
  - build 239: 외부용 HTML 다운로드 추가 (인크루트 CSS 인라인 + Minify)
  - build 240: 로컬 css/ 폴더 우선 + 다중 fallback
  - build 241: CSS EUC-KR 인코딩 자동 감지 (한글 깨짐 수정)

### Step 6 — 붙여넣기 이미지/클래스 보존
- **Status:** COMPLETE
- **Deploy:** confirmed — build 242 (5f99905), 243 (15517c8)
- **Date:** 2026-04-13
- **Summary:**
  - build 242: 듀얼 원문 붙여넣기 시 이미지 보존 (cleanHtml에 img/a 허용)
  - build 243: 붙여넣기 HTML 클래스/헤더 이미지 보존

### Step 7 — td 내부 리스트 블릿 보장
- **Status:** COMPLETE
- **Deploy:** confirmed — build 246, commit 93d51b9
- **Date:** 2026-04-13
- **Summary:** 모든 리스트에 인크루트 클래스 자동 부여 (테이블 셀 내부 포함)

### Step 8 — HWP 변환 PUA 깨짐 문자 정리
- **Status:** COMPLETE
- **Deploy:** confirmed — build 247, commit ba5ab67
- **Date:** 2026-04-13
- **Summary:** 한컴 폰트 특수문자(PUA 영역) 복원 처리

### Step 9 — Phase A: `<br>` 처리 재설계
- **Status:** COMPLETE
- **Deploy:** confirmed — build 248, commit e6776bc, pushed to main
- **Date:** 2026-04-14
- **Summary:** `extractHtmlFromResponse()`의 `<br>` 일괄 공백 치환을 컨텍스트별 처리로 교체
- **Files changed:**
  - `js/app.js` (lines 11220-11268) — `processBrTagsByContext()` 헬퍼 함수 추가
  - `js/app.js` (lines 11292-11294) — `extractHtmlFromResponse()` 내 호출부 변경
- **Key decisions:**
  - DOMParser 기반 (renestOrphanedTables 패턴 따름)
  - td/th 안: `br.closest('td, th')` → 보존
  - p 안: `<br>` 기준 `<p>` 분리 → 불릿 감지 입력 개선
  - 그 외: 공백 치환 (기존 동작 유지)

### Step 10 — Phase B: 시각 품질 개선
- **Status:** COMPLETE
- **Deploy:** confirmed — build 249, commit (Phase B+C 통합)
- **Date:** 2026-04-14
- **Summary:** has-marker padding 20px로 확대, 중첩 테이블 전용 CSS, 제목 원형 숫자 regex 보완
- **Files changed:**
  - `css/styles.css` — has-marker padding 4px→20px, 중첩 테이블 패딩 축소 CSS 추가
  - `js/app.js` — fixDoubleMarkers 원형 숫자 regex에 `[.)]?` 추가

### Step 11 — Phase C: 엣지케이스 방어
- **Status:** COMPLETE
- **Deploy:** confirmed — build 249, commit (Phase B+C 통합)
- **Date:** 2026-04-14
- **Summary:** 중첩 테이블 placeholder 50자 확장, 문자열 기반 테이블 클래스를 DOM 기반으로 통일, kolist 과반수 감지
- **Files changed:**
  - `js/app.js` — findTargetCells 25→50, applyIncruitTableClasses DOM 재작성, kolist 과반수 로직
- **Key decisions:**
  - applyIncruitTableClasses를 regex/인덱스에서 DOMParser 기반으로 완전 전환
  - kolist 감지를 첫 li → 전체 li 과반수 기준으로 변경

### Step 12 — 이미지맵+인트로 도구 개선
- **Status:** COMPLETE
- **Deploy:** confirmed — build 274~281, pushed to main
- **Date:** 2026-04-15
- **Summary:**
  - Part A: 사이드바 이미지맵 에디터 제거 (index.html, app.js, styles.css)
  - Part B: 독립 도구(`tools/imagemap/`)에 인트로 출력 모드 추가
  - Part C: 후속 개선 (build 275~281)
    - 파일 업로드 data URL 변환 (blob: URL 제거)
    - 인트로 모드 인크루트 표준 템플릿 래핑 (templwrap_v3 + isIncruit + CSS)
    - 코드 표시에서 data URL 축약 (복사/다운로드는 전체 유지)
    - OCR 텍스트 추출 (Gemini Vision API → display:none 숨김 텍스트)
    - a태그 alt → title 변경
    - HTML 다운로드 EUC-KR 바이트 인코딩 (TextDecoder 역매핑)
    - 다운로드 HTML에 meta charset euc-kr 추가
- **Key decisions:**
  - `compressImageFile()`: KV 배경 업로드에서 사용 → 이미지맵 블록 밖으로 이동
  - EUC-KR 인코딩: TextDecoder('euc-kr') 역매핑 테이블로 브라우저에서 직접 변환
  - OCR: Gemini Vision API 직접 호출 (localStorage에서 API 키 공유)
  - 복사는 한글 그대로, 다운로드만 EUC-KR 바이트

### Step 13 — 기본 모델 Opus 4.6 승격 (응급)
- **Status:** COMPLETE
- **Deploy:** confirmed — build 287, commit 70b6021, AWS run 24446915623 (30s, success)
- **Production:** https://ai-studio.incru.it/ (APP_BUILD=287 확인)
- **Date:** 2026-04-15
- **Files changed:**
  - `js/app.js:21` — APP_BUILD 286 → 287
  - `js/app.js:243-245` — 드롭다운 순서 Opus(추천) → Sonnet → Haiku, default를 Opus로
  - `js/app.js:2966, 2973` — 연결 테스트 모델·메시지 Opus 4.6
  - `js/app.js:12811` — 폴백 모델 Opus 4.6
- **발단:** Sonnet 4.5가 "원문 100% 보존" 프롬프트를 무시하고 창작/소실 — Anthropic 측 내부 업데이트 추정, 우리 제어 밖. Opus는 지시 이행 더 강함.
- **Key decisions:**
  - localStorage `ai_model` 강제 전환 안 함 — 기존 사용자 선택 존중
  - 마이그레이션 맵(14176-14177) 그대로 — legacy ID 리다이렉트 유지
  - 드롭다운 순서도 정리 (검수자 비차단 관찰 사항, Project Owner B 선택)
- **Review:** 검수자 CLEAR, 5/5 grep PASS, 6/6 라인 PASS, side-effect 없음
- **Known limitation:** 환각 완전 차단은 아님. Step 14(검증 재설계)로 최후 방어선 필요.

### Step 14 — 원문 보존 검증 재설계 (V1~V6)
- **Status:** COMPLETE
- **Deploy:** confirmed — build 288, commit 3920d3b, AWS run 24448090452 (28s, success)
- **Production:** https://ai-studio.incru.it/ (APP_BUILD=288 + stripTemplateWrapperText 변경 확인)
- **Date:** 2026-04-15
- **Files changed:**
  - `js/app.js:21` — APP_BUILD 287 → 288
  - `js/app.js:3553~3569` — `STOPWORDS` (25개), `PROTECTED_WORDS` (21개) 상수 추가
  - `js/app.js:3600~3634` — `stripTemplateWrapperText()`, `detectFabricatedWords()` 헬퍼 추가
  - `js/app.js:3639~3929` — `verifyConversion()` 함수 V1~V6 수정
- **V1 (창작 검출):** 역방향 단어 비교 — stripped convDom에서 원문에 없는 content words 추출, 1개당 5점 감점
- **V2 (95% 스킵 제거):** textMatch >= 95 → missingTexts = [] 분기 삭제, 항상 누락 점검
- **V3 (보호 단어):** PROTECTED_WORDS 소실 시 deductions >= 45 → F 보장
- **V4 (단어 LCS):** word-LCS 병행 계산, textMatch = min(charMatch, wordMatch)
- **V5 (등급 강화):** B 커트라인 80→85, 창작 5개→C cap, 10개→F cap
- **V6 (리포트 UI):** 창작 텍스트 블록 + 보호 단어 소실 블록 + 글자/단어 이중 일치율 표시
- **V7 (자동 재시도):** Step 14.5로 분리 — AI 재호출 경로 수정 범위 확장 사유
- **검수자 관찰 반영 (Project Owner B 선택):**
  - S1 — `stripTemplateWrapperText`에 `.h10, .h30` 스페이서 추가
  - E1 — `.sec_title` 통째로 제거 (h3 텍스트와 인접 `<p>` 합성 토큰 "모집개요정규직" 오탐 차단). sec_title h3 = TEMPLATE_WHITELIST 단어와 중복 정보라 진짜 환각을 놓칠 위험 없음.
- **Key decisions:**
  - fabrication 검출에만 stripped DOM 사용 (기존 textMatch 계산은 full DOM 유지)
  - TEMPLATE_WHITELIST + isTemplateText 재사용으로 섹션 제목 false positive 방지
  - STOPWORDS는 브리프 지정 25개로 보수적 시작
- **Review:** 검수자 CLEAR, 모든 grep PASS, V1~V6 PASS, mental simulation (경력증명서 → F / 정상 → A) 예측 일치
- **검증 제약:** `verifyConversion()`은 브라우저 전용 (`document.createElement` 의존). Node.js 검증 불가 → Project Owner가 실제 재현 공고로 브라우저 콘솔 확인 예정.

### Step 14 핫픽스 — build 289 (V4 점수 영향 제거 + 진단 헬퍼)
- **Status:** COMPLETE
- **Deploy:** confirmed — build 289, commit 3fc2a5d, AWS run 24449439410 (31s, success)
- **Date:** 2026-04-15
- **발단:** Project Owner가 정상 공고 변환 시 F (score 28). charMatch 93% / wordMatch 63% → `min(charMatch, wordMatch) = 63%` → score 28. 한국어 토큰 변이로 wordMatch 폭락 false positive.
- **수정 (`js/app.js`):**
  - `report.textMatch = Math.min(charMatch, wordMatch)` → `report.textMatch = charMatch`
  - wordMatch는 리포트 표시(글자 X% / 단어 Y%)로 보조 정보만 유지
  - `verifyConversion()` 끝에 `window.__lastVerifyReport = report` 추가
  - `window.__verifyDebug()` 함수 노출 — 콘솔에서 grade/score/fabricated/protected 즉시 확인
- **Key decision:** V4 단어 LCS는 한국어에 부적합한 메트릭. 환각 검출은 V1(창작)+V3(보호 단어) 2중 방어선이 본체.

### Step 14 핫픽스 — build 290 (substring 매칭으로 한국어 띄어쓰기 변이 흡수)
- **Status:** COMPLETE
- **Deploy:** confirmed — build 290, commit bb11353, AWS run 24450024822 (33s, success after 1 retry)
- **Production:** https://ai-studio.incru.it/ — 정상 ① B (score 88, fab 0) / 환각 ② F (score 0, fab 644) 확정
- **Date:** 2026-04-15
- **발단:** build 289 이후에도 정상 공고가 F (fab 18건). 진단 결과 fabricated가 모두 띄어쓰기 변이 — "기획및", "(2급", "9:00~5.4.(월)", "운영(자녀출산무주택" 등. AI 환각 아닌 토큰 분할 차이.
- **수정 (`js/app.js`):**
  - `detectFabricatedWords` 매칭 방식: `srcWordSet.has(w)` 정확 매칭 → `srcNoSpace.includes(w)` substring 매칭
  - 원문 글자 시퀀스(공백 제거)에 변환 단어가 포함되면 환각 아닌 것으로 판정
- **Key decision:** 한국어 토큰 매칭은 띄어쓰기 변이에 매우 취약. substring 매칭으로 변이 흡수. R3(검수자 지적)의 substring 부작용은 도메인 보호 단어 안전망으로 커버.
- **검증 결과 (Project Owner 콘솔):**
  - ① 정상: grade B / score 88 / fab 0 ← false positive 완전 해소
  - ② 환각(경력증명서): grade F / score 0 / fab 644 ← V3 protectedMissing 보장으로 F 유지
- **AWS 1차 배포 실패 사유:** `haythem/public-ip@v1.2` 외부 액션의 일시적 실패 (Get & Add GitHub Actions IP 단계). 재시도 1회로 성공. 코드 무관.

### 응급 사이클 종합 (build 287 → 290)
2026-04-14 저녁 발단 → 같은 날(2026-04-15) 중 4단계 사이클 완료. 두 방어선(Opus 승격 + 검증 재설계) 프로덕션 안정화 + 정상 공고 false positive 해소 + 환각 케이스 차단 확인. 네 번의 배포로 1일 내 안정 도달.

### Step 17 — HWP Vision 변환: API 키를 브라우저에서 서버로 전달
- **Status:** REVIEW PENDING
- **Date:** 2026-04-19
- **Files changed:**
  - `js/app.js` (line ~16435) — `extractViaBackend()`: `anthropic_api_key` FormData 추가, 타임아웃 20초→60초, 오류 메시지 업데이트
  - `convert-server.py` — `convert_hwp_vision()` 시그니처에 `api_key` 인자 추가, 환경변수 대신 인자 사용
  - `convert-server.py` — `convert_hwp()` 시그니처에 `api_key` 인자 추가, `effective_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")` 환경변수 fallback
  - `convert-server.py` — `convert_file()` 시그니처에 `api_key` 인자 추가, HWP 경로에 전달
  - `convert-server.py` — Flask `/api/convert` 라우트: `request.form.get('anthropic_api_key', '') or os.environ.get(...)` 추출 후 `convert_file()` 전달
  - `convert-server.py` — `parse_multipart()`: `anthropic_api_key` 텍스트 필드도 추출, `(filename, data, api_key)` 반환
  - `convert-server.py` — stdlib HTTPServer 핸들러: `parse_multipart` 반환값 3-tuple 언패킹, `api_key = form_api_key or os.environ.get(...)`, `convert_file()` 전달
- **Changes:**
  1. 브라우저에서 `ai_api_key_claude` → `ai_api_key` 우선순위로 키 조회, FormData `anthropic_api_key` 필드로 전송
  2. Flask/stdlib 양쪽에서 `anthropic_api_key` 필드 파싱 후 `convert_file` → `convert_hwp` → `convert_hwp_vision` 체인으로 전달
  3. 환경변수 `ANTHROPIC_API_KEY`는 fallback으로 유지 (EC2 설정 시 동작)
  4. Vision 타임아웃: 브라우저 20초 → 60초
- **Key decisions:**
  - `parse_multipart()` 반환 시그니처가 `(filename, data)` → `(filename, data, api_key)` 로 변경됨 — 호출부 2곳 (stdlib 핸들러) 모두 업데이트 완료. `hwp-to-rawhtml`, `hwp-to-pdf` 경로는 api_key 사용 안 함, `convert` 경로만 전달.
  - `convert_file()` 에서 HWP만 api_key를 전달, 나머지 포맷은 무시 (기존 `converter(data, filename)` 패턴 유지)
- **py_compile:** `python -m py_compile convert-server.py` → OK

### Step 16 — HWP Vision 변환 통합
- **Status:** REVIEW CLEAR — 배포 대기
- **Date:** 2026-04-19
- **Files changed:**
  - `convert-server.py` — `_VISION_SYSTEM_PROMPT`/`_VISION_USER_PROMPT` 상수, `convert_hwp_vision()` 신규 함수, `convert_hwp()` Vision 최우선 블록 추가
  - `requirements.txt` — `anthropic>=0.40.0`, `pdf2image`, `Pillow` 추가
  - `docker/convert-server/Dockerfile` — `poppler-utils` 시스템 패키지, pip Vision 의존성 추가
- **Changes:**
  1. `convert_hwp_vision()`: HWP → PDF(LibreOffice) → 이미지(pdf2image, dpi=150) → Claude Vision(claude-sonnet-4-6) → HTML. 실패 시 None 반환
  2. `convert_hwp()` 최상단: `ANTHROPIC_API_KEY` 있고 `parser_hint != "native"` 이면 Vision 우선 → 실패 시 기존 로직 fallback
  3. path traversal 방어: `os.path.basename(filename)` 적용
- **Key decisions:**
  - Vision 경로는 `ANTHROPIC_API_KEY` 환경변수 유무로 자동 선택 (미설정 시 기존 동작 100% 유지)
  - HWPX는 포함하지 않음 (기획자 확인)
  - `parser_hint=native`로 Vision 우회, 기존 바이너리 파서 강제 가능 (디버깅용)
- **Known Gaps:**
  - Docker 베이스 이미지 `python:3.11-slim` high 취약점 4개 (기존 존재, 이번 신규 아님). `python:3.12-slim` 업그레이드 검토 필요.

### Step 15 — HWP 네이티브 파서: text-align 추출
- **Status:** REVIEW PENDING
- **Date:** 2026-04-19
- **Files changed:**
  - `convert-server.py` — 신규 상수, 신규 함수, `_extract_content()` 수정, HTML 렌더링 수정
- **Changes:**
  1. `HWPTAG_DOCINFO_PARA_SHAPE = 25` 상수 추가 (line 2105 근처)
  2. `_parse_docinfo_parashapes(ole, compressed)` 신규 함수 — DocInfo 스트림에서 ParaShape tag=25 레코드 수집, bit0-1 추출, `{idx: alignment_int}` 반환
  3. `_extract_content()` 시그니처에 `parashape_map=None` 추가
  4. `HWPTAG_PARA_HEADER` 처리: payload offset 12(WORD)에서 para_shape_id 읽어 `current_para_align` 설정
  5. `HWPTAG_PARA_TEXT` 처리: `para_dict["align"]` 및 `current_cell["align"]` (첫 단락만) 저장
  6. `<p>` 렌더링: `align` 있으면 `style="text-align:..."` 추가
  7. 메인 `<td>/<th>` 렌더링: `align` 있으면 `style="text-align:..."` 추가
  8. 중첩 테이블 `<td>/<th>` 렌더링: 동일하게 처리
  9. 호출부: `parashape_map = _parse_docinfo_parashapes(ole, compressed)` 추가 및 `_extract_content()` 전달
- **Key decisions:**
  - PARA_HEADER payload offset 12 = para_shape_id (HWP5 스펙). 검수자가 실제 파일로 확인 필요.
  - 셀 정렬: 셀 내 첫 번째 단락의 정렬을 셀 전체 정렬로 사용 (단순화, 다단락 셀은 첫 단락 우선)
  - 기본값(0=양쪽, 1=왼쪽) → style 생략 (기존 출력 회귀 없음)
- **Known Gaps:**
  - PARA_HEADER offset 12가 HWP5 실제 바이너리와 다를 경우 정렬이 모두 빈 문자열로 처리됨 (렌더링 안전, 단 정렬 미반영). 검수자 실제 파일 확인 필요.

### Step 15 P3 — 구조/텍스트 분리 프로토타입
- **Status:** REVIEW PENDING
- **Build:** 292
- **Date:** 2026-04-16
- **Files created:**
  - `js/v2/parser.js` (200줄) — parseSource: 원문 HTML → SourceNode[] 파싱 + 헤딩 감지
  - `js/v2/meta.js` (249줄) — extractMeta: colors/urls/tableStructure/listMarker/brokenChars 추출
  - `js/v2/assembler.js` (308줄) — assemble: 그룹핑 + 렌더링 + URL 래핑 + 템플릿 래핑
  - `js/v2/verify.js` (261줄) — verifyNewPipeline: 텍스트 100% + 테이블 구조 + 특수기호
  - `js/v2/classifier.js` (202줄) — classifyHeadings: AI 헤딩 분류 (자체 fetch, 비스트리밍)
  - `js/v2/index.js` (100줄) — convertV2 오케스트레이터
- **Files modified:**
  - `js/app.js` — APP_BUILD 291→292, handleRuleConvert + handleConvert에 v2 토글 삽입
- **Key decisions:**
  - AI 호출은 자체 fetch (callClaude 미사용) — v2 모듈 완전 독립
  - 헤딩 감지: h1~h6 무조건 + p>strong 전체 감싸짐 + 번호패턴+bold, 100자 초과 제외
  - 테이블 클래스 추가 시 textContent assertion — 변경 감지 시 원문 유지
  - 템플릿 래핑은 ruleConverter.js의 wrapFullTemplate 구조 복제 (import 의존 없음)
- **Known Gaps:**
  - P5+ 항목: 별표 들여쓰기 CSS, N의M 구조, PUA 복원, 평문 번호→ol 변환은 미구현 (rawHtml 그대로 복사이므로 텍스트 보존은 보장)
  - 템플릿 래핑 간이 버전 (키비주얼, 브랜드 컬러 커스텀은 P5+)
  - URL 래핑 정규식 edge case 가능

---

### Step 14.6 — F 시 다운로드·복사 차단 게이트
- **Status:** COMPLETE
- **Deploy:** confirmed — build 291, commit 56d5e8a, AWS run 24485574411 (26s, success)
- **Production:** https://ai-studio.incru.it/ (APP_BUILD=291 + checkVerifyGate + 역순 탐색 + 5곳 저장 확인)
- **Date:** 2026-04-16
- **Files changed (initial pass):**
  - `js/app.js:21~22` — APP_BUILD 290→291, APP_BUILD_DATE 2026-04-16
  - `js/app.js:13858~13862` — `copyResultData` async 전환 + html/preview 타입 게이트
  - `js/app.js:14345~14453` — `checkVerifyGate()` + `showVerifyGateModal()` 신규 함수
  - `js/app.js:14455~14458` — `handleCopyHtml` async 전환 + 게이트 + copyToClipboard 폴백
  - `js/app.js:14462` — `handleDownload` 게이트 삽입
  - `js/app.js:14504` — `handleDownloadExternal` 게이트 삽입
  - `js/app.js:14721` — `handleDownloadPng` 게이트 삽입
- **Files changed (fix pass — MF-1):**
  - `js/app.js:11356~11357` — 빠른 변환 verifyResult 저장 추가
  - `js/app.js:11635~11636` — AI 변환 verifyResult 저장 추가
  - `js/app.js:17011~17012` — HWP+PDF Vision verifyResult 저장 추가
  - `js/app.js:17211~17212` — DOCX+PDF Vision verifyResult 저장 추가
  - `js/app.js:17692~17693` — 채팅 변환 verifyResult 저장 추가
  - `js/app.js:14360~14376` — checkVerifyGate 역순 탐색 패턴으로 교체
- **Summary:** F 등급 변환 결과에 대해 4개 외부 배포 버튼(HTML 복사, 다운로드, 외부용 다운로드, PNG 다운로드) + 동적 copy-btn(html/preview 타입)을 모달 Confirm으로 차단. 체크박스로 per-message override 지원. A/B/C는 기존 동작 그대로.
- **Fix pass (MF-1):** 변환 5곳에서 verifyConversion() 결과를 메시지에 저장하지 않아 게이트 무효화 → 5곳 저장 추가 + checkVerifyGate를 역순 탐색으로 강화 (채팅 인터리빙 대응).
- **Key decisions:**
  - 기존 `.modal` CSS 패턴 재사용 (css 수정 없음)
  - `copyResultData`의 kv/response 타입은 게이트 제외 (변환 HTML 외부 반출이 아님)
  - `handleCopyHtml`을 `copyToClipboard` 헬퍼로 변경 (모달 await 후 클립보드 폴백 확보)
  - 모달에 "재변환" 버튼 없음 (Step 14.5 영역)
- **Review 경과:**
  - 1차 검수자 NEEDS CHANGES (MF-1: 변환 5곳에서 verifyResult 미저장 → 게이트 무효)
  - 기획자 초기 승인 오판 (13408 한 곳만 확인, 나머지 놓침) → 승인 취소
  - 개발자 fix pass (5곳 저장 + 역순 탐색) → 재검수 CLEAR
  - 기획자 재검토 조건부 승인 + 검수자 CLEAR → 배포
- **Known limitation:** verifyConversion이 브라우저 전용이라 자동 테스트 불가 — Project Owner 수동 확인 필요.

---

## Known Gaps
*여기에 기록하고 나중 스텝에서 처리. 현재 스텝의 스코프를 확장하지 않는다.*

- **Step 14.5** — V7 F등급 자동 재시도 (AI 재호출 + 프롬프트 피드백 주입, aiService.js 확장)
- **E2** — `protectedMissing`의 substring 매칭으로 "상근"/"비상근" 이중 검출 (기능 영향 없음, 리포트 정확도 미세 이슈). 향후 단어 경계(\b) 도입 검토 가능.
- **E3** — B 등급에서 "검증 통과" 문구와 "원문에 없는 텍스트 감지" 경고가 공존 가능 (fab 1~2건 구간). UX 일관성 미세 이슈.
- **G1 (build 290 관찰)** — 환각 케이스의 fabricatedCount가 644건으로 매우 큼 (정상은 0건). substring 매칭이 원문에 글자 시퀀스 없는 변환 단어를 모두 잡기 때문 — 기능적으로 F 판정엔 문제 없으나 리포트 첫 화면이 압도적. 향후 fabricated 표시 상한(예: 50건) 도입 검토.
- ~~**G2** — 다운로드 차단 게이트 없음~~ → **Step 14.6에서 해결** (build 291)
- **V4 단어 LCS 점수 영향 영구 비활성** — build 289에서 제외. 한국어에 부적합한 메트릭. 향후 형태소 분석 기반 매칭 도입 시 재활성 검토.
- **Step 20-R1** — `hwpTreeMapper.js`의 알 수 없는 노드 타입 경고 문자열이 `addMessage` → `formatMessage` → innerHTML 경로로 이스케이프 없이 들어갈 수 있음. 앱 전반의 기존 공통 패턴이라 이번 변경으로 악화 없음. 향후 `formatMessage` 전역 이스케이프 도입 시 함께 해결.
- **Step 20-R2 (확인 대기)** — rhwp 경로의 실환경 검증 3건: (1) 에디터 프리뷰가 `<colgroup>` 보존/제거 동작, (2) `<p>` 내 앞뒤 공백 유지(`white-space:pre-wrap`), (3) 이미지 있는 HWP의 플레이스홀더. 스테이징에서 실제 브라우저로 확인 필요. **— Step 20 롤백(build 376)으로 이 항목은 더 이상 유효하지 않음.**
- **Step 21-R1** — `.tbl-btn-disabled` 스타일이 현재 툴바 가시성 모델에서 실사용자에게 거의 노출되지 않음. 방어 코드로 유지. 툴바 상시 노출 UX로 바꿀지는 별도 스텝.
- **Step 21-R2** — `splitCellByLines`의 줄 구분자 자동 선택(`<p>` > `<br>` > `\n`). 사용 중 혼동 발생 시 명시적 UI 추가 검토. 현재 에디터 출력 형식에서는 문제 없음.
- **Step 21-R3** — `_rowsHaveVerticalMerge`가 브리프의 "full block" 지시대로 보수적 차단. 드물게 실제로 행에 걸치지 않는 rowspan도 막는 케이스가 생길 수 있음. 요구 사례 생기면 부분 허용 검토.

---

## Architecture Decisions
*변경 시 시스템이 깨질 수 있는 고정된 결정.*

- Vanilla JS (ES6 modules), no build tools — 2026-04-10
- Tailwind CSS via CDN — 2026-04-10
- Flask backend for CORS proxy and document conversion — 2026-04-10
- AI API version: 2023-06-01 (only valid version) — 2026-04-10
- All UI/error messages in Korean — 2026-04-10
- N의M 인덱스 기반 매칭 + localStorage 영속화 — 2026-04-12
- 외부용 HTML 다운로드: 로컬 css/ 우선 + CDN fallback + 인라인 fallback — 2026-04-13
- 미리보기 DOM을 Single Source of Truth로 통일 — 2026-04-10
