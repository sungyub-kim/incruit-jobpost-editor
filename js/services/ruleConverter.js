/**
 * Rule-based HTML Converter for Incruit Jobpost Editor
 * AI 없이 규칙 기반으로 채용공고 HTML을 인크루트 템플릿으로 즉시 변환
 *
 * 핵심 전략: HTML 문자열 기반 분할 (DOM top-level 순회 X)
 * - heading 태그를 HTML 전체에서 정규식으로 찾아 split point로 사용
 * - 모든 콘텐츠를 보존하면서 섹션 경계만 감지
 *
 * 인크루트 HTML 템플릿 규칙 (gemini-gem-prompt v2 기준):
 * - 섹션: sec_wrap > sec_title_wrap(title_bg title_num) > sec_title > h3 + sec_box
 * - 테이블: div.table_x > table.table_type.bTable_1 (thead/colgroup 금지)
 * - 리스트: 30종+ 불릿 기호별 CSS 클래스 매핑 (기호 제거, CSS 대체)
 * - 링크: target="_blank" class="noko"
 * - 전체 래퍼: #templwrap_v3 > .templ_content + 필수 CSS 4종 + hidden input + style
 */

// ============================================
// 섹션 키워드 사전 (12개 HR-JSON 매핑)
// ============================================
const SECTION_DEFS = [
  {
    id: 'company_info', hrProp: 'description', incruitField: 'company_info',
    keywords: ['기업소개', '회사소개', '회사개요', '기업개요', '기관소개', '법인소개', '조합소개', '기관 소개', '회사 소개', '기업 소개']
  },
  {
    id: 'recruit_title', hrProp: 'title', incruitField: 'recruit_title',
    keywords: ['모집부문', '모집직종', '채용분야', '모집분야', '채용직무', '모집개요', '채용개요', '모집인원', '모집 부문', '채용 분야', '모집 인원']
  },
  {
    id: 'job_description', hrProp: 'responsibilities', incruitField: 'job_description',
    keywords: ['담당업무', '주요업무', '직무내용', '업무내용', '수행업무', '직무소개', '업무소개', '하는 일', '담당 업무', '주요 업무', '직무 내용', '업무 내용', '직무기술서']
  },
  {
    id: 'qualification', hrProp: 'qualifications', incruitField: 'qualification',
    keywords: ['자격요건', '지원자격', '필수자격', '필수요건', '자격조건', '응시자격', '지원요건', '자격 요건', '지원 자격', '필수 자격', '필수 요건']
  },
  {
    id: 'preferred', hrProp: 'preferredQualifications', incruitField: 'preferred',
    keywords: ['우대사항', '우대조건', '가점사항', '우대요건', '선호사항', '우대 사항', '우대 조건', '가점 사항']
  },
  {
    id: 'work_condition', hrProp: 'jobLocation + employmentType', incruitField: 'work_condition',
    keywords: ['근무조건', '근무환경', '근무형태', '근무장소', '근무지', '근무시간', '근무처', '근무 조건', '근무 환경', '근무 형태', '근무 장소', '고용형태', '고용 형태', '채용조건', '채용 조건']
  },
  {
    id: 'salary', hrProp: 'baseSalary', incruitField: 'salary',
    keywords: ['급여', '연봉', '보수', '임금', '급여조건', '처우', '보상', '연봉수준', '급여 조건', '처우조건', '처우 조건', '보수조건']
  },
  {
    id: 'benefits', hrProp: 'jobBenefits', incruitField: 'benefits',
    keywords: ['복리후생', '복지혜택', '복지제도', '사내복지', '복리 후생', '복지 혜택', '복지 제도', '사내 복지', '지원제도', '사내문화']
  },
  {
    id: 'hiring_process', hrProp: 'applicationProcess', incruitField: 'hiring_process',
    keywords: ['전형절차', '채용절차', '선발절차', '전형과정', '심사절차', '채용과정', '채용프로세스', '전형방법', '전형 절차', '채용 절차', '선발 절차', '채용 과정', '채용 프로세스', '전형일정']
  },
  {
    id: 'deadline', hrProp: 'validThrough', incruitField: 'deadline',
    keywords: ['접수기간', '마감일', '모집기간', '지원기간', '접수마감', '서류접수', '원서접수', '지원마감', '접수 기간', '모집 기간', '지원 기간', '접수 마감', '채용기간', '공고기간']
  },
  {
    id: 'apply_method', hrProp: 'applicationContact', incruitField: 'apply_method',
    keywords: ['접수방법', '지원방법', '지원서접수', '지원서 접수', '제출서류', '접수처', '서류제출', '지원서 제출', '접수 방법', '지원 방법', '제출 서류', '서류 제출', '지원서류']
  },
  {
    id: 'etc_info', hrProp: 'additionalInfo', incruitField: 'etc_info',
    keywords: ['기타안내', '참고사항', '유의사항', '기타사항', '주의사항', '비고', '안내사항', '기타 안내', '참고 사항', '유의 사항', '기타 사항', '주의 사항', '문의처', '기타문의']
  }
];

