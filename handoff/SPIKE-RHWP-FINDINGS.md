# SPIKE-RHWP-FINDINGS — Step 19

*@rhwp/core@0.7.3 중첩 `<table>` 복원 PoC 스파이크 — 2026-04-20, 개발자 작성.*

## TL;DR

**중첩 표 HTML 보존: Yes — `renderPageHtml()`은 HWP 원본이 중첩 표를 가진 경우 `<td>` 안에 `<table>`을 그대로 emit한다 (샘플 2에서 실측 확인). 다만 출력이 (a) `position:absolute` 픽셀 레이아웃이고 (b) `<tr>`을 생략하므로, 우리가 쓰려면 정규화 후처리가 반드시 필요하다.**

보고서 끝에 한 줄 결론 다시 붙여둔다.

---

## 1. 실행 결과

### 환경
- `@rhwp/core` 버전: **0.7.3** (npm, MIT). `rhwp_bg.wasm` 단일 바이너리.
- 런타임: Node.js v24.13.1 + 브라우저용 정적 HTML 둘 다 준비.
- 스파이크 폴더: `spike/rhwp-probe/`.

### WASM 초기화
- Node에서 `initSync({ module: readFileSync('rhwp_bg.wasm') })` → **5.2 ms** 내 초기화 완료.
- 브라우저 경로(`index.html` + `app.js`)는 작성했으나 **실제 구동은 Node로 수행**. 이유: 이 환경은 headless라 브라우저에서 상호작용할 수 없음. 브라우저 코드는 동일 API(`init()` + `new HwpDocument(bytes)`)이며 관리자가 `python -m http.server 8090`로 즉시 재현 가능.
- `version()` 반환값: `0.7.3`.

### 🚨 블로커: `globalThis.measureTextWidth` 미구현 (Node-only 이슈)

`renderPageHtml()` 첫 호출에서 즉시:

```
TypeError: globalThis.measureTextWidth is not a function
    at __wbg_measureTextWidth_0962d94b80b2a16a (rhwp.js:5896)
    at HwpDocument.renderPageHtml (rhwp.js:4497)
```

`@rhwp/core`는 **호스트에 `measureTextWidth(text, fontStr): number`를 요구**한다 (wasm-bindgen 임포트). 브라우저에서는 `canvas.getContext('2d').measureText(...).width`로 주입하는 게 정석이고, Node에는 canvas가 없다.

**스파이크 해결**: 한글 글꼴 폭을 대충 추정하는 30줄짜리 폴리필을 Node에만 넣었다 (`run-node-probe.mjs` 상단). 폭 추정이 정확하지 않으므로 줄바꿈/커닝에서 오차가 있겠지만, **HTML의 `<table>` 중첩 구조는 측정값과 무관**하므로 이 스파이크의 목적에는 충분.

**프로덕션 통합 시 행동**: 브라우저에서 실행 시 `OffscreenCanvas`나 일반 `<canvas>`의 `measureText`를 `globalThis.measureTextWidth = (t,f) => { ctx.font = f; return ctx.measureText(t).width; }` 로 한 줄에 심어주면 된다. 호환성 이슈 아님.

### 파일별 파싱 결과

| 파일 | bytes | pages | parseMs | renderMs(합) | ok |
|---|---:|---:|---:|---:|:-:|
| `samples/1. 2026년 서울시여성가족재단 제2회 직원 채용 공고문 (1).hwp` | 77,824 | 10 | 25.1 | 55.4 | ✅ |
| `samples/2026년 제1회 직원 채용 _모집공고문.hwp` | 88,576 | 9 | 4.5 | 27.4 | ✅ |
| `test.hwp` | 61,952 | 4 | 1.0 | 3.6 | ✅ |

세 파일 전부 `new HwpDocument(bytes)` → `pageCount()` → 전체 페이지 `renderPageHtml()` → `getPageRenderTree(0)` → `getDocumentInfo()` 모두 에러 없이 완료.

### `getDocumentInfo()` 원문 (각 파일 page 0)
```
1번 샘플: {"version":"5.1.1.0","sectionCount":1,"pageCount":10,"encrypted":false, ...
2번 샘플: {"version":"5.1.1.0","sectionCount":1,"pageCount":9,"encrypted":false, ...
test   : {"version":"5.1.0.1","sectionCount":1,"pageCount":4,"encrypted":false, ...
```
모든 파일이 HWP 5.1.x, non-encrypted, 단일 섹션. `fontsUsed` 배열이 DocumentInfo에 포함되어 있어 폰트 수요 파악 가능.

