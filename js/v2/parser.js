/**
 * v2/parser.js — 원문 HTML 파싱 + SourceNode[] 생성
 * Step 15 P3 프로토타입
 */
import { extractMeta } from './meta.js';

// 블록 레벨 태그 목록
const BLOCK_TAGS = new Set([
  'P', 'TABLE', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'HR', 'FIGURE', 'FIGCAPTION', 'DL'
]);

// 헤딩 태그
const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

// 주요 번호 패턴 — 섹션 타이틀 (1., 2., Ⅰ., Ⅱ.)
const MAIN_NUMBER_RE = /^[\s]*(\d+\.|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\.)\s*/;
// 한국어 소제목 번호 (가., 나., 다.) — heading 아닌 para로 유지
const SUB_NUMBER_RE = /^[\s]*[가나다라마바사아자차카타파하]\.\s*/;

// (HEADING_MAX_LENGTH 삭제 — detectParagraphHeading 내부에 인라인 처리)

/**
 * 원문 HTML을 SourceNode 배열로 파싱
 * @param {string} sourceHtml - 원문 HTML (convert-server에서 추출된 것)
 * @returns {SourceNode[]}
 */
export function parseSource(sourceHtml) {
  const container = document.createElement('div');
  container.innerHTML = sourceHtml;

  const nodes = [];
  let nextId = 1;

  function processChildren(parent) {
    for (const child of Array.from(parent.childNodes)) {
      // 텍스트 노드 — 공백만이면 건너뜀
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.trim();
        if (text) {
          // 텍스트 노드를 p로 래핑
          const node = createNode(nextId++, 'para', null, child);
          nodes.push(node);
        }
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = child.tagName;

      // div — 자식 재귀 분할 (div 자체는 노드 아님)
      if (tag === 'DIV') {
        processChildren(child);
        continue;
      }

      // br 단독 — 건너뜀 (분할 구분자)
      if (tag === 'BR') continue;

      // span/a 등 인라인 요소가 블록처럼 등장 — para로 처리
      if (!BLOCK_TAGS.has(tag) && !HEADING_TAGS.has(tag)) {
        const text = child.textContent.trim();
        if (text) {
          const node = createNode(nextId++, 'para', null, child);
          nodes.push(node);
        }
        continue;
      }

      // 블록 레벨 요소
      if (HEADING_TAGS.has(tag)) {
        // h1~h6 → 무조건 heading
        const level = parseInt(tag.charAt(1));
        const node = createNode(nextId++, 'heading', level, child);
        nodes.push(node);
      } else if (tag === 'TABLE') {
        const node = createNode(nextId++, 'table', null, child);
        nodes.push(node);
      } else if (tag === 'UL') {
        const node = createNode(nextId++, 'ulist', null, child);
        nodes.push(node);
      } else if (tag === 'OL') {
        const node = createNode(nextId++, 'olist', null, child);
        nodes.push(node);
      } else if (tag === 'BLOCKQUOTE') {
        const node = createNode(nextId++, 'quote', null, child);
        nodes.push(node);
      } else if (tag === 'PRE') {
        const node = createNode(nextId++, 'pre', null, child);
        nodes.push(node);
      } else if (tag === 'P') {
        // p 태그 — 헤딩 승격 판정
        const headingInfo = detectParagraphHeading(child);
        if (headingInfo) {
          const node = createNode(nextId++, 'heading', headingInfo.level, child);
          nodes.push(node);
        } else {
          const text = child.textContent.trim();
          if (text || child.querySelector('img')) {
            const node = createNode(nextId++, 'para', null, child);
            nodes.push(node);
          }
        }
      } else {
        // HR, FIGURE, DL 등 기타 블록
        const text = child.textContent.trim();
        if (text || tag === 'HR') {
          const node = createNode(nextId++, 'para', null, child);
          nodes.push(node);
        }
      }
    }
  }

  processChildren(container);

  // ─── 후처리 0: 테이블 분할 셀 병합 ───
  // HWP에서 페이지 넘김 등으로 하나의 셀이 여러 행으로 나뉜 경우 병합
  // 패턴: 이전 행의 마지막 td(colspan=N)가 번호 목록이고, 다음 행의 td(colspan=N)가 이어지는 번호
  _mergeTableSplitCells(nodes);

  // ─── 후처리 1: 들여쓰기 이어쓰기 줄 병합 ───
  // HWP에서 한 문장이 줄바꿈으로 별도 <p>가 되는 경우 병합
  // rawText는 trim되어 있으므로, rawHtml에서 태그 제거하여 원본 공백 확인
  const NOT_CONTINUATION_RE = /^[\s]*[·∙•※○●◎◇◆▶▷★☆□■\-①②③④⑤⑥⑦⑧⑨⑩가나다라마바사\d]/;
  for (let i = nodes.length - 1; i >= 1; i--) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    if (prev.type !== 'para' || curr.type !== 'para') continue;

    // rawHtml에서 태그 제거하여 원본 텍스트(앞공백 포함) 복원
    const untrimmedText = curr.rawHtml.replace(/<[^>]+>/g, '');
    if (!/^[\s\u00A0]{5,}/.test(untrimmedText)) continue;
    if (NOT_CONTINUATION_RE.test(untrimmedText.trim())) continue;

    // 이전 단락에 병합
    prev.rawHtml = prev.rawHtml.replace(/<\/p>\s*$/i, '')
      + '<br>' + curr.rawHtml.replace(/^<p[^>]*>/i, '');
    prev.rawText = prev.rawText + '\n' + curr.rawText;
    nodes.splice(i, 1);
  }

  // ─── 후처리 2: 독립 숫자 단락 + 바로 다음 heading 병합 ───
  for (let i = nodes.length - 2; i >= 0; i--) {
    const curr = nodes[i];
    const next = nodes[i + 1];
    if (curr.type === 'para' && next.type === 'heading' && /^\s*\d+\s*$/.test(curr.rawText)) {
      next.sectionNumber = curr.rawText.trim();
      nodes.splice(i, 1);
    }
  }

  return nodes;
}