// 헤더 앞뒤 기호 제거용 정규식
const STRIP_PREFIX_RE = /^[\s○●■□▶▷★☆※•◆◇▪◎▣☐☑▲△►▻·\-\u2022\u2023\u2043\[\]【】<>《》「」『』]+/;
const STRIP_SUFFIX_RE = /[\s:：>\]】》」』]+$/;
const STRIP_NUM_PREFIX_RE = /^\d{1,2}[.)]\s*/;

// plain text 헤더 패턴
const PLAIN_HEADER_PATTERNS = [
  /^[■●○▶▷★◆◇▪◎▣☐☑※]\s*(.+)$/,
  /^\[(.+)\]$/,
  /^<(.+)>$/,
  /^【(.+)】$/,
  /^「(.+)」$/,
  /^《(.+)》$/,
  /^(?:\d{1,2}[.)]\s*)(.+)$/,
  /^(?:[IVX]{1,4}[.)]\s*)(.+)$/,
  /^(?:[가-힣][.)]\s*)(.+)$/,
  /^(?:#{1,3})\s*(.+)$/,
  /^(.+)\s*[:：]\s*$/,
];

// ============================================
// 인크루트 템플릿 상수 (gemini-gem-prompt v2 기준)
// ============================================
const INCRUIT_CSS_LINKS = [
  'https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css?260206145500',
  'https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css?260206145500',
  'https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css?260206145500',
  'https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_media_minify.css?260206145500',
];
const DEFAULT_BRAND_COLOR = '#005ADE';

// 비순서 리스트 불릿 → CSS 클래스 매핑 (v2 기준 30종+)
// 기호 제거 후 CSS 클래스가 시각적 기호를 대체
const UL_BULLET_PATTERNS = [
  { re: /^○\s*/, cls: 'ulist cir' },
  { re: /^●\s*/, cls: 'ulist bcir' },
  { re: /^◦\s*/, cls: 'ulist scir' },
  { re: /^◉\s*/, cls: 'ulist ecir' },
  { re: /^◎\s*/, cls: 'ulist dbcir' },
  { re: /^❍\s*/, cls: 'ulist wcc' },
  { re: /^[–—]\s*/, cls: 'ulist dash' },
  { re: /^-\s+/, cls: 'ulist dash' },
  { re: /^·\s*/, cls: 'ulist' },
  { re: /^[•\u2022]\s*/, cls: 'ulist bull' },
  { re: /^\*\s+/, cls: 'ulist star' },
  { re: /^▸\s*/, cls: 'ulist stri' },
  { re: /^▶\s*/, cls: 'ulist stri' },
  { re: /^▷\s*/, cls: 'ulist stri' },
  { re: /^►\s*/, cls: 'ulist stri' },
  { re: /^▻\s*/, cls: 'ulist stri' },
  { re: /^▲\s*/, cls: 'ulist stri' },
  { re: /^△\s*/, cls: 'ulist stri' },
  { re: /^[✓✔]\s*/, cls: 'ulist check' },
  { re: /^☑\s*/, cls: 'ulist check' },
  { re: /^☞\s*/, cls: 'ulist finger' },
  { re: /^※\s*/, cls: 'ulist noti' },
  { re: /^□\s*/, cls: 'ulist sq' },
  { re: /^☐\s*/, cls: 'ulist sq' },
  { re: /^■\s*/, cls: 'ulist bsq' },
  { re: /^▪\s*/, cls: 'ulist ssq' },
  { re: /^❏\s*/, cls: 'ulist wsq' },
  { re: /^▣\s*/, cls: 'ulist dbsq' },
  { re: /^◇\s*/, cls: 'ulist dia' },
  { re: /^◆\s*/, cls: 'ulist bkdia' },
  { re: /^◈\s*/, cls: 'ulist dbdia' },
  { re: /^★\s*/, cls: 'ulist star' },
  { re: /^☆\s*/, cls: 'ulist star' },
];

