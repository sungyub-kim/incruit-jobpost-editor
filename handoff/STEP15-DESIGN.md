# Step 15 — 구조/텍스트 분리 아키텍처 설계
*2026-04-16 기획자 작성. Project Owner 승인 대기. 개발자 참고용.*

## 1. 배경 / 최종 목표

**Project Owner 확정 목표:** 텍스트 누락 없음 + 테이블 그대로.

**근본 전략:** AI에게서 "텍스트 생성 권한"을 회수하고 "섹션 분류"로 역할을 축소. 텍스트와 테이블 구조는 코드가 원문에서 **그대로 복사**. 텍스트 변조를 **구조적으로 불가능**하게 만듦.

조사 결과(`STEP15-RESEARCH.md`)를 바탕으로 본 설계를 확정.

---

## 2. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│  [1] 원문 파싱                                               │
│   원문 HTML → DOM → SourceNode[] (블록 레벨별로 분할 + ID 부여)│
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│  [2] 메타 추출 (코드, AI 미사용)                             │
│   각 SourceNode의 text/color/url/starCount/nOfM/… 추출       │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│  [3] AI 섹션 분류 (유일한 AI 호출)                           │
│   SourceNode[] → {id, section} 매핑만. **텍스트 생성 금지.** │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│  [4] 조립 엔진 (코드)                                        │
│   노드 × 메타 × 분류 → 인크루트 표준 HTML 생성               │
│   · 텍스트 그대로 복사                                       │
│   · 테이블 DOM 그대로 유지                                   │
│   · 섹션 래핑, 특수 규칙 적용, 템플릿 래핑                   │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│  [5] 검증 레이어                                             │
│   원문 글자 단위 100% 일치 확인. 불일치 시 F + 로그.         │
└─────────────────────────────────────────────────────────────┘
```

**핵심 불변량:** [4] 조립 엔진은 **원문 텍스트를 한 글자도 변경·추가·삭제하지 않는다.** 이 불변량이 깨지면 아키텍처 자체가 실패.

---

## 3. 원문 노드 스키마

### 3-1. 블록 레벨 분할 원칙

원문 DOM을 **블록 레벨 엘리먼트** 단위로 분할. 각 블록이 1 SourceNode.

| DOM 태그 | 노드 타입 | 비고 |
|---|---|---|
| `<h1>` ~ `<h6>` | `heading` | 레벨 보존 |
| `<p>` | `para` | 인라인 스타일/span 보존 |
| `<table>` | `table` | 내부 구조(rowspan/colspan/tbody/tr/td/th) 그대로 |
| `<ul>` | `ulist` | 내부 li 그대로 |
| `<ol>` | `olist` | 내부 li 그대로 |
| `<blockquote>` | `quote` | 드물게 발생 |
| `<pre>` | `pre` | 드물게 발생 |
| `<div>` | 자식 노드 재귀 분할 | div 자체는 노드 아님 |
| `<br>` 연속 | 분할 구분자 | build 248 `processBrTagsByContext` 로직 유지 |

평문(줄바꿈 있는 텍스트) — `<p>` 또는 `<div>` 안의 텍스트 노드는 `<br>` 또는 줄바꿈 기준으로 쪼갤지 판단. **기본은 블록 단위 1 노드**. 단, 평문 번호 리스트(1. 2. 3.) 같은 경우는 조립 단계에서 `<ol>`로 재구성 가능.

### 3-2. SourceNode 인터페이스

```typescript
interface SourceNode {
  id: number;                    // 1부터 순차 증가
  type: 'heading' | 'para' | 'table' | 'ulist' | 'olist' | 'quote' | 'pre';
  level?: number;                // type === 'heading'일 때 1~6

  // 원문 보존 — 불변량의 핵심
  rawHtml: string;               // 이 블록의 outerHTML (인라인 스타일 포함)
  rawText: string;               // textContent (공백 정규화만)