---

## 2. 성능

### WASM 초기화
- Node (메모리 내 바이트): **~5 ms**.
- 브라우저 fetch 경로는 `rhwp_bg.wasm` = **4.0 MB** 다운로드 + 컴파일. 로컬 http.server 기준 실측 전이지만 Chrome streaming compile로 수백 ms 수준 예상.

### 파싱/렌더
- 가장 복잡한 샘플 1 (10페이지): 파싱 25 ms + 렌더 55 ms = **80 ms**.
- 페이지당 렌더 시간은 첫 페이지 21 ms → 이후 2–7 ms로 드롭(캐시/JIT 효과).
- 페이지당 HTML 크기: 10–50 KB.

**결론**: 성능은 충분히 상용 가능. 브라우저 업로드 후 1초 이내 렌더 기대 가능.

---

## 3. 중첩 표 보존 — **핵심**

### 측정 기준 — 두 가지 독립 검증

1. **HTML 토큰 스캐너**: `<table>`/`</table>` 태그를 순서대로 스택에 쌓아 최대 depth 계산.
2. **DOM 형상 검증**: `<td>` 바로 안에 `<table>`이 등장하는지 (중간에 `</td>`/`</table>` 없음) 실제로 스캔.
3. **Render tree AST 검증**: `getPageRenderTree(0)` JSON을 walk해서 `type:"Table"` 노드가 `type:"Cell"` 노드의 children 안에 있는지 카운트.

### 결과표

| 파일 | 총 `<table>` | max depth | nested open (depth>1) | `<td>` 안 `<table>` | tree: Cell 안 Table |
|---|---:|---:|---:|---:|---:|
| 1. 서울시여성가족재단 | 13 | 1 | 0 | 0 | 0 (page 0 only) |
| 2. 제1회 직원 채용 | 15 | **2** | **6** | **2** | **5** (page 0) |
| test.hwp | 20 | 1 | 0 | 0 | 0 (page 0) |

**샘플 2에서 3가지 독립 측정이 모두 일치 → renderPageHtml()은 실제로 `<table>` 안에 `<table>`을 emit**.

샘플 1과 test.hwp는 tree를 봐도 중첩 Table이 0이라 원본에 중첩이 없는 것으로 판단 — 파이프라인이 평탄화한 게 아니다.

### 실제 HTML 스니펫 (샘플 2, raw — `<table>` 안의 `<table>`)

스타일 속성은 `...`로 축약했으나 **태그 구조는 원본 그대로**:

```html
<table class="hwp-table" style="...">
  <td colspan="1" rowspan="1" style="...">
    <div class="text-line" style="...">
      <span class="text-run" style="...; font-family:'굴림', 'Malgun Gothic',...;">  </span>
    </div>
    <table class="hwp-table" style="position:absolute;left:70.77333333333333px;top:117.13333333333333px;width:399.59999999999997px;height:30.400000000000002px;border-collapse:collapse;">
      <div class="hwp-rect" style="...background:#892d5b;"></div>
      <td colspan="1" rowspan="1" style="width:31.733333333333334px;height:30.400000000000002px;">
        <div class="hwp-rect" style="...background:#1e1a6f;"></div>
        <div class="text-line" style="...">
          <span class="text-run" style="...font-family:'HY견고딕',...;font-size:24px;color:#ffffff;font-weight:bold;">1</span>
        </div>
      </td>
      ...
    </table>
  </td>
</table>
```

외곽 `<table>`은 "페이지 1개짜리 컨테이너 표"(rows=1, cols=1)이고, 그 안의 `<td>` 내부에 실제 콘텐츠 테이블이 들어 있다. 이게 우리가 원하던 계층이다.

### 중첩 셀 텍스트 — 올바른 위치에 있는가?

네. 안쪽 `<table>`의 `<td>`에 `<span class="text-run">1</span>` 같은 실제 셀 텍스트가 **정확한 계층**(outer td → inner table → inner td → text)으로 들어간다. tree도 동일한 계층을 표현.

### 🚨 하지만 경고 — `<tr>`이 없다

**모든 `<table>` 출력에 `<tr>`/`<tbody>`/`<thead>`/`<th>`가 단 하나도 없다**:

| 파일 | `<tr>` | `<td>` | `<tbody>` | `<th>` |
|---|---:|---:|---:|---:|
| 1 | 0 | 285 | 0 | 0 |
| 2 | 0 | 47 | 0 | 0 |
| test | 0 | 109 | 0 | 0 |