// 순서 리스트 패턴 → CSS 클래스 매핑
const OL_BULLET_PATTERNS = [
  { re: /^[가나다라마바사아자차카타파하]\.\s*/, cls: 'olist kolist' },
  { re: /^\([가나다라마바사아자차카타파하]\)\s*/, cls: 'olist kofbrac' },
  { re: /^[가나다라마바사아자차카타파하]\)\s*/, cls: 'olist kohbrac' },
  { re: /^[㉠-㉻]\s*/, cls: 'olist kocir' },
  { re: /^[㈀-㈍]\s*/, cls: 'olist kobrac' },
  { re: /^[\u320E-\u3211]\s*/, cls: 'olist kofbrac' },
  { re: /^[\u326E-\u3271]\s*/, cls: 'olist kofcir' },
  { re: /^[ⓐ-ⓩ]\s*/, cls: 'olist encir' },
  { re: /^[⒜-⒵]\s*/, cls: 'olist enbrac' },
  { re: /^[①-⑳]\s*/, cls: 'olist olcir' },
  { re: /^[⑴-⒇]\s*/, cls: 'olist olbracket' },
  { re: /^\d{1,3}\.\s+/, cls: 'olist olnum' },
  { re: /^\d{1,3}\)\s*/, cls: 'olist olhbrac' },
];

// 모든 불릿/리스트 마커 감지 정규식 (리스트 그룹 판별용)
const LIST_ITEM_RE = /^(?:[○●◦◉◎❍■□▪❏▣◇◆◈▶▷▸►▻★☆※•☐☑✓✔☞▲△·\u2022]\s*|[-–—]\s+|\*\s+|[㉠-㉻]|[㈀-㈍]|[\u320E-\u3211]|[\u326E-\u3271]|[ⓐ-ⓩ]|[⒜-⒵]|[①-⑳]|[⑴-⒇]|\d{1,3}[.)]\s|[가-힣][.)]\s|\([가-힣]\)\s*)/;

// ============================================
// 메인 변환 함수
// ============================================

/**
 * @param {string} sourceHtml - 원문 HTML 또는 텍스트
 * @param {object} options - { sanitizeForAI, applyHasMarkerClass, brandColor, wrapTemplate }
 * @returns {{ html: string, sections: object[], confidence: number, inputType: string }}
 */
export function convertByRules(sourceHtml, options = {}) {
  const { sanitizeForAI, applyHasMarkerClass, brandColor, wrapTemplate = true } = options;

  if (!sourceHtml || sourceHtml.trim() === '' || sourceHtml === '<br>') {
    return { html: '', sections: [], confidence: 0, inputType: 'empty' };
  }

  // Phase 1: 입력 형식 감지
  const inputType = detectInputType(sourceHtml);

  // Phase 2: already_incruit → pass-through
  if (inputType === 'already_incruit') {
    return { html: sourceHtml, sections: [], confidence: 100, inputType };
  }

  // Phase 3: HTML 정제 (sanitizeForAI가 제공된 경우)
  const cleanHtml = sanitizeForAI ? sanitizeForAI(sourceHtml) : sourceHtml;

  // Phase 4: 섹션 분할 (plain_text / structured_html 분기)
  let segments, titleHtml = null;
  if (inputType === 'plain_text') {
    segments = segmentPlainText(cleanHtml);
  } else {
    const result = segmentByHtmlString(cleanHtml);
    titleHtml = result.titleHtml;
    segments = result.segments;
  }

  // Phase 5: 섹션별 HTML 조립 (sec_wrap 구조)
  const sectionParts = [];
  let secIndex = 0;
  for (const seg of segments) {
    const isSection = seg.sectionDef || seg.headerText;
    sectionParts.push(wrapSection(seg, isSection ? secIndex++ : -1));
  }

  let bodyHtml = '';
  if (titleHtml) bodyHtml += titleHtml + '\n';
  bodyHtml += sectionParts.join('\n');

  // Phase 6: 마커 처리
  if (applyHasMarkerClass) bodyHtml = applyHasMarkerClass(bodyHtml);

  // Phase 7: 인크루트 전체 템플릿 래핑
  const html = wrapTemplate
    ? wrapFullTemplate(bodyHtml, { brandColor: brandColor || DEFAULT_BRAND_COLOR })
    : bodyHtml;

  // Phase 8: 신뢰도 계산
  const confidence = calculateConfidence(segments, titleHtml ? { html: titleHtml } : null);

  return { html, sections: segments, confidence, inputType };
}