  // 메타 — 코드가 추출 (AI 미개입)
  meta: SourceNodeMeta;
}

interface SourceNodeMeta {
  // 시각 속성
  colors?: Array<{
    text: string;                // 색상 적용된 부분 텍스트
    color?: string;              // 글자색
    backgroundColor?: string;    // 배경색
  }>;

  // 링크
  urls?: Array<{
    text: string;                // 링크 텍스트 (URL 자체 또는 anchor 텍스트)
    url: string;
    hrefExists: boolean;         // 원문에 이미 <a href>가 있었는지
  }>;

  // 리스트 관련
  listMarkerPattern?: string;    // "1.", "가.", "①", "○", "※", "*", "**", "***" 등
  starCount?: number;            // 별표 들여쓰기 레벨 (0=없음, 1=*, 2=**, 3=***)

  // 법률 조항
  nOfMPattern?: Array<{
    raw: string;                 // "6의1.", "제1조의2" 등 원문 문자열
    article: number;             // 예: 6
    subNumber: number;           // 예: 1
  }>;

  // 기호
  noteSymbol?: boolean;          // ※ 포함
  middleDots?: number;           // 가운뎃점(·, U+00B7) 개수

  // 표 전용
  tableStructure?: {
    rows: number;
    cols: number;
    hasRowspan: boolean;
    hasColspan: boolean;
    hasNestedTable: boolean;
    arrowCells?: Array<{ row: number; col: number }>;   // 화살표(→▶) 셀 위치
  };