즉 `<table> → <td>` 직속 구조. 브라우저는 HTML5 파서 표준에 의해 암묵적으로 `<tbody>`/`<tr>`을 삽입하지만, 이 결과가 시맨틱하게 정돈된 HTML이 아니라는 것. **layout은 `position:absolute`로 제어되고 있음** — 즉 각 `<td>`에 `style="width:...px;height:...px;"`가 붙어 있고 row 그룹핑은 y좌표로 판별된다.

이게 왜 중요한가: Vision 프롬프트에 이 HTML을 그대로 넣으면 LLM이 행/열을 재구성해야 한다. **구조는 보존되지만 시맨틱은 없다**. 현재 pipeline이 절실히 요구하는 "행/열이 명확한 정규화된 `<table>`"을 얻으려면:

- `getPageRenderTree(page)`를 우리가 읽어서 `Table → Cell(row, col, rows, cols)` 구조를 직접 읽어내는 게 오히려 깨끗. tree의 Cell 노드에는 `"row":0,"col":0` 필드가 명시되어 있다 (샘플 2 tree 확인됨).
- 또는 rhwp HTML에 `row/col` 정보가 `<td>` 속성으로 남는지 추가 조사 필요 — 실측상 `colspan`/`rowspan`은 있으나 `data-row`/`data-col` 같은 힌트는 없어서 인덱스 정보는 tree에서 꺼내야 함.

---

## 4. 그 외 품질

### 한글 인코딩
- ✅ 완벽. `EUC-KR`/`UTF-16` 변환 이슈 없음.
- 샘플별 한글 음절 글자수: 13,285 / 4,537 / 4,471.
- 폰트 이름도 한글 원문(`'굴림'`, `'맑은 고딕'`, `'HY견고딕'`, `'함초롬바탕'` 등)이 UTF-8로 잘 들어감.

### 이미지/도형/머리말
- `<img>`: 0건 (세 샘플 모두 텍스트/표만 있는 공고문이라 그런 듯).
- `<svg>`: 0건.
- 도형은 `<div class="hwp-rect" style="...background:#892d5b;...">` 형태로 채워진 사각형으로 렌더됨 (실제 스니펫 참조). 원형/곡선은 이 샘플에선 발견되지 않음 — 다른 샘플로 별도 확인 필요하지만 스파이크 범위 밖.
- `getPageRenderTree(0)`에는 `{"type":"Header","bbox":...}` / `{"type":"PageBg"}` 같은 구조 정보가 들어감. Header/Footer 파싱 가능.
- `renderPageHtml`이 머리말을 HTML에 포함하는지: tree에 Header 노드가 있으나 HTML 본문에 어떻게 들어가는지는 구별 힘듦(모두 `position:absolute`라 DOM에 평탄화). 스파이크 범위 초과.

### CSS 스타일
- **인라인 `style="..."` 100% 사용**. `class="hwp-table"`, `class="hwp-rect"`, `class="text-line"`, `class="text-run"` 같은 식별용 class는 있지만 스타일은 외부 시트가 아님.
- 샘플 2 기준 인라인 style 644건 vs class 597건 — 각 요소 대부분에 둘 다 달려 있음.
- 거의 모든 위치가 `position:absolute; left:...px; top:...px;` 좌표 기반.

---

## 5. API 활용 제안

`renderPageHtml()`은 중첩을 **잘 보존**하지만, HTML 품질이 "페이지를 픽셀 단위로 재현"에 최적화되어 있어 우리의 Vision 프롬프트에 바로 넣기에는 과도하게 풍부(좌표, 폰트)하고 동시에 과소(`<tr>` 없음, 시맨틱 없음)하다.

**권장 전략 (우선순위 순)**:

1. **`getPageRenderTree(page)` 기반 커스텀 HTML 매퍼**를 우리가 작성.
   - tree는 이미 `Page → Body → Column → Table → Cell(row, col) → TextLine → TextRun` 계층이 명시적.
   - 각 Table의 `rows`, `cols` 필드가 tree 루트에 있고, 각 Cell에는 `row`, `col`이 있어 `<tr>`/`<td>`로 재구성 용이.
   - 중첩은 Cell.children에 또 다른 Table이 들어있는 형태로 그대로 보존되므로, 재귀 함수 하나로 정확한 중첩 HTML 생성 가능.
   - 좌표/폰트 정보를 버리고 순수 시맨틱 HTML만 추출 → Vision 토큰 크게 절약.