// ============================================
// 입력 형식 감지
// ============================================
function detectInputType(html) {
  if (/data-hr-property|data-incruit-field|tempNew-wrap/.test(html)) {
    return 'already_incruit';
  }
  // HTML 태그가 있으면 structured (heading/table/list 모두 포함)
  if (/<(?:h[1-6]|table|ul|ol|tr|td|th|div|p|strong|b)\b/i.test(html)) {
    return 'structured_html';
  }
  return 'plain_text';
}

// ============================================
// 키워드 매칭
// ============================================
function matchSectionKeyword(rawText) {
  if (!rawText) return null;
  const text = rawText.trim();
  if (text.length < 1 || text.length > 60) return null;

  // 기호 제거 후 핵심 텍스트 추출
  let cleaned = text
    .replace(STRIP_PREFIX_RE, '')
    .replace(STRIP_SUFFIX_RE, '')
    .replace(STRIP_NUM_PREFIX_RE, '')
    .trim();

  if (!cleaned) cleaned = text;

  // 너무 짧은 건(1자) 오탐 방지 — "기타" 같은 2자 이상만
  if (cleaned.length < 2) return null;

  for (const def of SECTION_DEFS) {
    for (const kw of def.keywords) {
      // 정확 일치: 항상 매칭
      if (cleaned === kw) return def;
      // 부분 일치: 키워드가 텍스트 앞부분에 위치 + 뒤 수식어 짧을 때만
      // ✓ "모집부문 (정규직)", "우대조건 및 가점사항", "모집분야 및 기간"
      // ✗ "담당업무 관련 경력 3년 이상 필수", "구분 | 모집분야 | 기간"
      // ✗ "복리후생: 4대 보험 가입" (sub-item with value → 콘텐츠)
      if (cleaned.includes(kw)) {
        const kwPos = cleaned.indexOf(kw);
        const afterKw = cleaned.length - kwPos - kw.length;
        // "복리후생: 4대 보험" 같은 sub-item 패턴 차단 (키워드 뒤 ':' + 값)
        const tail = cleaned.substring(kwPos + kw.length);
        if (/^\s*[:：]/.test(tail) && afterKw > 2) continue;
        if (kwPos <= 2 && afterKw <= 8) return def;
      }
    }
  }
  return null;
}

