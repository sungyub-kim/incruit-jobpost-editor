/**
 * v2/meta.js — SourceNode 메타 추출
 * Step 15 P3 프로토타입
 *
 * 순수 함수. AI 미호출. rawHtml에서 시각적 속성, 링크, 테이블 구조 등을 추출.
 */

// URL 감지 정규식
const URL_RE = /https?:\/\/[^\s<>"']+/g;

// PUA 영역 감지 (U+E000~U+F8FF, U+FFFD)
const PUA_RE = /[\uE000-\uF8FF\uFFFD]/g;

/**
 * 메타 추출
 * @param {string} rawHtml - 노드의 outerHTML
 * @param {string} rawText - 노드의 textContent (trim 완료)
 * @param {string} type - 노드 타입 (heading, para, table, ulist, olist, ...)
 * @returns {SourceNodeMeta}
 */
export function extractMeta(rawHtml, rawText, type) {
  const meta = {};

  // DOM 파싱
  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  // 1. colors[] — 인라인 color/background-color 추출
  const colors = extractColors(container);
  if (colors.length > 0) meta.colors = colors;

  // 2. urls[] — URL 감지 + <a href> 태그 감지
  const urls = extractUrls(container, rawText);
  if (urls.length > 0) meta.urls = urls;

  // 3. tableStructure — 표 노드 전용
  if (type === 'table') {
    const tableEl = container.querySelector('table');
    if (tableEl) {
      meta.tableStructure = extractTableStructure(tableEl);
    }
  }

  // 4. listMarkerPattern — 리스트 마커 감지
  const marker = detectListMarker(rawText);
  if (marker) meta.listMarkerPattern = marker;

  // 5. starCount — 별표 들여쓰기
  const stars = detectStarCount(rawText);
  if (stars > 0) meta.starCount = stars;

  // 6. noteSymbol — ※ 포함 여부
  if (rawText.includes('※')) meta.noteSymbol = true;

  // 7. middleDots — 가운뎃점 개수
  const dots = (rawText.match(/·/g) || []).length;
  if (dots > 0) meta.middleDots = dots;

  // 8. nOfMPattern — 법률 조항 패턴
  const nOfM = detectNOfMPattern(rawText);
  if (nOfM.length > 0) meta.nOfMPattern = nOfM;

  // 9. brokenChars — PUA 감지
  const broken = detectBrokenChars(rawText);
  if (broken.length > 0) meta.brokenChars = broken;

  return meta;
}

/**
 * 인라인 color / background-color 추출
 */
function extractColors(container) {
  const colors = [];
  const elements = container.querySelectorAll('[style]');
  for (const el of elements) {
    const style = el.style;
    const color = style.color;
    const bgColor = style.backgroundColor;
    if (color || bgColor) {
      const entry = { text: el.textContent.trim() };
      if (color) entry.color = color;
      if (bgColor) entry.backgroundColor = bgColor;
      if (entry.text) colors.push(entry);
    }
  }
  return colors;
}

/**
 * URL 감지 + <a href> 태그 감지
 */
function extractUrls(container, rawText) {
  const urls = [];
  const seen = new Set();

  // 기존 <a href> 태그
  const anchors = container.querySelectorAll('a[href]');
  for (const a of anchors) {
    const href = a.getAttribute('href');
    if (href && !seen.has(href)) {
      seen.add(href);
      urls.push({
        text: a.textContent.trim() || href,
        url: href,
        hrefExists: true
      });
    }
  }

  // 텍스트 내 URL 감지 (아직 <a>로 안 감싸진 것)
  const matches = rawText.match(URL_RE) || [];
  for (const url of matches) {
    if (!seen.has(url)) {
      seen.add(url);
      urls.push({
        text: url,
        url: url,
        hrefExists: false
      });
    }
  }

  return urls;
}

/**
 * 테이블 구조 추출
 */
function extractTableStructure(tableEl) {
  const rows = tableEl.querySelectorAll('tr');
  let maxCols = 0;
  let hasRowspan = false;
  let hasColspan = false;
  const arrowCells = [];

  rows.forEach((tr, rowIdx) => {
    const cells = tr.querySelectorAll('td, th');
    let colCount = 0;
    cells.forEach((cell, colIdx) => {
      const rs = parseInt(cell.getAttribute('rowspan') || '1');
      const cs = parseInt(cell.getAttribute('colspan') || '1');
      if (rs > 1) hasRowspan = true;
      if (cs > 1) hasColspan = true;
      colCount += cs;

      // 화살표 셀 감지
      const text = cell.textContent.trim();
      if (text === '→' || text === '▶' || text === '▷' || text === '➔' || text === '⇒') {
        arrowCells.push({ row: rowIdx, col: colIdx });
      }
    });
    if (colCount > maxCols) maxCols = colCount;
  });

  // 중첩 테이블 감지 (td 안의 table)
  const hasNestedTable = tableEl.querySelector('td table, th table') !== null;

  const structure = {
    rows: rows.length,
    cols: maxCols,
    hasRowspan,
    hasColspan,
    hasNestedTable
  };

  if (arrowCells.length > 0) structure.arrowCells = arrowCells;

  return structure;
}

/**
 * 리스트 마커 패턴 감지
 */
function detectListMarker(text) {
  if (!text) return null;
  const firstLine = text.split('\n')[0].trim();

  // 번호 패턴: 1., 가., ①, ○, ※, *, **, ***
  const patterns = [
    [/^\d+\.\s/, 'numbered'],
    [/^[가-힣]\.\s/, 'korean_alpha'],
    [/^[①②③④⑤⑥⑦⑧⑨⑩]/, 'circled_number'],
    [/^[○●◎]/, 'circle_bullet'],
    [/^※/, 'note'],
    [/^\*{3}\s/, '***'],
    [/^\*{2}\s/, '**'],
    [/^\*\s/, '*'],
    [/^[-–—]\s/, 'dash'],
    [/^[▶►▸▷]\s*/, 'arrow'],
  ];

  for (const [re, marker] of patterns) {
    if (re.test(firstLine)) return marker;
  }
  return null;
}

/**
 * 별표 들여쓰기 감지
 */
function detectStarCount(text) {
  if (!text) return 0;
  const match = text.match(/^(\*+)\s/);
  return match ? match[1].length : 0;
}

/**
 * N의M 패턴 감지
 */
function detectNOfMPattern(text) {
  const results = [];
  const re = /(\d+)의(\d+)\./g;
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push({
      raw: m[0],
      article: parseInt(m[1]),
      subNumber: parseInt(m[2])
    });
  }

  const re2 = /제(\d+)조의(\d+)/g;
  while ((m = re2.exec(text)) !== null) {
    results.push({
      raw: m[0],
      article: parseInt(m[1]),
      subNumber: parseInt(m[2])
    });
  }

  return results;
}

/**
 * PUA 문자 감지
 */
function detectBrokenChars(text) {
  const results = [];
  let m;
  const re = new RegExp(PUA_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    results.push({
      char: m[0],
      position: m.index
    });
  }
  return results;
}