  // 손상 감지 (복원 아님, 감지만)
  brokenChars?: Array<{
    char: string;                // PUA 영역 또는 알 수 없는 문자
    position: number;            // rawText 내 인덱스
    suspectedOriginal?: string;  // 추측 (낮은 확신)
  }>;
}
```

### 3-3. 파싱 함수 시그니처

```typescript
function parseSource(sourceHtml: string): SourceNode[];
```

순수 함수. 입력 같으면 출력 같음. AI 미호출.

---

## 4. AI 응답 스키마 (2026-04-16 Project Owner Q4 확정 반영: 헤딩 기반 분류)

### 4-1. AI의 유일한 역할 — **헤딩 분류**

AI에게 **텍스트 생성을 요구하지 않는다.** 또한 본문 노드(para/table/ulist/olist) 하나하나의 섹션도 묻지 않는다.

**AI는 오직 "헤딩 노드"만 받고, 각 헤딩이 어느 섹션에 해당하는지 분류한다.**

본문 노드의 섹션 소속은 **코드가 자동 결정** — DOM 순서상 가장 가까운 상위 헤딩의 섹션에 소속. 헤딩이 전혀 없는 공고는 전체가 `other` 단일 섹션.

**Project Owner 원칙 (Q4 확정):** "문서 내에 큰 타이틀로 구분된 것만 sec_wrap으로 구분. 타이틀 없으면 섹션 경계 없음."

### 4-2. "큰 타이틀" 감지 대상

`parseSource()` 단계에서 아래 패턴을 모두 `heading` 노드로 승격:

1. **명시적 heading 태그**: `<h1>` ~ `<h6>`
2. **번호 박스 패턴**: `<p>` 또는 `<div>` 안에 `1. 채용 근거`, `2. 채용 분야 및 인원` 같은 "번호 + 굵은 제목" 형태 (실제 감지 로직은 P3에서 샘플 보며 튜닝)
3. **`<strong>` 단독 단락**: `<p><strong>모집부문</strong></p>` 처럼 단락 전체가 strong인 경우

위에 해당 안 되면 본문 노드 (para/table/ulist/olist 등).

**Flag (P3 프로토타입에서 결정):** 번호 박스 패턴 감지 기준 — 원문 샘플을 보고 heuristic 확정. 오탐이 있으면 본문이 헤딩으로 잘못 승격되어 섹션 경계가 난사됨 → 이 감지 로직이 매우 중요.

### 4-3. AI 입력

**헤딩 노드만** 배열로 전달. 본문은 AI에 안 넘김 (토큰 대폭 절약 + 텍스트 생성 유혹 제거).

```json
{
  "headings": [
    { "id": 3, "level": 2, "text": "1. 채용 근거" },
    { "id": 12, "level": 2, "text": "2. 채용 분야 및 인원" },
    { "id": 25, "level": 2, "text": "3. 응시 자격" },
    { "id": 40, "level": 2, "text": "4. 전형 절차" },
    { "id": 55, "level": 2, "text": "5. 접수 방법" }
  ]
}
```

### 4-4. AI 응답 스키마

```json
{
  "headings": [
    { "id": 3, "section": "misc" },
    { "id": 12, "section": "positions" },
    { "id": 25, "section": "requirements" },
    { "id": 40, "section": "process" },
    { "id": 55, "section": "application" }
  ]
}
```

### 4-5. 본문 노드 자동 소속 규칙 (코드 처리)

1. 노드 배열을 DOM 순서대로 순회
2. heading 노드를 만나면 "현재 섹션"을 그 heading의 section으로 업데이트
3. 본문 노드는 "현재 섹션"에 소속
4. 첫 heading 이전의 본문 노드들 → **섹션 경계 없이 원문 순서로** (Q4 (a) 원칙: 헤딩 없으면 sec_wrap 만들지 않음)

```typescript
function groupNodesBySection(
  nodes: SourceNode[],
  headingMapping: Map<number, SectionId>
): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let currentGroup: SectionGroup | null = null;

  for (const node of nodes) {
    if (node.type === 'heading' && headingMapping.has(node.id)) {
      // 새 섹션 시작
      currentGroup = {
        section: headingMapping.get(node.id)!,
        heading: node,
        nodes: []
      };
      groups.push(currentGroup);
    } else if (currentGroup) {
      // 현재 섹션에 본문 추가
      currentGroup.nodes.push(node);
    } else {
      // 첫 heading 이전 영역 — "무소속" 그룹
      if (!groups.length || groups[0].section !== '__intro__') {
        groups.unshift({ section: '__intro__', heading: null, nodes: [] });
      }
      groups[0].nodes.push(node);
    }
  }

  return groups;
}
```

### 4-6. 허용 섹션 (열거형, 인크루트 표준 — 변경 없음)

| 섹션 ID | 한글 표시 |
|---|---|
| `job_title` | 공고 제목 (h1) |
| `company_intro` | 회사소개 |
| `positions` | 모집부문/모집분야 |
| `duties` | 담당업무/주요업무 |
| `requirements` | 자격요건/지원자격 |
| `preferred` | 우대사항 |
| `conditions` | 근무조건/근무환경 |
| `salary` | 급여/연봉 |
| `benefits` | 복리후생 |
| `process` | 전형절차/채용절차 |
| `period` | 접수기간/모집기간 |
| `application` | 접수방법/지원방법 |
| `misc` | 기타안내/유의사항 |
| `other` | 기타 (위 13개에 해당 안 되는 경우) |

AI는 위 14개 중 하나만 선택. 임의 섹션명 반환 금지.

### 4-7. 프롬프트 재설계 (헤딩 분류기)

```
당신은 채용공고 헤딩 분류기입니다.

입력: 원문에서 추출한 "큰 타이틀(헤딩)" 배열. 각 헤딩에 id와 text가 있습니다.
출력: 각 헤딩이 어느 섹션에 해당하는지 JSON으로 반환.

허용 섹션:
- job_title: 공고 제목
- company_intro: 회사 소개
- positions: 모집 부문/분야
- duties: 담당 업무
- requirements: 자격 요건
- preferred: 우대 사항
- conditions: 근무 조건
- salary: 급여
- benefits: 복리후생
- process: 전형 절차
- period: 접수 기간
- application: 지원 방법
- misc: 기타 안내
- other: 위에 해당 안 됨