// ============================================
// HTML 문자열 기반 섹션 분할 (핵심 엔진)
// ============================================
function segmentByHtmlString(html) {
  // ── Step 1: 모든 heading 태그 위치 찾기 (중첩 깊이 무관) ──
  // h1~h6 매칭 (멀티라인 대응)
  const HEADING_RE = /<(h[1-6])(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/gi;
  const markers = [];
  let match;

  while ((match = HEADING_RE.exec(html)) !== null) {
    const fullMatch = match[0];
    const innerHtml = fullMatch.replace(/^<h[1-6][^>]*>/i, '').replace(/<\/h[1-6]\s*>$/i, '');
    const text = stripHtmlTags(innerHtml).trim();
    if (!text || text.length > 60) continue;

    const sectionDef = matchSectionKeyword(text);
    if (sectionDef) {
      markers.push({
        sectionDef,
        headerText: text,
        index: match.index,
        endIndex: match.index + fullMatch.length,
        tag: match[1]
      });
    }
  }

  // ── Step 2: <strong>/<b> 가 블록 헤더 역할을 하는 경우도 감지 ──
  // 패턴: <p><strong>담당업무</strong></p> 또는 단독 <strong>자격요건</strong><br>
  const STRONG_BLOCK_RE = /(?:<(?:p|div)[^>]*>\s*)?<(strong|b)[^>]*>([^<]{2,50})<\/\1>(?:\s*<\/(?:p|div)>)?/gi;
  while ((match = STRONG_BLOCK_RE.exec(html)) !== null) {
    const text = match[2].trim();
    const sectionDef = matchSectionKeyword(text);
    if (!sectionDef) continue;
    // 이미 heading 안에 있는 strong은 제외 (중복 방지)
    const alreadyInHeading = markers.some(m => match.index >= m.index && match.index < m.endIndex);
    if (alreadyInHeading) continue;
    // 이미 같은 위치에 마커가 있으면 제외
    const duplicate = markers.some(m => Math.abs(m.index - match.index) < 10);
    if (duplicate) continue;

    markers.push({
      sectionDef,
      headerText: text,
      index: match.index,
      endIndex: match.index + match[0].length,
      tag: 'strong'
    });
  }

  // ── Step 3: 테이블 내 섹션 헤더 감지 ──
  // <td> 또는 <th> 중 짧은 텍스트가 섹션 키워드인 경우
  const TD_HEADER_RE = /<(td|th)[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  while ((match = TD_HEADER_RE.exec(html)) !== null) {
    const cellHtml = match[2];
    const cellText = stripHtmlTags(cellHtml).trim();
    if (!cellText || cellText.length > 40) continue;
    const sectionDef = matchSectionKeyword(cellText);
    if (!sectionDef) continue;
    // 이미 근처에 마커가 있으면 제외
    const nearby = markers.some(m => Math.abs(m.index - match.index) < 20);
    if (nearby) continue;

    // 이 td를 포함하는 <tr> 전체를 분할점으로 사용
    // tr 시작 위치 찾기
    const trStart = html.lastIndexOf('<tr', match.index);
    const trEnd = html.indexOf('</tr>', match.index);
    if (trStart >= 0 && trEnd >= 0) {
      const trHtml = html.substring(trStart, trEnd + 5);
      // 이 tr 안에서 이 td가 아닌 나머지 셀의 내용을 content로 수집
      const otherCells = [];
      const CELL_RE = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)\s*>/gi;
      let cellMatch;
      while ((cellMatch = CELL_RE.exec(trHtml)) !== null) {
        const ct = stripHtmlTags(cellMatch[1]).trim();
        if (ct && ct !== cellText) {
          otherCells.push(cellMatch[1]);
        }
      }

      markers.push({
        sectionDef,
        headerText: cellText,
        index: trStart,
        endIndex: trEnd + 5,
        tag: 'td',
        inlineContent: otherCells.join('<br>')
      });
    }
  }

  // ── Step 4: 마커를 위치순 정렬 ──
  markers.sort((a, b) => a.index - b.index);

  // 중복 제거 (같은 섹션이 너무 가까이 있으면 첫 번째만)
  const dedupedMarkers = [];
  for (const m of markers) {
    const last = dedupedMarkers[dedupedMarkers.length - 1];
    if (last && last.sectionDef.id === m.sectionDef.id && m.index - last.endIndex < 50) continue;
    dedupedMarkers.push(m);
  }

  // ── Step 5: h1 타이틀 추출 ──
  let titleHtml = null;
  const H1_RE = /<h1[^>]*>([\s\S]*?)<\/h1\s*>/i;
  const h1Match = html.match(H1_RE);
  if (h1Match) {
    const h1Text = stripHtmlTags(h1Match[1]).trim();
    // h1이 섹션 키워드가 아니면 타이틀로 사용
    if (h1Text && !matchSectionKeyword(h1Text)) {
      titleHtml = `<h1>${h1Match[1]}</h1>`;
    }
  }

  // ── Step 6: 마커가 없으면 전체 HTML을 그대로 반환 ──
  if (dedupedMarkers.length === 0) {
    // 타이틀 h1 제거 후 나머지 전체를 하나의 섹션으로
    let bodyHtml = html;
    if (h1Match) {
      bodyHtml = html.replace(H1_RE, '').trim();
    }
    if (bodyHtml) {
      return {
        titleHtml,
        segments: [{
          sectionDef: null,
          headerText: '채용공고',
          contentHtml: bodyHtml
        }]
      };
    }
    return { titleHtml, segments: [] };
  }

  // ── Step 7: HTML을 마커 위치로 분할 ──
  const segments = [];

  // td 마커가 하나라도 있으면 고아 테이블 태그 정리 필요
  const hasTdMarkers = dedupedMarkers.some(m => m.tag === 'td');

  // 첫 마커 이전 콘텐츠 (preamble)
  const preContent = html.substring(0, dedupedMarkers[0].index).trim();
  if (preContent) {
    // h1 타이틀 제거
    let cleanPre = h1Match ? preContent.replace(H1_RE, '').trim() : preContent;
    // td 마커 사용 시 고아 테이블 태그 정리
    if (hasTdMarkers) cleanPre = cleanOrphanedTableTags(cleanPre);
    if (cleanPre && stripHtmlTags(cleanPre).trim()) {
      segments.push({
        sectionDef: null,
        headerText: null,
        contentHtml: cleanPre
      });
    }
  }

  // 각 섹션
  for (let i = 0; i < dedupedMarkers.length; i++) {
    const marker = dedupedMarkers[i];
    const nextIndex = (i + 1 < dedupedMarkers.length) ? dedupedMarkers[i + 1].index : html.length;
    let content = html.substring(marker.endIndex, nextIndex).trim();

    // td 마커의 경우: 인라인 콘텐츠 사용 + 고아 테이블 태그 정리
    if (marker.inlineContent) {
      // 마커 사이 콘텐츠에서 고아 테이블 행 → 텍스트 추출
      if (content) content = cleanOrphanedTableTags(content);
      content = marker.inlineContent + (content ? '<br>' + content : '');
    } else if (hasTdMarkers && content) {
      // heading 마커지만 테이블 잔여물 가능
      content = cleanOrphanedTableTags(content);
    }

    segments.push({
      sectionDef: marker.sectionDef,
      headerText: marker.headerText,
      contentHtml: content
    });
  }

  return { titleHtml, segments };
}

// ============================================
// plain_text 섹션 분할
// ============================================
function segmentPlainText(html) {
  const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  const lines = text.split('\n');
  const segments = [];
  let currentSection = null;
  let contentLines = [];
  let preambleLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection) contentLines.push('');
      else preambleLines.push('');
      continue;
    }

    const headerMatch = matchPlainTextHeader(trimmed);
    if (headerMatch) {
      if (currentSection) {
        currentSection.contentHtml = linesToHtml(contentLines);
        segments.push(currentSection);
        contentLines = [];
      } else if (preambleLines.some(l => l.trim())) {
        // preamble 저장
        segments.push({
          sectionDef: null,
          headerText: null,
          contentHtml: linesToHtml(preambleLines)
        });
      }
      preambleLines = [];
      currentSection = {
        sectionDef: headerMatch.sectionDef,
        headerText: trimmed,
        contentHtml: ''
      };
      continue;
    }

    if (currentSection) {
      contentLines.push(trimmed);
    } else {
      preambleLines.push(trimmed);
    }
  }

  // 마지막 섹션
  if (currentSection) {
    currentSection.contentHtml = linesToHtml(contentLines);
    segments.push(currentSection);
  }

  // preamble만 있고 섹션이 없는 경우
  if (segments.length === 0 && preambleLines.some(l => l.trim())) {
    segments.push({
      sectionDef: null,
      headerText: null,
      contentHtml: linesToHtml(preambleLines)
    });
  }

  return segments;
}