/**
 * SourceNode 생성
 */
function createNode(id, type, level, element) {
  // 텍스트 노드인 경우 래핑
  let rawHtml, rawText;
  if (element.nodeType === Node.TEXT_NODE) {
    rawHtml = element.textContent;
    rawText = element.textContent.trim();
  } else {
    rawHtml = element.outerHTML;
    rawText = element.textContent.trim();
  }

  const node = { id, type, rawHtml, rawText };
  if (level != null) node.level = level;

  // 메타 추출
  node.meta = extractMeta(rawHtml, rawText, type);

  return node;
}

/**
 * <p> 태그의 헤딩 승격 판정
 * @returns {{ level: number }} | null
 */
function detectParagraphHeading(pElement) {
  const text = pElement.textContent.trim();
  if (!text) return null;

  // 길이 제한 — 25자 초과는 heading이 아님 (섹션 제목은 보통 15자 이내)
  if (text.length > 25) return null;

  // 최소 길이 — 2자 미만은 heading이 아님
  if (text.length < 2) return null;

  // 순수 숫자/기호만 있는 단락 제외 (예: "1", "2", "※", "○" 등)
  if (/^[\s\d.\-·•※○●◎◇◆▶▷★☆()\[\]]+$/.test(text)) return null;

  // ※ 또는 블릿으로 시작하는 단락 → 주석/안내문이므로 heading 아님
  if (/^[※·•○●◎▶▷★☆□■\-]/.test(text)) return null;

  // 3+ 공백 들여쓰기 → heading 아님
  const rawText = pElement.textContent;
  if (/^[\s\u00A0]{3,}/.test(rawText)) return null;

  // 한국어 서술어 어미로 끝나는 경우 → 문장이므로 heading 아님
  if (/(?:있음|없음|됨|함|임|것|등|바람|바랍니다|합니다|됩니다|습니다|입니다|않음|않습니다|십시오|세요|한다|된다|이다)[\s.)]*$/.test(text)) return null;

  // 한국어 소제목 번호(가., 나.) → heading 아님 (상위 섹션 안에 포함)
  if (SUB_NUMBER_RE.test(text)) return null;

  // 주요 번호 패턴(1., 2., Ⅰ.) → heading (볼드 없어도 감지)
  if (MAIN_NUMBER_RE.test(text)) {
    return { level: 2 };
  }

  // p 전체가 <strong> 또는 <b>로 감싸진 경우 → heading
  if (isEntirelyBoldWrapped(pElement)) {
    return { level: 2 };
  }

  return null;
}

/**
 * p 전체가 <strong> 또는 <b>로 감싸져 있는지 확인
 * 허용 패턴:
 *   <p><strong>텍스트</strong></p>
 *   <p><b>텍스트</b></p>
 *   <p><strong><span...>텍스트</span></strong></p>
 */