규칙:
1. 헤딩 텍스트만 보고 섹션을 결정하세요.
2. 텍스트를 수정·생성·추가하지 마세요. 오직 분류만.
3. 판단 불가한 헤딩은 "other"로.
4. 응답은 JSON만. 설명 금지.

입력 헤딩:
{{headings_json}}

출력 JSON:
```

**토큰 대폭 절감:**
- 기존: 전체 공고 HTML(수천 자) + 6개 최우선 규칙 + 세부 변환 규칙 수십 개 → 평균 **3000~5000 토큰**
- 신규: 헤딩 5~15개 (각 수십 자) + 규칙 4줄 → 평균 **300~500 토큰**
- **약 10배 절감 + AI 판단 단순화 + 환각 여지 제거**

### 4-8. 모델 선택

헤딩 분류는 단순 작업 (몇 개 고정 카테고리 중 하나 선택) → **Haiku 4.5 충분 가능**. Opus 4.6은 오버킬.
다만 프로토타입에서는 Opus로 시작 → 안정화 후 Haiku로 다운그레이드 테스트.

---

## 5. 메타 추출 인터페이스

각 SourceNode에 대해 코드가 추출하는 메타데이터 목록. 순수 함수, AI 미호출.

```typescript
function extractMeta(rawHtml: string, rawText: string, type: string): SourceNodeMeta;
```

### 5-1. 추출 항목별 로직

| # | 메타 항목 | 추출 로직 | 복잡도 |
|---|---|---|---|
| 1 | `colors[]` | DOM 순회하며 `style` 속성의 `color`/`background-color` 추출 + 해당 텍스트 범위 저장 | 중간 |
| 2 | `urls[]` | 정규식 `/https?:\/\/[^\s<>"']+/g` + 기존 `<a href>` 태그 감지 | 낮음 |
| 3 | `listMarkerPattern` | 정규식 `/^(\d+\.|[가-힣]\.|①②③...|○●|※|\*+)/` 줄 첫 부분 감지 | 낮음 |
| 4 | `starCount` | 줄 첫 부분 연속 `*` 개수 | 낮음 |
| 5 | `nOfMPattern[]` | 정규식 `/(\d+)의(\d+)\.|제(\d+)조의(\d+)/` 매칭 | 낮음 |
| 6 | `noteSymbol` | `※` 포함 여부 | 낮음 |
| 7 | `middleDots` | `·`(U+00B7) 개수 | 낮음 |
| 8 | `tableStructure` | `<table>` 내부 `<tr>`/`<td>` 순회, rowspan/colspan 집계, 중첩 table 감지 | 중간 |
| 9 | `arrowCells[]` | 테이블 셀 내용이 `→` / `▶` 단독인 경우 위치 저장 | 낮음 |
| 10 | `brokenChars[]` | PUA 영역(U+E000~U+F8FF) 및 `\uFFFD` 등 감지. 복원은 시도만, 실패 시 원문 유지 | 높음 |

### 5-2. 추출 호출 시점

`parseSource()` 내부에서 각 SourceNode 생성 시 `extractMeta()` 호출. 파싱 단계에서 메타가 완성된 상태로 AI로 전달됨.

---

## 6. 조립 엔진 인터페이스

```typescript
function assemble(
  nodes: SourceNode[],
  classification: AIClassification,
  options: AssembleOptions
): AssembledOutput;

interface AssembleOptions {
  templateType: 'v3_standard' | 'v3_border' | ...;
  keyVisual?: { url: string; title: string };
  jobNumber?: string;
  useIncruitWrapper: boolean;
}

interface AssembledOutput {
  html: string;                 // 최종 HTML
  debug: {
    sectionOrder: string[];     // 섹션 순서
    nodeCount: number;
    unmappedCount: number;
    textMatchConfidence: number;// 100 기대
  };
}
```

### 6-1. 조립 순서 (2026-04-16 Q3/Q4 확정 반영: 헤딩 기반 섹션)

```
1. 헤딩 기반 그룹핑 (§4-5 `groupNodesBySection()` 결과 사용)
   - 각 그룹: { section: SectionId, heading: SourceNode|null, nodes: SourceNode[] }
   - __intro__ 그룹: 첫 헤딩 이전 영역 (sec_wrap 없이 원문 순서로 렌더링)

2. 섹션 순서 결정
   - AI 재배열 금지: **원문 등장 순서 그대로 유지** (Project Owner 원칙 — 원문 보존)
   - 참고: 인크루트 표준 순서는 검증·디버깅용, 강제 재배열 안 함

3. 각 그룹 렌더링
   CASE __intro__ (헤딩 없는 첫 영역):
     - sec_wrap 생성 안 함 (Q4 (a) 원칙)
     - 본문 노드를 원문 순서로 렌더링 (아래 노드별 규칙과 동일)

   CASE 일반 섹션 (heading 존재):
     a. sec_wrap 생성 + heading을 그대로 섹션 제목으로 사용
        - 원문 heading 텍스트 "1. 채용 근거"를 그대로 표시 (Q4: 원문에 없는 제목 생성 안 함)
        - `<div class="sec_wrap"><div class="sec_title_wrap"><h3>1. 채용 근거</h3></div>...`
     b. 섹션 내부 본문 노드 순회:
        - heading → `<h3>` or `<p><strong>` (하위 heading)
        - para → `<p>` (텍스트 + 색상 보존)
        - table → `<table>` 원문 그대로 (rowspan/colspan/중첩 불변, 인크루트 클래스만 부여)
        - ulist → `<ul class="ulist check|dash|noti">`
        - olist → `<ol class="olist|kolist">`
        - 평문 번호 패턴 → `<ol>` 재구성 (원문 번호 텍스트 그대로 li 내부에 유지)
        - 별표 패턴 → `<p class="star-list-indent">` (padding + nbsp 계산, 별표는 원문 그대로)
        - ※ 패턴 → `<ul class="ulist noti">` (기호는 원문에 유지하거나 CSS 대체 — P3에서 결정)
        - 가운뎃점 → 텍스트 그대로 (변조 없음)
        - URL → 텍스트 내 `<a>` 래핑 (텍스트 변경 없음, 태그만 추가)

4. 인크루트 템플릿 래핑 (옵션에 따라)
   `<div id="templwrap_v3">` + 키비주얼 + 콘텐츠 + CSS 링크 + isIncruit input

---

**구조 생성 금지 원칙 (Q3 확정):**
- 평문은 평문으로 유지. `<table>` 자동 생성 안 함.
- 예: 원문 "지원접수 → 서류전형 → 면접 → 합격"이 `<p>` 안에 평문으로 있으면, 결과도 `<p>` 평문. STEP 표 자동 변환 없음.
- 원문이 이미 `<table>`이면 그대로 보존.

**구조 추가 허용 범위 (보수적):**
- 평문 번호 리스트(1. 2. 3.)가 `<p>` 줄바꿈으로 나열된 경우 → `<ol>`로 **구조 보강** 허용
  - 이유: 사용자가 번호를 보고 "리스트"로 읽음 — 구조 보강은 의미 보존. 텍스트 변경 0.
- ※ 단락이 있는 경우 → `<ul class="ulist noti">`로 **클래스 부여** (구조가 아닌 스타일)
- 이 외 모든 **태그 생성**은 금지.

### 6-2. 불변량 확인 — 텍스트 100% 일치

조립 후 `verifyTextParity(sourceHtml, assembledHtml)`:
- 원문 텍스트 정규화 (공백 단일화, 제어문자 제거)
- 조립 결과 텍스트 정규화
- **글자 단위 완전 일치 확인**
- 불일치 시 F 등급 + 조립 엔진 로그에 경고

**목표치:** 100%. 99%가 아니라 100%. 불일치는 구현 버그.

---

## 7. 검증 레이어 (기존 verifyConversion 대체)

### 7-1. 기존 검증 (V1~V6) → 단순화

새 아키텍처에서는 **V1(창작 검출), V3(보호 단어 소실)은 이론상 발생 불가**. 검증이 단순화됨:

```typescript
function verifyNewPipeline(
  sourceHtml: string,
  assembledHtml: string,
  classification: AIClassification
): VerifyReport;
```

체크 항목:
1. **텍스트 완전 일치** (글자 단위 100%)
2. **테이블 구조 일치** — 원문 `<table>` HTML과 조립 결과의 테이블 HTML 비교 (rowspan/colspan 포함)
3. **노드 매핑 완전성** — 모든 노드가 섹션에 배치됨 (unmapped 0건)
4. **특수 기호 일치** — ·, ※, ○, ※ 등 개수 불변

A 등급: 4개 모두 통과
B 등급: 텍스트 100% + 테이블 100%이지만 unmapped 있음 (기타 섹션으로 fallback)
F 등급: 텍스트 또는 테이블 100% 미달성 (= 조립 엔진 버그)

기존 V1~V6은 **AI가 텍스트를 생성하던 시절의 검증**. 새 아키텍처에서는 F가 나오면 코드 버그이므로 오히려 빨리 드러나는 게 좋음.

### 7-2. F 차단 게이트 (Step 14.6) — 그대로 유지

build 291의 게이트 로직은 새 파이프라인에서도 그대로 작동. `verifyResult`를 여전히 메시지에 저장하고 F일 때 다운로드/복사 차단.

---

## 8. 기존 함수 이관/폐기 매핑

`STEP15-RESEARCH.md`의 24개 함수 대상:

### 8-1. 이관 (새 엔진으로 로직 이동)

| 기존 함수 | 이관 위치 | 변경 방향 |
|---|---|---|
| `wrapInV3Sections()` | 조립 엔진 §6 | 섹션 그룹핑 + sec_wrap 생성 |
| `applyIncruitTableClasses()` | 조립 엔진 §6 table 렌더러 | 원문 테이블에 클래스 부여 |
| `fixPlainTextNumberedList()` | 조립 엔진 §6 ol 렌더러 | 평문 번호 패턴 감지 후 ol 구성 |
| `fixLegalSubNumbering()` | 조립 엔진 §6 olist 렌더러 | N의M 메타 기반 들여쓰기 |
| `processBrTagsByContext()` | `parseSource()` | 파싱 단계에서 br 처리 |
| `applyHasMarkerClass()` | 조립 엔진 §6 | 리스트 렌더러에 포함 |
| `wrapInSectionStructure()` | 조립 엔진 §6 | 섹션 HR-JSON 메타 부여 |
| `applyPostTypeProcessing()` | 조립 옵션 `templateType` | 유형별 분기 |
| `convertByRules()` | 폴백 경로 | AI 실패 시 규칙만으로 분류 |

### 8-2. 폐기 (새 아키텍처에서 불필요)

| 기존 함수 | 폐기 사유 |
|---|---|
| `fixStarIndent()` | AI가 텍스트를 건드리지 않으므로 원문 기반 강제 복원 불필요. 메타 추출 + 조립 렌더러로 대체. |
| `fixMiddleDots()` | 원문 가운뎃점이 코드에 의해 그대로 복사됨. 깨진 "틀" 문자 교정은 원문 전처리 단계(HWP PUA)로 이동. |
| `fixLegalArticleStructure()` | 원문 "제N조" 텍스트가 그대로 복사됨. 구조는 메타 기반 조립 렌더러로. |
| `fixDoubleMarkers()` | CSS 마커와 텍스트 마커 중복 상황 자체가 발생 안 함 (텍스트는 원문 그대로, CSS는 조립 시 결정). |
| `fixArbitraryColors()` | AI가 색상을 추가하지 않으므로 제거 불필요. |
| `renestOrphanedTables()` | AI가 중첩 테이블을 분리하지 않으므로 복원 불필요. |

### 8-3. 유지 (새 아키텍처와 무관)

| 기존 함수 | 유지 사유 |
|---|---|
| `verifyConversion()` | Step 14 검증 로직. 새 파이프라인 전환 중에는 기존 경로에서 계속 작동. 새 경로는 §7의 `verifyNewPipeline`. |
| `checkVerifyGate()` + 모달 (Step 14.6) | UI 레이어. 두 파이프라인 공통. |
| `sanitizeForAI()` | 당분간 기존 경로에서만 사용. 새 파이프라인은 sanitize 없이 JSON 메타를 직접 전달. |
| `callClaude/callOpenAI/callGemini` | AI 호출 함수. 새 파이프라인도 재사용. |

---

## 9. 마이그레이션 전략

### 9-1. 점진 도입 — 기존 경로 유지 + 새 경로 토글

```js
// 사이드바 설정 (또는 개발자 도구 localStorage)
localStorage.setItem('pipeline_version', 'v2');  // 새 파이프라인
localStorage.setItem('pipeline_version', 'v1');  // 기존 (기본값)
```

변환 시작 시 토글 읽어 분기:
```js
if (state.pipelineVersion === 'v2') {
  convertedHtml = await convertV2(sourceHtml);
} else {
  convertedHtml = await convertV1(sourceHtml);  // 기존
}
```

### 9-2. 파일 배치

- `js/v2/parser.js` — `parseSource()`, `extractMeta()`
- `js/v2/classifier.js` — AI 호출, 프롬프트, 응답 파싱
- `js/v2/assembler.js` — `assemble()`, 섹션 렌더러, 인크루트 클래스 적용
- `js/v2/verify.js` — `verifyNewPipeline()`
- `js/v2/index.js` — `convertV2(sourceHtml, options)` 오케스트레이터

별도 파일/디렉토리로 격리 → 기존 코드와 충돌 방지, 롤백 용이.

### 9-3. 전환 단계

1. v2 구현 + 토글 추가 (코드 배포하되 기본값 v1)
2. Project Owner가 개인적으로 v2 테스트 (localStorage 토글)
3. 공고 유형별 성공률 집계
4. 충분히 안정되면 v2를 기본값으로 전환
5. 모든 유형 안정 후 v1 경로 제거 + 폐기 대상 함수 삭제 (§8-2)

---

## 10. 프로토타입 범위

### 10-1. P3 프로토타입 A — 평문 공고 (표 없음)

**범위:**
- `parseSource()` — 블록 분할 + rawHtml/rawText 저장
- `extractMeta()` — colors/urls/listMarkerPattern/starCount/middleDots만 (표 없으므로 tableStructure 제외)
- `classifier()` — AI 섹션 분류 호출
- `assemble()` — 섹션 렌더러 기본 (heading/para/ulist/olist만)
- `verifyNewPipeline()` — 글자 100% 일치 확인

**제외:**
- 테이블 처리
- 중첩 테이블
- 복잡한 인크루트 특수 규칙 (N의M, 별표 들여쓰기 등은 P4에서)
- 템플릿 래핑 (templwrap_v3) — P4에서 추가

**성공 기준:**
1. 원문 글자 100% 일치
2. 섹션 분류 정확도 ≥ 90% (Project Owner 수동 확인)
3. 조립 결과가 인크루트 v3 레이아웃으로 표시

**테스트 케이스:** Project Owner가 1~3개 평문 공고 제공. 최소한 1개는 2026-04-14 환각 재현 케이스(경력증명서 공고)를 포함.

### 10-2. P4 프로토타입 B — 표 포함 공고

**범위 추가:**
- `tableStructure` 메타 추출
- 조립 엔진의 table 렌더러
- rowspan/colspan 검증
- 중첩 테이블 (td 안 table)
- 화살표 셀

**성공 기준:**
1. 원문 테이블 HTML 0% 변조 (rowspan/colspan 동일)
2. 중첩 테이블 구조 그대로 보존
3. 인크루트 클래스 부여 정확

### 10-3. P5 이후

P3+P4가 성공하면 남은 특수 규칙(별표/N의M/PUA/템플릿 래핑) 순차 확장 → 점진 도입 → 기본값 전환 → 구 경로 제거.

---

## 11. Open Questions — 확정 (2026-04-16 Project Owner 답변)

| Q | 질문 | 결정 |
|---|---|---|
| **Q1** | 섹션 14개 충분? | **유지** ✓ (필요 시 추가 가능) |
| **Q2** | 섹션 외 노드 처리 | **`other` fallback** ✓ |
| **Q3** | 평문 → 표 자동 변환 | **(a) 금지** ✓ — 평문은 평문, 표는 표 그대로 |
| **Q4** | 원문에 없는 제목 생성 | **(a) 금지** ✓ — 큰 타이틀 있는 섹션만 sec_wrap, 없으면 섹션 경계 없음 |
| **Q5** | Haiku 다운그레이드 | 프로토타입 Opus → 안정화 후 Haiku 테스트 ✓ |
| **Q6** | P3 테스트 공고 | 경력증명서(환각 재현) + 표 공고(이미지 예시) + 평문 공고 ✓ |

**원칙 수렴:** 모든 Q 결정이 **"원문 보존, 생성 최소화"**로 일관 수렴. 설계 확정.

**Q3·Q4 반영 지점:**
- §4 AI 응답 스키마 → **헤딩 기반 분류**로 개정 (Q4 원칙)
- §6 조립 엔진 → sec_wrap은 원문 헤딩 있는 그룹만, 평문 → 표 변환 금지 (Q3·Q4)

---

## 12. 설계 검토 체크리스트 — 기획자 자체 검토 완료

- [x] 2. 아키텍처 5단계 파이프라인이 "텍스트 누락 없음 + 테이블 그대로" 목표에 부합 — AI가 텍스트/구조 둘 다 생성 안 함
- [x] 3. 블록 레벨 분할 원칙 — p/table/ul/ol/h1~6 + 번호 박스/strong 단락까지 헤딩 승격
- [x] 4-6. 14개 섹션 ID로 채용공고 일반 유형 커버
- [x] 4-7. AI 프롬프트가 "헤딩 분류"로만 구성 — 토큰 약 10배 절감 + 환각 여지 제거
- [x] 5. 10개 메타 추출 항목이 16개 특수 규칙 매핑
- [x] 7. 검증 레이어 — 텍스트 100% 일치 + 테이블 100% 일치 + 헤딩 매핑 + 기호 개수 불변
- [x] 8-2. 폐기 대상 6개 함수(`fixStarIndent`/`fixMiddleDots`/`fixLegalArticleStructure`/`fixDoubleMarkers`/`fixArbitraryColors`/`renestOrphanedTables`) — 새 아키텍처에서 구조적으로 불필요
- [x] 9. 점진 도입 — `js/v2/` 디렉토리 + localStorage 토글로 격리·롤백 용이
- [x] 10. P3/P4 범위 — P3(평문) → P4(표) 순차, 각 성공 기준 명확
- [x] 11. Q1~Q6 전부 확정

---

## 13. 다음 단계

**설계 확정 완료. P3 착수 준비 단계.**

- 기획자: ARCHITECT-BRIEF.md에 P3 프로토타입 스펙 작성 (다음 세션 또는 Project Owner 지시 시)
- 개발자: P3 착수 지시 받으면 `js/v2/` 디렉토리 생성하고 프로토타입 구현
- Project Owner: P3 테스트용 공고 1~3건 준비 (경력증명서 환각 케이스 포함)
- 검수자: P3 결과 원문 글자 100% 일치 수동 검증

설계 문서는 여기서 멈춤. 코드 변경 없음. 구현은 P3 브리프 + 개발자 Agent 가동 시 시작.