function matchPlainTextHeader(line) {
  if (line.length > 50) return null;

  for (const pattern of PLAIN_HEADER_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const inner = match[1] || line;
      const sectionDef = matchSectionKeyword(inner);
      if (sectionDef) return { sectionDef, headerText: line };
    }
  }

  const direct = matchSectionKeyword(line);
  if (direct) return { sectionDef: direct, headerText: line };

  return null;
}

function linesToHtml(lines) {
  const parts = [];
  let currentGroup = [];

  for (const line of lines) {
    if (line === '' || line.trim() === '') {
      if (currentGroup.length > 0) {
        parts.push(currentGroup);
        currentGroup = [];
      }
    } else {
      currentGroup.push(line);
    }
  }
  if (currentGroup.length > 0) parts.push(currentGroup);

  return parts.map(group => {
    const allList = group.every(l => LIST_ITEM_RE.test(l));
    if (allList && group.length > 0) {
      // 첫 줄에서 불릿 타입 감지
      const firstBullet = detectLineBullet(group[0]);
      if (firstBullet) {
        const tag = firstBullet.cls.startsWith('olist') ? 'ol' : 'ul';
        const items = group.map(l => {
          const bullet = detectLineBullet(l);
          // 불릿 기호 제거 (CSS 클래스가 대체)
          const cleaned = bullet ? l.replace(bullet.re, '').trim() : l;
          return `<li>${escapeHtml(cleaned)}</li>`;
        });
        return `<${tag} class="${firstBullet.cls}">\n${items.join('\n')}\n</${tag}>`;
      }
      // 불릿 타입 미감지 시 기본 ulist
      return '<ul class="ulist">\n' + group.map(l => `<li>${escapeHtml(l)}</li>`).join('\n') + '\n</ul>';
    }
    return group.map(l => `<p>${escapeHtml(l)}</p>`).join('\n');
  }).join('\n');
}