function isEntirelyBoldWrapped(pElement) {
  // 의미 있는 자식만 추출 (공백 텍스트 노드 제외)
  const meaningful = Array.from(pElement.childNodes).filter(n => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent.trim() !== '';
    if (n.nodeType === Node.ELEMENT_NODE) return true;
    return false;
  });

  if (meaningful.length !== 1) return false;

  const child = meaningful[0];
  if (child.nodeType !== Node.ELEMENT_NODE) return false;

  const tag = child.tagName;
  if (tag !== 'STRONG' && tag !== 'B') return false;

  // strong/b의 텍스트가 p의 텍스트와 동일해야 함 (전체 감싸짐)
  const pText = pElement.textContent.trim();
  const boldText = child.textContent.trim();
  return pText === boldText;
}

/**
 * p 내부에 strong 또는 b 자식이 하나라도 있는지
 */
// containsBoldChild 삭제 — 번호 패턴 heading 제거로 미사용 (build 331)

/**
 * 테이블 분할 셀 병합
 * HWP에서 페이지 넘김 등으로 하나의 셀이 여러 행으로 나뉜 경우를 감지하여 병합.
 *
 * 감지 조건:
 * - 연속된 두 <tr>의 <td>가 같은 colspan으로 전체 열을 차지
 * - 이전 셀 텍스트가 번호(N.)로 끝나고, 다음 셀이 이어지는 번호(N+1.)로 시작
 * - 또는 이전 셀과 다음 셀이 모두 colspan으로 전체 열을 차지하는 텍스트 블록
 */
function _mergeTableSplitCells(nodes) {
  for (const node of nodes) {
    if (node.type !== 'table') continue;

    // rawHtml을 DOM으로 파싱
    const container = document.createElement('div');
    container.innerHTML = node.rawHtml;
    const table = container.querySelector('table');
    if (!table) continue;

    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
    if (rows.length < 2) continue;

    // 테이블 전체 열 수 계산
    let maxCols = 0;
    for (const row of rows) {
      let cols = 0;
      for (const cell of row.querySelectorAll(':scope > td, :scope > th')) {
        cols += parseInt(cell.getAttribute('colspan') || '1');
      }
      maxCols = Math.max(maxCols, cols);
    }

    let merged = false;

    // 역방향으로 순회 (병합 시 인덱스 변동 방지)
    for (let i = rows.length - 1; i >= 1; i--) {
      const prevRow = rows[i - 1];
      const currRow = rows[i];

      const prevCells = prevRow.querySelectorAll(':scope > td, :scope > th');
      const currCells = currRow.querySelectorAll(':scope > td, :scope > th');

      // 현재 행이 단일 셀(colspan=전체)인 경우만
      if (currCells.length !== 1) continue;
      const currCell = currCells[0];
      const currColspan = parseInt(currCell.getAttribute('colspan') || '1');
      if (currColspan < maxCols) continue;

      // 이전 행에서 같은 colspan의 셀 찾기
      let prevCell = null;
      for (const cell of prevCells) {
        const cs = parseInt(cell.getAttribute('colspan') || '1');
        if (cs >= maxCols) {
          prevCell = cell;
          break;
        }
      }
      if (!prevCell) continue;

      // 번호 연속성 확인: 이전 셀 마지막 번호 → 현재 셀 첫 번호
      const prevText = prevCell.textContent;
      const currText = currCell.textContent;

      // 이전 셀 마지막 번호 추출 (예: "10." 또는 "10. 텍스트")
      const prevNumMatch = prevText.match(/(\d+)\.\s*[^\d]*$/);
      // 현재 셀 첫 번호 추출
      const currNumMatch = currText.match(/^\s*(\d+)\./);

      if (prevNumMatch && currNumMatch) {
        const prevNum = parseInt(prevNumMatch[1]);
        const currNum = parseInt(currNumMatch[1]);
        if (currNum === prevNum + 1) {
          // 번호가 연속 → 병합
          prevCell.innerHTML = prevCell.innerHTML + '<br>' + currCell.innerHTML;
          currRow.remove();
          merged = true;
          continue;
        }
      }

      // 번호 없어도: 이전 셀과 현재 셀이 둘 다 전체 colspan이고 현재 셀이 들여쓰기로 시작
      if (currText.match(/^\s{5,}/)) {
        prevCell.innerHTML = prevCell.innerHTML + '<br>' + currCell.innerHTML;
        currRow.remove();
        merged = true;
      }
    }

    if (merged) {
      node.rawHtml = container.innerHTML;
      node.rawText = table.textContent.trim();
    }
  }
}