2. **`renderPageHtml()` 결과를 후처리**로 `<tr>` 삽입 + `position:absolute` 제거.
   - 구현량 많고 y-좌표 기반 행 추출이 휴리스틱.
   - 비추천 — tree에서 바로 뽑는 게 낫다.

3. **쓰기 작업 없이 read-only 파이프라인**으로만 쓰기.
   - 현재 우리 유스케이스는 "HWP → 정규화된 HTML → Vision → JSON"이므로 충분.
   - `HwpDocument`는 CQRS 모델로 편집 API도 다수 있지만 우리는 안 씀.

**한 줄 요약**: rhwp 채택 시 통합 계약은 "renderPageHtml이 아니라 getPageRenderTree를 읽어서 우리가 HTML 만든다"가 가장 깨끗하다.

---

## 6. 블로커

| 항목 | 상태 | 비고 |
|---|---|---|
| WASM 로딩 | ✅ OK | Node: `initSync({module: bytes})`. 브라우저: `init()`(default export) + `rhwp_bg.wasm` 정적 제공. |
| MIME (`.wasm` → `application/wasm`) | 🟡 미실측 | Python 3.9+ `http.server`는 OK. 프로덕션 배포는 nginx에서 명시 필요. |
| CORS | 🟡 미실측 | 로컬 origin 에서 npm 패키지 직접 import — 정적 경로면 문제 없음. |
| 폰트 | 🟡 주의 | `fallbackFont`가 `/usr/share/fonts/truetype/nanum/NanumGothic.ttf` (Linux 경로 하드코딩) → Windows/브라우저 런타임에서 실파일을 못 찾아도 크래시는 안 남 (렌더용 힌트일 뿐, `renderPageHtml()` 자체는 정상 동작). 다만 글자 폭은 정확하지 않을 수 있음. |
| `globalThis.measureTextWidth` 필요 | 🔴 반드시 제공 | 브라우저: canvas 1줄로 해결. Node: 커스텀 폴리필 (이 스파이크 방식). |
| 브라우저 호환 | 🟡 미실측 | WASM MVP + `WeakRef`/`FinalizationRegistry` 사용 (rhwp.js 확인). Chrome/Edge/Firefox 최신은 전부 지원. IE/구Safari 14- 는 불가. |
| `hop-main/` 의존 | ✅ 없음 | `@rhwp/core`는 독립 npm 패키지. hop-main 코드는 읽지도 복사하지도 않음. |
| `js/app.js` 변경 | ✅ 0 | 약속대로 미변경. |
| `APP_BUILD` 변경 | ✅ 0 | 미변경. |
| 배포 스크립트 실행 | ✅ 없음 | `scripts/deploy.sh` 미실행. |

---

## 7. 산출물 (`spike/rhwp-probe/`)

- `package.json` — `@rhwp/core@0.7.3` 고정.
- `index.html` — 파일 선택 UI + iframe + 4-탭 패널 (raw/tree/info/nested scan).
- `app.js` — 브라우저용 ESM. `init()` → `new HwpDocument(bytes)` → `renderPageHtml`/`getPageRenderTree`/`getDocumentInfo`.
- `run-node-probe.mjs` — Node 헤드리스 하네스. `measureTextWidth` 폴리필 내장. 세 샘플을 자동 실행하고 `probe-report.json`과 artifact HTML/tree 덤프.
- `probe-report.json` — 위 표에 들어간 숫자의 원천.
- `artifacts-*.html` — 샘플별 전체 페이지 렌더 결과 HTML (분석용).
- `tree-*.json` — 샘플별 `getPageRenderTree(0)` 원본 JSON.
- `README.md` — 재현 방법 (`npm install` → `python -m http.server 8090`).
- `node_modules/` — gitignore 대상 (폴더 내 `.gitignore`는 선택이라 넣지 않음; 브리프대로 gitignore 선택 옵션).

---

## 최종 한 줄 결론

**중첩 표 HTML 보존: Yes — `<td>` 안에 `<table>`을 실제로 emit하며 `getPageRenderTree`도 동일 계층을 명시한다. 단, 출력이 `position:absolute` 픽셀 레이아웃이고 `<tr>`을 생략하므로, Vision용으로는 `getPageRenderTree` → 커스텀 매퍼로 정규화 HTML을 재생성하는 경로가 최선이다.**