// ============================================
// 섹션 HTML 래핑 (인크루트 sec_wrap 구조)
// ============================================
function wrapSection(segment, secIndex) {
  const { sectionDef, headerText, contentHtml } = segment;

  // 헤더 없는 preamble: 내용만 출력 (sec_wrap 없음)
  if (!headerText && !sectionDef) {
    return contentHtml || '';
  }

  const secNum = (secIndex >= 0 ? secIndex : 0) + 1;
  const content = transformContent(contentHtml || '');
  const dataAttrs = sectionDef
    ? ` data-hr-property="${sectionDef.hrProp}" data-incruit-field="${sectionDef.incruitField}"`
    : '';

  return `<div class="sec_wrap sec${secNum}"${dataAttrs}>
  <div class="sec_title_wrap title_bg title_num">
    <span class="sec_title_icon"><span class="num1"></span></span>
    <div class="sec_title">
      <h3>${headerText}</h3>
    </div>
  </div>
  <div class="sec_box">
${content}
  </div>
</div>
<div class="h40"></div>`;
}

// ============================================
// 신뢰도 계산
// ============================================
function calculateConfidence(segments, titleResult) {
  let score = 0;
  const matchedIds = new Set(segments.filter(s => s.sectionDef).map(s => s.sectionDef.id));
  const matchedCount = matchedIds.size;

  // 감지 섹션 비율 (최대 60점)
  score += Math.min(60, (matchedCount / 12) * 100);

  // 핵심 섹션 보너스 (최대 30점)
  const keySections = ['job_description', 'qualification', 'work_condition'];
  const keyFound = keySections.filter(id => matchedIds.has(id)).length;
  score += (keyFound / keySections.length) * 30;

  // 타이틀 보너스 (10점)
  if (titleResult && titleResult.html) score += 10;

  return Math.min(100, Math.round(score));
}

// ============================================
// 유틸리티
// ============================================
function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 고아 테이블 태그 정리
 * - <table>, </table> 태그 제거
 * - 고아 <tr>...<td>...</td>...</tr> → 셀 내용을 <br>로 연결
 * - 브라우저가 <div> 안의 <tr>/<td>를 버리는 문제 해결
 */
function cleanOrphanedTableTags(html) {
  if (!html) return html;
  // <table> / </table> 단독 태그 제거
  let cleaned = html.replace(/<\/?table[^>]*>/gi, '');
  // 고아 <tr>...<td>...</td>...</tr> → 셀 내용 추출
  cleaned = cleaned.replace(/<tr[^>]*>([\s\S]*?)<\/tr\s*>/gi, (_, rowContent) => {
    const cells = [];
    const cellRe = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)\s*>/gi;
    let m;
    while ((m = cellRe.exec(rowContent)) !== null) {
      const text = m[1].trim();
      if (text) cells.push(text);
    }
    return cells.length > 0 ? cells.join(' / ') : '';
  });
  // 남은 고아 <td>, </td>, <th>, </th>, <tr>, </tr> 제거
  cleaned = cleaned.replace(/<\/?(?:td|th|tr|thead|tbody|tfoot)[^>]*>/gi, '');
  return cleaned.trim();
}

// ============================================
// 불릿 타입 감지
// ============================================
function detectLineBullet(text) {
  if (!text) return null;
  for (const pat of UL_BULLET_PATTERNS) {
    if (pat.re.test(text)) return { type: 'ul', cls: pat.cls, re: pat.re };
  }
  for (const pat of OL_BULLET_PATTERNS) {
    if (pat.re.test(text)) return { type: 'ol', cls: pat.cls, re: pat.re };
  }
  return null;
}

// ============================================
// 콘텐츠 변환 (테이블, 링크, 리스트에 인크루트 클래스 적용)
// ============================================
function transformContent(html) {
  if (!html) return '';
  let result = html;
  result = transformTables(result);
  result = transformLinks(result);
  result = transformExistingLists(result);
  return result;
}

/**
 * 테이블 변환: div.table_x 래핑 + table_type bTable_1 클래스
 * - <thead>, <colgroup>, <tfoot> 제거
 * - <tbody> 보장
 */
function transformTables(html) {
  if (!/<table/i.test(html)) return html;
  let result = html;

  // <thead>, <colgroup>, <tfoot> 태그 제거 (내부 콘텐츠는 보존)
  result = result.replace(/<\/?thead[^>]*>/gi, '');
  result = result.replace(/<colgroup[^>]*>[\s\S]*?<\/colgroup\s*>/gi, '');
  result = result.replace(/<\/?tfoot[^>]*>/gi, '');

  // <tbody> 없으면 추가
  if (/<table[^>]*>/i.test(result) && !/<tbody/i.test(result)) {
    result = result.replace(/(<table[^>]*>)\s*/gi, '$1<tbody>');
    result = result.replace(/\s*(<\/table>)/gi, '</tbody>$1');
  }

  // <table> 속성 교체: width, border, class 설정
  result = result.replace(/<table[^>]*>/gi, (match) => {
    let tag = match
      .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+border\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+class\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+cellspacing\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+cellpadding\s*=\s*["'][^"']*["']/gi, '');
    return tag.replace(/<table/i, '<table width="100%" border="1" class="table_type bTable_1"');
  });

  // <div class="table_x"> 래핑
  result = result.replace(/<table /gi, '<div class="table_x"><table ');
  result = result.replace(/<\/table>/gi, '</table></div>');

  return result;
}

