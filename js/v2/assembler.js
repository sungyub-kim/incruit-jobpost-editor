/**
 * v2/assembler.js — 조립 엔진
 * Step 15 P3 프로토타입
 *
 * 핵심 불변량: 원문 텍스트를 한 글자도 변경·추가·삭제하지 않는다.
 * 오직 HTML 태그, CSS 클래스, 구조 래퍼만 추가.
 */

// 인크루트 CSS 링크 (ruleConverter.js와 동일)
const INCRUIT_CSS_LINKS = [
  'https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css?260206145500',
  'https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css?260206145500',
  'https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css?260206145500',
  'https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_media_minify.css?260206145500',
];

const DEFAULT_BRAND_COLOR = '#005ADE';

// URL 감지 정규식 (이미 <a>로 감싸진 것 제외)
const BARE_URL_RE = /(?<![="'>])(https?:\/\/[^\s<>"']+)/g;

/**
 * 노드를 섹션별로 그룹핑
 * @param {SourceNode[]} nodes
 * @param {Map<number, string>} headingMapping - nodeId → sectionId
 * @returns {SectionGroup[]}
 */
export function groupNodesBySection(nodes, headingMapping) {
  const groups = [];
  let currentGroup = null;

  for (const node of nodes) {
    if (node.type === 'heading' && headingMapping.has(node.id)) {
      // 새 섹션 시작
      currentGroup = {
        section: headingMapping.get(node.id),
        heading: node,
        nodes: []
      };
      groups.push(currentGroup);
    } else if (currentGroup) {
      // 현재 섹션에 본문 추가
      currentGroup.nodes.push(node);
    } else {
      // 첫 heading 이전 영역 — "__intro__" 그룹
      if (!groups.length || groups[0].section !== '__intro__') {
        groups.unshift({ section: '__intro__', heading: null, nodes: [] });
      }
      groups[0].nodes.push(node);
    }
  }

  return groups;
}

/**
 * 조립 엔진 메인
 * @param {SourceNode[]} nodes
 * @param {Map<number, string>} headingMapping
 * @param {object} options - { useIncruitWrapper, brandColor }
 * @returns {AssembledOutput}
 */
export function assemble(nodes, headingMapping, options = {}) {
  const groups = groupNodesBySection(nodes, headingMapping);
  const parts = [];
  let unmappedCount = 0;
  const sectionOrder = [];
  let secIndex = 1;  // sec1, sec2, sec3... 순번

  for (const group of groups) {
    sectionOrder.push(group.section);

    if (group.section === '__intro__') {
      // sec_wrap 없이 원문 순서대로 렌더링
      for (const node of group.nodes) {
        parts.push(renderNode(node));
      }
    } else {
      // 일반 섹션: sec_wrap secN + heading + 본문
      const headingText = group.heading ? group.heading.rawText : '';
      const sectionNumber = group.heading ? group.heading.sectionNumber || '' : '';
      const bodyParts = [];
      for (const node of group.nodes) {
        bodyParts.push(renderNode(node));
      }

      parts.push(renderSection(headingText, bodyParts.join('\n'), sectionNumber, secIndex));
      secIndex++;
    }
  }

  // 미배치 노드 체크
  const mappedIds = new Set();
  for (const g of groups) {
    if (g.heading) mappedIds.add(g.heading.id);
    for (const n of g.nodes) mappedIds.add(n.id);
  }
  for (const node of nodes) {
    if (!mappedIds.has(node.id)) unmappedCount++;
  }

  let contentHtml = parts.join('\n');

  // 인라인 색상 → 인크루트 클래스 변환 (rt=빨강, bt=파랑)
  contentHtml = convertInlineColorsToClasses(contentHtml);

  // URL 래핑 — 아직 <a>로 안 감싸진 URL을 <a> 래핑
  contentHtml = wrapBareUrls(contentHtml);

  // 템플릿 래핑
  let finalHtml;
  if (options.useIncruitWrapper !== false) {
    finalHtml = wrapTemplate(contentHtml, options.brandColor || DEFAULT_BRAND_COLOR);
  } else {
    finalHtml = contentHtml;
  }

  return {
    html: finalHtml,
    contentHtml,  // 래핑 전 HTML — verify 비교용 (build 293 수정)
    debug: {
      sectionOrder,
      nodeCount: nodes.length,
      unmappedCount,
      textMatchConfidence: 100 // 기대값 — verify에서 실제 확인
    }
  };
}

/**
 * 노드별 렌더링 (rawHtml 기반 — 텍스트 변경 없음)
 */
function renderNode(node) {
  switch (node.type) {
    case 'heading':
      // 하위 heading — rawHtml 그대로 사용
      return node.rawHtml;

    case 'table':
      return renderTable(node);

    case 'ulist':
      return renderUlist(node);

    case 'olist':
      return renderOlist(node);

    case 'para':
    case 'quote':
    case 'pre':
    default:
      // rawHtml 그대로
      return node.rawHtml;
  }
}

/**
 * 테이블 렌더링 — rawHtml에 인크루트 클래스만 부여
 * 핵심: textContent 변경 없음 assertion
 */
function renderTable(node) {
  const container = document.createElement('div');
  container.innerHTML = node.rawHtml;
  const table = container.querySelector('table');

  if (!table) return node.rawHtml;

  // 변경 전 textContent 스냅샷
  const textBefore = table.textContent;

  // 인크루트 테이블 클래스: 일반 테이블은 table_type bTable_1만
  table.className = 'table_type bTable_1';
  table.setAttribute('width', '100%');
  table.setAttribute('border', '1');
  table.removeAttribute('style');  // inline style 제거

  // 중첩 테이블(td 안)에만 stable fs15 추가
  const nestedTables = table.querySelectorAll('td table, th table');
  for (const nested of nestedTables) {
    nested.className = 'table_type bTable_1 stable fs15';
    nested.setAttribute('width', '100%');
    nested.setAttribute('border', '1');
    nested.removeAttribute('style');
  }

  // 변경 후 textContent 확인 — assertion
  const textAfter = table.textContent;
  if (textBefore !== textAfter) {
    console.warn('[v2/assembler] 테이블 클래스 추가 시 textContent 변경 감지! 원문 유지.');
    return node.rawHtml;
  }

  return container.innerHTML;
}

/**
 * UL 렌더링 — 인크루트 클래스 부여
 */
function renderUlist(node) {
  const container = document.createElement('div');
  container.innerHTML = node.rawHtml;
  const ul = container.querySelector('ul');

  if (!ul) return node.rawHtml;

  const textBefore = ul.textContent;

  // 마커 패턴에 따른 클래스 결정
  const marker = node.meta?.listMarkerPattern;
  let cls = 'ulist dash'; // 기본
  if (marker === 'note') cls = 'ulist noti';
  else if (marker === 'circle_bullet') cls = 'ulist cir';
  else if (marker === 'arrow') cls = 'ulist check';

  ul.className = cls;

  const textAfter = ul.textContent;
  if (textBefore !== textAfter) {
    console.warn('[v2/assembler] UL 클래스 추가 시 textContent 변경 감지! 원문 유지.');
    return node.rawHtml;
  }

  return container.innerHTML;
}

/**
 * OL 렌더링 — 인크루트 클래스 부여
 */
function renderOlist(node) {
  const container = document.createElement('div');
  container.innerHTML = node.rawHtml;
  const ol = container.querySelector('ol');

  if (!ol) return node.rawHtml;

  const textBefore = ol.textContent;

  // 한국어 번호 패턴 감지
  const marker = node.meta?.listMarkerPattern;
  let cls = 'olist';
  if (marker === 'korean_alpha') cls = 'kolist';

  ol.className = cls;

  const textAfter = ol.textContent;
  if (textBefore !== textAfter) {
    console.warn('[v2/assembler] OL 클래스 추가 시 textContent 변경 감지! 원문 유지.');
    return node.rawHtml;
  }

  return container.innerHTML;
}

/**
 * 섹션 래퍼 생성
 */
function renderSection(headingText, bodyHtml, _sectionNumber = '', secIndex = 1) {
  // 모든 섹션에 동일한 구조 — refreshTitleStyleInPreview()가 아이콘/스타일 적용
  // sec_title_icon이 있어야 아이콘 숫자/BG 스타일 변경 가능
  return `<div class="sec_wrap sec${secIndex}">
  <div class="sec_title_wrap title_bg">
    <span class="sec_title_icon"><span class="bul_1"></span></span>
    <div class="sec_title">
      <h3>${escapeHtml(headingText)}</h3>
    </div>
  </div>
  <div class="sec_box">
${bodyHtml}
  </div>
</div>
<div class="h40"></div>`;
}

/**
 * 인라인 color 스타일 → 인크루트 클래스 변환 (regex 기반, DOM 재직렬화 없음)
 * 빨강 → <span class="rt">, 파랑 → <span class="bt">, 기타 → 스타일 제거
 */
function convertInlineColorsToClasses(html) {
  return html.replace(/<span\s+style="color:(#[0-9a-fA-F]{3,6})">/g, (match, color) => {
    const c = color.toLowerCase();
    // 빨강 계열
    if (/^#(f00|ff0000|c00|cc0000|e00|ee0000|d00|dd0000|b00|bb0000|a00|aa0000)$/.test(c)) {
      return '<span class="rt">';
    }
    // 파랑 계열
    if (/^#(00f|0000ff|0611f2|0066cc|0055ff|0044cc|003399|0000cc)$/.test(c)) {
      return '<span class="bt">';
    }
    // 기타 색상 → inline style 유지
    return match;
  });
}

/**
 * 아직 <a>로 안 감싸진 URL을 <a> 래핑
 * 텍스트 자체는 변경하지 않음 — 태그만 추가
 */
function wrapBareUrls(html) {
  // HTML 태그 내부의 URL은 건드리지 않기 위해, 텍스트 노드만 대상
  // 간이 구현: 이미 href=" 또는 src=" 뒤에 있는 URL은 제외
  return html.replace(
    /(?<!=["'])(https?:\/\/[^\s<>"']+)/g,
    (match, url, offset, str) => {
      // 바로 앞이 href=", src=", url( 같은 속성이면 건너뜀
      const before = str.substring(Math.max(0, offset - 6), offset);
      if (/(?:href|src|url)\s*=\s*["']?$/.test(before)) return match;
      if (/["']$/.test(before)) return match;
      return `<a href="${url}" target="_blank" class="noko">${url}</a>`;
    }
  );
}

/**
 * 인크루트 v3 템플릿 래핑 (간이 버전)
 */
function wrapTemplate(bodyHtml, brandColor) {
  const cssLinks = INCRUIT_CSS_LINKS
    .map(url => `<link rel="stylesheet" href="${url}">`)
    .join('\n');

  return `<div id="templwrap_v3">
  <div class="templ_content">
    <div class="h30"></div>
${bodyHtml}
  </div>
  <div style="display:none"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>
  <div class="h20"></div>
</div>
<input style="margin: 0px; padding: 0px; border: 0px currentColor; width: 0px; height: 0px; font-size: 0px;" id="isIncruit" value="Y" type="hidden">
${cssLinks}
<style>
  #templwrap_v3 .title_bg .sec_title_icon span { background: ${brandColor}; }
  #templwrap_v3 .bTable_1 th { background: ${brandColor}; }
</style>`;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