/**
 * 링크 변환: target="_blank" class="noko" 추가
 */
function transformLinks(html) {
  if (!/<a\s/i.test(html)) return html;
  return html.replace(/<a\s([^>]*)>/gi, (match, attrs) => {
    let newAttrs = attrs;
    if (!/target\s*=/i.test(newAttrs)) {
      newAttrs += ' target="_blank"';
    }
    if (/class\s*=\s*["']/i.test(newAttrs)) {
      if (!/\bnoko\b/.test(newAttrs)) {
        newAttrs = newAttrs.replace(/class\s*=\s*["']([^"']*)["']/i, 'class="$1 noko"');
      }
    } else {
      newAttrs += ' class="noko"';
    }
    return `<a ${newAttrs.trim()}>`;
  });
}

/**
 * 기존 <ul>/<ol>에 인크루트 불릿 CSS 클래스 적용
 * - <li> 내용에서 불릿 기호 감지 → 해당 CSS 클래스 부여
 * - 불릿 기호를 텍스트에서 제거 (CSS가 대체)
 */
function transformExistingLists(html) {
  if (!/<(?:ul|ol)\b/i.test(html)) return html;
  let result = html;

  // <ul> 변환
  result = result.replace(/<ul([^>]*)>([\s\S]*?)<\/ul>/gi, (match, attrs, inner) => {
    if (/class\s*=\s*["'][^"']*\b(?:ulist|olist)\b/.test(attrs)) return match;
    const liMatch = inner.match(/<li[^>]*>([\s\S]*?)<\/li>/i);
    if (!liMatch) return match;
    const firstText = stripHtmlTags(liMatch[1]).trim();
    const bullet = detectLineBullet(firstText);
    if (!bullet) return `<ul class="ulist"${attrs}>${inner}</ul>`;
    const cleanedInner = stripBulletsFromLis(inner, bullet.re);
    return `<ul class="${bullet.cls}">${cleanedInner}</ul>`;
  });

  // <ol> 변환
  result = result.replace(/<ol([^>]*)>([\s\S]*?)<\/ol>/gi, (match, attrs, inner) => {
    if (/class\s*=\s*["'][^"']*\b(?:ulist|olist)\b/.test(attrs)) return match;
    const liMatch = inner.match(/<li[^>]*>([\s\S]*?)<\/li>/i);
    if (!liMatch) return match;
    const firstText = stripHtmlTags(liMatch[1]).trim();
    const bullet = detectLineBullet(firstText);
    if (!bullet) return match;
    const tag = bullet.cls.startsWith('olist') ? 'ol' : 'ul';
    const cleanedInner = stripBulletsFromLis(inner, bullet.re);
    return `<${tag} class="${bullet.cls}">${cleanedInner}</${tag}>`;
  });

  return result;
}

/**
 * <li> 내부에서 불릿 기호 제거 (CSS 클래스가 기호를 대체하므로)
 */
function stripBulletsFromLis(inner, bulletRe) {
  return inner.replace(/<li([^>]*)>([\s\S]*?)<\/li>/gi, (_, liAttrs, content) => {
    let cleaned = content.trimStart();
    const match = cleaned.match(bulletRe);
    if (match) {
      cleaned = cleaned.substring(match[0].length);
    }
    return `<li${liAttrs}>${cleaned}</li>`;
  });
}

// ============================================
// 인크루트 전체 템플릿 래핑
// ============================================
/**
 * bodyHtml을 인크루트 전체 템플릿으로 래핑
 * - #templwrap_v3 > .templ_content
 * - 필수 CSS 4종 + hidden input + 커스텀 style
 * - v2 기준: title_num 스타일, copyright hidden img
 */
function wrapFullTemplate(bodyHtml, options = {}) {
  const color = options.brandColor || DEFAULT_BRAND_COLOR;
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
  #templwrap_v3 .title_bg .sec_title_icon span { background: ${color}; }
  #templwrap_v3 .bTable_1 th { background: ${color}; }
</style>`;
}
