/**
 * URL Extractor Service
 * 채용공고 URL에서 콘텐츠를 추출하는 서비스
 *
 * 지원 플랫폼:
 * - 인크루트 (job.incruit.com, m.incruit.com)
 * - 한국 ATS (Greeting, Remember, Rocketpunch, Jumpit, Wanted)
 * - 글로벌 ATS (Greenhouse, Lever, Workday)
 * - 기타 채용 페이지 (범용 추출)
 */

// ============================================
// CORS 프록시 설정
// ============================================
const PROXY_BASE = '/proxy?url=';

async function fetchViaProxy(url) {
  const proxyUrl = PROXY_BASE + encodeURIComponent(url);
  const resp = await fetch(proxyUrl, { headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' } });
  if (!resp.ok) {
    throw new Error(`프록시 요청 실패 (${resp.status}): ${url}`);
  }

  // EUC-KR 대응: Content-Type 헤더 또는 바이트 패턴으로 인코딩 감지
  const contentType = resp.headers.get('Content-Type') || '';
  const charsetMatch = contentType.match(/charset=([\w\-]+)/i);
  const declaredCharset = charsetMatch ? charsetMatch[1].toLowerCase().replace('_', '-') : '';

  // 프록시가 이미 UTF-8로 변환한 경우 → 그대로 text()
  // 만약 변환 안 된 EUC-KR이 넘어온 경우 → TextDecoder로 디코딩
  if (['euc-kr', 'euckr', 'cp949', 'ms949', 'ks-c-5601-1987'].includes(declaredCharset)) {
    const buffer = await resp.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    return decoder.decode(buffer);
  }

  // UTF-8 또는 charset 없는 경우: 기본 text() 사용 후 깨짐 검사
  const text = await resp.text();

  // 한글 깨짐 휴리스틱: EUC-KR 페이지가 UTF-8로 잘못 디코딩되면 replacement char(�)이 다수 출현
  if (text.includes('\ufffd') && (text.match(/\ufffd/g) || []).length > 10) {
    // fallback: 다시 ArrayBuffer로 받아서 EUC-KR 디코딩 시도
    try {
      const retryResp = await fetch(proxyUrl, { headers: { 'Accept': 'text/html,*/*' } });
      const buffer = await retryResp.arrayBuffer();
      const decoder = new TextDecoder('euc-kr');
      const decoded = decoder.decode(buffer);
      // EUC-KR 디코딩 후 한글이 있으면 성공
      if (/[\uac00-\ud7a3]/.test(decoded)) {
        return decoded;
      }
    } catch { /* fallback 실패 시 원본 반환 */ }
  }

  return text;
}

async function checkProxyHealth() {
  try {
    const resp = await fetch('/health', { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch {
    return false;
  }
}

// ============================================
// 플랫폼별 파서 설정
// ============================================
const PLATFORM_PARSERS = {
  // 인크루트
  'job.incruit.com': {
    name: '인크루트',
    selectors: [
      '#content_job',
      '#divContent', '#content_area', '.job_post_detail',
      '#divJobPostDetail', '.jobcompany_info .conts .job_info_detail',
      '.detail_info_area'
    ],
    metaSelectors: {
      title: ['.job_info_title h1', '.tit_job', 'h1.tit'],
      company: ['.company_name', '.job_company_name a', '.tit_company']
    },
    cleanup: [
      '.btn_area', '.share_area', '.ad_area', '.powerlink_ad',
      '.rubaner-sider', 'script', 'style', 'noscript', 'iframe',
      '.menu_btm', '.header', 'footer', '.recommend_area'
    ],
    useJsonLd: false
  },
  'm.incruit.com': {
    name: '인크루트 모바일',
    selectors: [
      '.c-r-tab-body .contents', '.c-r-tab-body',
      '.job_post_area', '.job_detail_content',
      '#tab1'
    ],
    metaSelectors: {
      title: ['h1', '.tit_job', '.job_tit'],
      company: ['.company_name a', '.comp_name']
    },
    cleanup: [
      '.navs', '.powerlink_ad', 'script', 'style', 'noscript',
      '.btn_wrap', '.share_area', 'footer', '.app_banner'
    ],
    useJsonLd: true
  },

  // 한국 ATS
  'team.greeting.com': {
    name: 'Greeting',
    selectors: ['.job-description-content', '.job-detail', 'main article'],
    metaSelectors: { title: ['.job-title', 'h1'], company: ['.company-name'] },
    cleanup: ['.share-buttons', '.apply-button', 'nav', 'footer']
  },
  'career.rememberapp.co.kr': {
    name: 'Remember Career',
    selectors: ['article.job-detail', '.job-description', 'main'],
    metaSelectors: { title: ['h1'], company: ['.company-info'] },
    cleanup: ['nav', 'footer', '.sidebar']
  },
  'www.rocketpunch.com': {
    name: 'Rocketpunch',
    selectors: ['.job-content', '.content-holder', '#job-detail'],
    metaSelectors: { title: ['.job-title', 'h1'], company: ['.company-name'] },
    cleanup: ['.share-buttons', '.related-jobs', 'nav', 'footer']
  },
  'www.jumpit.co.kr': {
    name: 'Jumpit',
    selectors: ['.position-description', '.job-description', 'main article'],
    metaSelectors: { title: ['h1'], company: ['.company-name'] },
    cleanup: ['nav', 'footer', '.recommend']
  },
  'www.wanted.co.kr': {
    name: 'Wanted',
    selectors: ['.job-description', '.JobDescription_JobDescription', 'article'],
    metaSelectors: { title: ['h1', '.JobHeader_JobHeader'], company: ['.company_name'] },
    cleanup: ['nav', 'footer', '.RecommendedJobs'],
    jsonPath: '__NEXT_DATA__'
  },

  // 글로벌 ATS
  'jobs.lever.co': {
    name: 'Lever',
    selectors: ['.posting-description', '.content', 'main'],
    metaSelectors: { title: ['.posting-headline h2', 'h1'], company: ['.posting-headline .company'] },
    cleanup: ['.posting-apply', 'nav', 'footer']
  },
  'boards.greenhouse.io': {
    name: 'Greenhouse',
    selectors: ['#content', '.job-post', 'main'],
    metaSelectors: { title: ['h1.app-title'], company: ['.company-name'] },
    cleanup: ['#header', '#footer', '.submit-button']
  },

  // 잡코리아
  'www.jobkorea.co.kr': {
    name: '잡코리아',
    selectors: [
      '#content_job', '.artReadDetail', '.devReadDetail',
      '.tbRow.recruitDesc', '#dev-gi-content', 'article'
    ],
    metaSelectors: {
      title: ['h1', '.tit_job', '.job-title'],
      company: ['.company-name', '.coName a']
    },
    cleanup: [
      'script', 'style', 'noscript', 'iframe',
      '.btn_area', '.share_area', 'nav', 'footer',
      '.recomm_area', '.ad_area'
    ],
    useJsonLd: false
  },

  // 사람인
  'www.saramin.co.kr': {
    name: '사람인',
    selectors: [
      '.user_content', '.wrap_jv_cont', '.cont_detail',
      '.jv_detail', '.area_detailinfo', 'article'
    ],
    metaSelectors: {
      title: ['h1', '.job_tit', '.tit_job'],
      company: ['.company_name a', '.corp_name']
    },
    cleanup: [
      'script', 'style', 'noscript', 'iframe',
      '.btn_area', '.share_area', 'nav', 'footer',
      '.ad_area', '.recommend_area'
    ],
    useJsonLd: false
  },

  // 뉴워커 (인크루트 계열 단기알바 플랫폼)
  'www.newworker.co.kr': {
    name: '뉴워커',
    selectors: [
      '[id^="jobContent_"]',
      '.main-view-contents', '.jobview-detail',
      '.pageContents', '.contSection-menu1'
    ],
    metaSelectors: {
      title: ['h1', '.jobview-section-0 .txt', 'meta[property="og:title"]'],
      company: ['.jobview-section-5 .txt', 'meta[name="description"]']
    },
    cleanup: [
      'script', 'style', 'noscript', 'iframe',
      '.jobview-banner', '.LayerScrap', '.LayerCharacter',
      '.LayerCharacterTime', '.map-btnWrap', 'nav', 'footer'
    ],
    useJsonLd: false
  },

  // ALIO 공공기관 채용정보 시스템
  'job.alio.go.kr': {
    name: 'ALIO',
    selectors: [
      '#tab-1', '#contentRV', '#txt', '.detailTxt'
    ],
    metaSelectors: {
      title: ['.topInfo .titleH2', '.topInfo p.titleH2', 'h4'],
      company: ['.topInfo h2']
    },
    cleanup: [
      'script', 'style', 'noscript', 'iframe',
      '.benner', '.f_banner', '.tabsContent', 'nav', 'footer',
      '.tab-link', '.skip'
    ],
    useJsonLd: false
  },

  // 워크넷 (Work24, 고용노동부)
  'www.work24.go.kr': {
    name: '워크넷',
    selectors: [
      '.emp_detail', '#tab-panel01', '.cont_wrap'
    ],
    metaSelectors: {
      title: ['.tit_area h2', '.tit_emp', 'h1'],
      company: ['.corp_name', '.company_name']
    },
    cleanup: [
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer', '.tab_list',
      '.gnb_wrap', '.header_type', '.skipnav',
      '#skipnav', '.get_top', '.btn_toggle_more'
    ],
    useJsonLd: false
  },
};

// ============================================
// 동적 파서 레지스트리 (AI 자동 분석 결과 저장)
// ============================================

/**
 * 런타임 동적 파서 저장소
 * AI가 분석한 페이지 구조를 기반으로 자동 등록됨
 * key: hostname, value: { name, selectors[], metaSelectors, cleanup[], useJsonLd, strategy, iframeSelector, iframeUrlBuilder, nextDataPath }
 */
const dynamicParsers = new Map();

/**
 * 동적 파서 등록
 * @param {string} hostname - 예: 'jasoseol.com'
 * @param {object} config - PLATFORM_PARSERS와 동일한 형태의 파서 설정
 */
export function registerDynamicParser(hostname, config) {
  dynamicParsers.set(hostname, {
    ...config,
    registeredAt: Date.now(),
    source: 'ai-analysis'
  });
  console.log(`[urlExtractor] 동적 파서 등록: ${hostname}`, config);

  // localStorage에도 캐시 (세션 간 유지)
  try {
    const cache = JSON.parse(localStorage.getItem('dynamicParsers') || '{}');
    cache[hostname] = { ...config, registeredAt: Date.now() };
    localStorage.setItem('dynamicParsers', JSON.stringify(cache));
  } catch { /* ignore */ }
}

/**
 * 동적 파서 조회
 * @param {string} hostname
 * @returns {object|null}
 */
export function getDynamicParser(hostname) {
  // 메모리에서 먼저 확인
  if (dynamicParsers.has(hostname)) return dynamicParsers.get(hostname);

  // localStorage에서 복원
  try {
    const cache = JSON.parse(localStorage.getItem('dynamicParsers') || '{}');
    if (cache[hostname]) {
      dynamicParsers.set(hostname, cache[hostname]);
      return cache[hostname];
    }
    // 부분 매칭 (서브도메인)
    for (const [domain, config] of Object.entries(cache)) {
      if (hostname.endsWith(domain) || hostname.includes(domain.replace('www.', ''))) {
        dynamicParsers.set(hostname, config);
        return config;
      }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * 등록된 동적 파서 목록 반환
 */
export function getDynamicParserList() {
  // localStorage + 메모리 병합
  try {
    const cache = JSON.parse(localStorage.getItem('dynamicParsers') || '{}');
    for (const [host, config] of Object.entries(cache)) {
      if (!dynamicParsers.has(host)) dynamicParsers.set(host, config);
    }
  } catch { /* ignore */ }
  return Object.fromEntries(dynamicParsers);
}

// ============================================
// AI 페이지 구조 분석 (클라이언트 사이드)
// ============================================

/**
 * 페이지 HTML을 분석하여 콘텐츠 추출에 유용한 구조 정보를 반환
 * AI 프롬프트 구성에 사용됨
 * @param {string} url - 분석 대상 URL
 * @param {function} onStep - 단계별 콜백 (step, message) => void
 * @returns {Promise<object>} 분석 결과
 */
export async function analyzePageStructure(url, onStep = () => {}) {
  const analysis = {
    url,
    hostname: '',
    hasIframe: false,
    iframes: [],
    hasNextData: false,
    nextDataKeys: [],
    hasJsonLd: false,
    jsonLdType: null,
    largeContainers: [],
    metaTags: {},
    pageTitle: '',
    totalTextLength: 0,
    candidateSelectors: [],
    rawHtmlLength: 0
  };

  try {
    // Step 1: HTML 가져오기
    onStep('fetch', '페이지 HTML 가져오는 중...');
    const rawHtml = await fetchViaProxy(url);
    analysis.rawHtmlLength = rawHtml.length;
    analysis.hostname = new URL(url).hostname;

    // Step 2: DOM 파싱
    onStep('parse', 'DOM 구조 분석 중...');
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    analysis.pageTitle = doc.title || '';

    // Step 3: iframe 탐색
    onStep('iframe', 'iframe 요소 탐색 중...');
    const iframes = doc.querySelectorAll('iframe[src], iframe[data-src]');
    for (const iframe of iframes) {
      const src = iframe.getAttribute('src') || iframe.getAttribute('data-src') || '';
      const id = iframe.id || '';
      const name = iframe.name || '';
      if (src && !src.startsWith('about:') && !src.includes('google') && !src.includes('facebook') && !src.includes('ads')) {
        analysis.hasIframe = true;
        analysis.iframes.push({
          id,
          name,
          src: src.startsWith('http') ? src : new URL(src, url).href,
          className: iframe.className || ''
        });
      }
    }

    // Step 4: __NEXT_DATA__ 탐색
    onStep('nextdata', '__NEXT_DATA__ (Next.js) 탐색 중...');
    const nextDataScript = doc.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      analysis.hasNextData = true;
      try {
        const nd = JSON.parse(nextDataScript.textContent);
        // 주요 키 구조 추출 (깊이 3까지)
        analysis.nextDataKeys = extractKeyPaths(nd, 3);
        // pageProps의 키도 따로 기록
        if (nd?.props?.pageProps) {
          analysis.nextDataPagePropsKeys = Object.keys(nd.props.pageProps);
        }
      } catch { /* parse error */ }
    }

    // Step 5: JSON-LD 탐색
    onStep('jsonld', 'JSON-LD 구조화 데이터 탐색 중...');
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        const type = data['@type'] || (data['@graph'] ? 'Graph' : 'unknown');
        analysis.hasJsonLd = true;
        analysis.jsonLdType = type;
        if (type === 'JobPosting') {
          analysis.jsonLdFields = Object.keys(data);
        }
      } catch { /* skip */ }
    }

    // Step 6: 큰 컨테이너 요소 탐색
    onStep('containers', '주요 콘텐츠 컨테이너 탐색 중...');
    const allElements = doc.querySelectorAll('div, article, section, main, .content, [class*="detail"], [class*="content"], [class*="job"], [class*="recruit"], [id*="content"], [id*="detail"], [id*="job"]');

    const containers = [];
    for (const el of allElements) {
      // 스크립트/스타일 제외한 텍스트 길이 측정
      const clone = el.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(s => s.remove());
      const textLen = clone.textContent.trim().length;
      const htmlLen = clone.innerHTML.trim().length;

      if (textLen > 500) {
        const selector = buildSelector(el);
        containers.push({ selector, textLen, htmlLen, tag: el.tagName.toLowerCase() });
      }
    }

    // 텍스트 길이 기준 정렬, 상위 10개
    containers.sort((a, b) => b.textLen - a.textLen);
    analysis.largeContainers = containers.slice(0, 10);

    // Step 7: 후보 셀렉터 추출
    onStep('selectors', '최적 셀렉터 후보 추출 중...');
    analysis.candidateSelectors = analysis.largeContainers
      .filter(c => c.textLen > 1000)
      .map(c => c.selector);

    // Step 8: 메타 태그 수집
    onStep('meta', '메타 태그 수집 중...');
    const metaTags = {};
    doc.querySelectorAll('meta[property], meta[name]').forEach(m => {
      const key = m.getAttribute('property') || m.getAttribute('name');
      const val = m.getAttribute('content') || '';
      if (key && val && ['og:title', 'og:description', 'og:site_name', 'description', 'title'].includes(key)) {
        metaTags[key] = val.substring(0, 200);
      }
    });
    analysis.metaTags = metaTags;

    // 전체 텍스트 길이
    analysis.totalTextLength = doc.body ? doc.body.textContent.trim().length : 0;

    onStep('done', '페이지 구조 분석 완료');

  } catch (e) {
    onStep('error', `분석 실패: ${e.message}`);
    analysis.error = e.message;
  }

  return analysis;
}

/**
 * 객체의 키 경로를 depth까지 추출
 */
function extractKeyPaths(obj, maxDepth, prefix = '', depth = 0) {
  if (depth >= maxDepth || !obj || typeof obj !== 'object') return [];
  const paths = [];
  const keys = Array.isArray(obj) ? ['[0]'] : Object.keys(obj);
  for (const key of keys.slice(0, 20)) { // 최대 20개 키만
    const fullPath = prefix ? `${prefix}.${key}` : key;
    paths.push(fullPath);
    const val = Array.isArray(obj) ? obj[0] : obj[key];
    if (val && typeof val === 'object') {
      paths.push(...extractKeyPaths(val, maxDepth, fullPath, depth + 1));
    }
  }
  return paths;
}

/**
 * DOM 요소에서 고유 CSS 셀렉터 생성
 */
function buildSelector(el) {
  if (el.id) return `#${el.id}`;
  let selector = el.tagName.toLowerCase();
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).filter(c => c.length < 40).slice(0, 3);
    if (classes.length > 0) selector += '.' + classes.join('.');
  }
  return selector;
}

// ============================================
// 인크루트 iframe(jobpostcont.asp) 추출
// ============================================

/**
 * 인크루트 채용공고 URL인지 판별
 * jobpost.asp 또는 jobpostcont.asp 모두 지원
 */
function isIncruitJobpost(url) {
  try {
    const u = new URL(url);
    return (u.hostname === 'job.incruit.com' || u.hostname === 'm.incruit.com') &&
           (u.pathname.includes('jobpost.asp') || u.pathname.includes('jobpostcont.asp'));
  } catch { return false; }
}

/**
 * 인크루트 jobpostcont.asp URL 생성
 * jobpost.asp?job=XXX → jobpostcont.asp?job=XXX
 * jobpostcont.asp?job=XXX → 그대로 사용
 */
function buildIncruitContUrl(url) {
  const u = new URL(url);
  const jobParam = u.searchParams.get('job');
  if (!jobParam) return null;
  // jobpostcont.asp URL이면 그대로 사용
  if (u.pathname.includes('jobpostcont.asp')) return url;
  // jobpost.asp → jobpostcont.asp 변환
  return `https://job.incruit.com/s_common/jobpost/jobpostcont.asp?job=${jobParam}`;
}

/**
 * 인크루트 jobpostcont.asp에서 본문(#content_job) 추출
 */
async function fetchIncruitJobpostCont(url) {
  const contUrl = buildIncruitContUrl(url);
  if (!contUrl) throw new Error('인크루트 job 파라미터 없음');

  const rawHtml = await fetchViaProxy(contUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // #content_job 셀렉터로 본문 추출
  const contentEl = doc.querySelector('#content_job');
  if (!contentEl) throw new Error('인크루트 #content_job 셀렉터 미발견');

  // 불필요 요소 제거 (쿠키 배너 포함)
  contentEl.querySelectorAll('script, style, noscript, iframe, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]').forEach(el => el.remove());

  return {
    html: contentEl.innerHTML.trim(),
    text: contentEl.textContent.trim()
  };
}

// ============================================
// 잡코리아 iframe(GI_Read_Comt_Ifrm) 추출
// ============================================

/**
 * 잡코리아 채용공고 URL인지 판별
 */
function isJobkoreaJobpost(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'www.jobkorea.co.kr' &&
           u.pathname.includes('/Recruit/GI_Read/');
  } catch { return false; }
}

/**
 * 잡코리아 iframe URL 구성
 * /Recruit/GI_Read/48524476?sc=729&sn=103
 * → /Recruit/GI_Read_Comt_Ifrm?sc=729&sn=103&Gno=48524476
 */
function buildJobkoreaIframeUrl(url) {
  const u = new URL(url);
  // pathname에서 공고번호 추출: /Recruit/GI_Read/48524476
  const pathMatch = u.pathname.match(/\/Recruit\/GI_Read\/(\d+)/);
  if (!pathMatch) return null;
  const gno = pathMatch[1];
  const sc = u.searchParams.get('sc') || '';
  const sn = u.searchParams.get('sn') || '';
  return `https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?sc=${sc}&sn=${sn}&Gno=${gno}`;
}

/**
 * 잡코리아 iframe에서 상세 채용공고 본문 추출
 */
async function fetchJobkoreaIframeCont(url) {
  const iframeUrl = buildJobkoreaIframeUrl(url);
  if (!iframeUrl) throw new Error('잡코리아 공고번호 파싱 실패');

  const rawHtml = await fetchViaProxy(iframeUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // body 전체를 콘텐츠로 사용 (iframe 페이지는 본문만 있음)
  const body = doc.body;
  if (!body) throw new Error('잡코리아 iframe body 없음');

  // 불필요 요소 제거 (쿠키 배너 포함)
  body.querySelectorAll('script, style, noscript, iframe, .ad_area, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]').forEach(el => el.remove());

  const html = body.innerHTML.trim();
  if (html.length < 100) throw new Error('잡코리아 iframe 콘텐츠 너무 짧음');

  return {
    html: html,
    text: body.textContent.trim()
  };
}

// ============================================
// 사람인 iframe(view-detail) 추출
// ============================================

/**
 * 사람인 채용공고 URL인지 판별
 */
function isSaraminJobpost(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'www.saramin.co.kr' &&
           u.pathname.includes('/jobs/relay/view');
  } catch { return false; }
}

/**
 * 사람인 iframe URL 구성
 * /zf_user/jobs/relay/view?rec_idx=XXX → /zf_user/jobs/relay/view-detail?rec_idx=XXX&rec_seq=0
 */
function buildSaraminIframeUrl(url) {
  const u = new URL(url);
  // 이미 view-detail이면 그대로
  if (u.pathname.includes('view-detail')) return url;
  const recIdx = u.searchParams.get('rec_idx');
  if (!recIdx) return null;
  // seq 파라미터 추출 (hash에 있을 수 있음: #seq=0)
  const hashMatch = u.hash.match(/seq=(\d+)/);
  const recSeq = hashMatch ? hashMatch[1] : '0';
  return `https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=${recIdx}&rec_seq=${recSeq}`;
}

/**
 * 사람인 iframe에서 상세 채용공고 본문(.user_content) 추출
 */
async function fetchSaraminIframeCont(url) {
  const iframeUrl = buildSaraminIframeUrl(url);
  if (!iframeUrl) throw new Error('사람인 rec_idx 파싱 실패');

  const rawHtml = await fetchViaProxy(iframeUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // .user_content 셀렉터로 본문 추출, 없으면 body 사용
  const contentEl = doc.querySelector('.user_content') || doc.body;
  if (!contentEl) throw new Error('사람인 콘텐츠 셀렉터 미발견');

  // 불필요 요소 제거 (쿠키 배너 포함)
  contentEl.querySelectorAll('script, style, noscript, iframe, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]').forEach(el => el.remove());

  const html = contentEl.innerHTML.trim();
  if (html.length < 100) throw new Error('사람인 iframe 콘텐츠 너무 짧음');

  return {
    html: html,
    text: contentEl.textContent.trim()
  };
}

// ============================================
// 원티드 __NEXT_DATA__ JSON 추출
// ============================================

/**
 * 원티드 채용공고 URL인지 판별
 */
function isWantedJobpost(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'www.wanted.co.kr' && u.pathname.startsWith('/wd/');
  } catch { return false; }
}

/**
 * 원티드 __NEXT_DATA__에서 구조화된 채용공고 데이터를 HTML로 변환
 */
function extractWantedFromNextData(doc) {
  const scriptEl = doc.getElementById('__NEXT_DATA__');
  if (!scriptEl) return null;

  try {
    const data = JSON.parse(scriptEl.textContent);
    const job = data?.props?.pageProps?.initialData;
    if (!job) return null;

    // 텍스트를 HTML 단락으로 변환 (줄바꿈 → <br>)
    const toHtml = (text) => {
      if (!text) return '';
      return text.replace(/\n/g, '<br>');
    };

    // 구조화된 HTML 생성
    const sections = [];

    if (job.position) {
      sections.push(`<h2>${job.position}</h2>`);
    }
    if (job.company?.name) {
      sections.push(`<p><strong>${job.company.name}</strong></p>`);
    }
    if (job.intro) {
      sections.push(`<h3>소개</h3><p>${toHtml(job.intro)}</p>`);
    }
    if (job.main_tasks) {
      sections.push(`<h3>주요업무</h3><p>${toHtml(job.main_tasks)}</p>`);
    }
    if (job.requirements) {
      sections.push(`<h3>자격요건</h3><p>${toHtml(job.requirements)}</p>`);
    }
    if (job.preferred_points) {
      sections.push(`<h3>우대사항</h3><p>${toHtml(job.preferred_points)}</p>`);
    }
    if (job.benefits) {
      sections.push(`<h3>혜택 및 복지</h3><p>${toHtml(job.benefits)}</p>`);
    }

    const html = sections.join('\n');
    if (html.length < 100) return null;

    return {
      html,
      text: html.replace(/<[^>]+>/g, ' ').trim(),
      metadata: {
        title: job.position || '',
        company: job.company?.name || '',
        location: job.address?.full_location || ''
      }
    };
  } catch (e) {
    console.warn('[urlExtractor] 원티드 __NEXT_DATA__ 파싱 실패:', e.message);
    return null;
  }
}

// ============================================
// ALIO 공공기관 채용정보 추출
// ============================================

/**
 * ALIO 채용공고 URL인지 판별
 */
function isAlioJobpost(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'job.alio.go.kr' && u.pathname.includes('recruitview');
  } catch { return false; }
}

/**
 * ALIO 공공기관 채용정보에서 상세 콘텐츠 추출
 * 구조: #contentRV > #txt > .topInfo (제목/기관명) + .detailTxt (요약테이블) + #tab-1 (상세요강)
 */
function extractAlioContent(doc) {
  try {
    const sections = [];

    // 1. 기관명 + 공고 제목
    const company = doc.querySelector('.topInfo h2');
    const title = doc.querySelector('.topInfo .titleH2');
    if (company) sections.push(`<h2>${company.textContent.trim()}</h2>`);
    if (title) sections.push(`<h3>${title.textContent.trim()}</h3>`);

    // 2. 요약 테이블 (.detailTxt table)
    const detailTable = doc.querySelector('.detailTxt table');
    if (detailTable) {
      sections.push(detailTable.outerHTML);
    }

    // 3. 상세요강 탭 (#tab-1)
    const tab1 = doc.getElementById('tab-1');
    if (tab1) {
      // 불필요 요소 제거
      tab1.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      sections.push(tab1.innerHTML.trim());
    }

    // 4. 전형단계별 채용정보 탭 (#tab-2) — 있으면 추가
    const tab2 = doc.getElementById('tab-2');
    if (tab2) {
      tab2.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      const tab2Html = tab2.innerHTML.trim();
      if (tab2Html.length > 100) {
        sections.push('<h4>전형단계별 채용정보</h4>');
        sections.push(tab2Html);
      }
    }

    const html = sections.join('\n');
    if (html.length < 200) return null;

    return {
      html,
      text: html.replace(/<[^>]+>/g, ' ').trim(),
      metadata: {
        title: title?.textContent.trim() || '',
        company: company?.textContent.trim() || ''
      }
    };
  } catch (e) {
    console.warn('[urlExtractor] ALIO 추출 실패:', e.message);
    return null;
  }
}

// ============================================
// 워크넷 (Work24) 채용공고 추출
// ============================================

/**
 * 워크넷 채용공고 URL인지 판별
 */
function isWorknetJobpost(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'www.work24.go.kr' &&
           (u.pathname.includes('empDetailAuthView') || u.pathname.includes('empDetailView'));
  } catch { return false; }
}

/**
 * 워크넷 채용공고에서 상세 콘텐츠 추출
 * 구조: .emp_detail (요약) + #tab-panel01~05 (상세탭)
 * 타이틀은 JS 변수 WANTED_TITLE 또는 <title> 태그에서 추출
 */
function extractWorknetContent(doc, rawHtml) {
  try {
    const sections = [];

    // 1. 제목 추출: JS 변수 WANTED_TITLE에서 추출
    let title = '';
    const titleMatch = rawHtml.match(/WANTED_TITLE\s*=\s*"([^"]+)"/);
    if (titleMatch) {
      title = titleMatch[1];
      sections.push(`<h2>${title}</h2>`);
    }

    // 2. 회사명 추출
    let company = '';
    const companyEl = doc.querySelector('.tit_area h2, .corp_name, .company_name');
    if (companyEl) {
      company = companyEl.textContent.trim();
      sections.push(`<p><strong>${company}</strong></p>`);
    }

    // 3. 지원자격/근무조건 요약 (.emp_detail)
    const empDetail = doc.querySelector('.emp_detail');
    if (empDetail) {
      empDetail.querySelectorAll('script, style, noscript, .btn_toggle_more').forEach(el => el.remove());
      sections.push(empDetail.innerHTML.trim());
    }

    // 4. 탭 패널 콘텐츠 (모집요강, 근무조건, 우대사항, 복리후생, 전형방법)
    const tabNames = ['모집요강', '근무조건', '우대사항', '복리후생', '전형방법'];
    for (let i = 1; i <= 5; i++) {
      const panel = doc.getElementById(`tab-panel0${i}`);
      if (panel) {
        panel.querySelectorAll('script, style, noscript, .btn_toggle_more').forEach(el => el.remove());
        const panelHtml = panel.innerHTML.trim();
        if (panelHtml.length > 50) {
          sections.push(`<h3>${tabNames[i-1]}</h3>`);
          sections.push(panelHtml);
        }
      }
    }

    const html = sections.join('\n');
    if (html.length < 200) return null;

    return {
      html,
      text: html.replace(/<[^>]+>/g, ' ').trim(),
      metadata: { title, company }
    };
  } catch (e) {
    console.warn('[urlExtractor] 워크넷 추출 실패:', e.message);
    return null;
  }
}

// ============================================
// recruiter.co.kr (CSR 플랫폼) 추출
// ============================================

/**
 * recruiter.co.kr 계열 URL인지 판별
 * 멀티테넌트 ATS: {company}.recruiter.co.kr
 */
function isRecruiterCoKr(url) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('.recruiter.co.kr') && u.pathname.includes('/career/jobs/');
  } catch { return false; }
}

/**
 * recruiter.co.kr API를 통해 채용공고 데이터 추출 시도
 * CSR 플랫폼이므로 API 직접 호출 필요 (prefix 헤더 + withCredentials)
 * API 인증 실패 시 meta 태그에서 최소 정보 추출
 */
async function extractRecruiterCoKr(url, doc) {
  const u = new URL(url);
  const hostname = u.hostname;
  // URL에서 position ID 추출: /career/jobs/99056
  const pathMatch = u.pathname.match(/\/career\/jobs\/(\d+)/);
  const positionId = pathMatch ? pathMatch[1] : null;

  // 1. API 호출 시도 (prefix 헤더 필요)
  if (positionId) {
    try {
      const apiUrl = `https://api-builder.recruiter.co.kr/positions/${positionId}`;
      const proxyUrl = PROXY_BASE + encodeURIComponent(apiUrl);
      const resp = await fetch(proxyUrl, {
        headers: {
          'Accept': 'application/json',
          'prefix': hostname
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data) {
          const html = buildRecruiterHtml(data);
          if (html && html.length > 200) {
            console.log(`[urlExtractor] recruiter.co.kr API 추출 성공: ${html.length}자`);
            return {
              html,
              text: html.replace(/<[^>]+>/g, ' ').trim(),
              metadata: {
                title: data.title || data.positionName || '',
                company: data.companyName || ''
              }
            };
          }
        }
      }
    } catch (e) {
      console.warn('[urlExtractor] recruiter.co.kr API 호출 실패:', e.message);
    }
  }

  // 2. API 실패 시 meta 태그에서 최소 정보 추출
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  const metaAuthor = doc.querySelector('meta[name="author"]')?.getAttribute('content') || '';
  const pageTitle = doc.querySelector('title')?.textContent || '';

  // 회사명: meta author 또는 title에서 추출
  const company = metaAuthor || pageTitle.split('채용')[0].trim() || '';

  if (ogTitle || ogDesc) {
    const sections = [];
    if (company) sections.push(`<h2>${company}</h2>`);
    if (ogTitle) sections.push(`<h3>${ogTitle}</h3>`);
    if (ogDesc) sections.push(`<p>${ogDesc}</p>`);
    sections.push(`<p><em>⚠️ 이 사이트는 클라이언트 사이드 렌더링(CSR)을 사용하여 상세 내용을 자동 추출할 수 없습니다. 원문을 직접 복사하여 붙여넣기해주세요.</em></p>`);

    return {
      html: sections.join('\n'),
      text: sections.join('\n').replace(/<[^>]+>/g, ' ').trim(),
      metadata: { title: ogTitle, company },
      isPartial: true
    };
  }

  return null;
}

/**
 * recruiter.co.kr API 응답을 HTML로 변환
 */
function buildRecruiterHtml(data) {
  const sections = [];
  const toHtml = (text) => text ? String(text).replace(/\n/g, '<br>') : '';

  // 다양한 필드명에 대응
  if (data.positionName || data.title) {
    sections.push(`<h2>${data.positionName || data.title}</h2>`);
  }
  if (data.companyName) {
    sections.push(`<p><strong>${data.companyName}</strong></p>`);
  }

  // 공통 필드 매핑
  const fieldMap = {
    description: '직무소개', jobDescription: '직무소개',
    requirement: '자격요건', requirements: '자격요건', qualification: '자격요건',
    preferredQualification: '우대사항', preferred: '우대사항',
    benefits: '복리후생', welfare: '복리후생',
    process: '전형절차', selectionProcess: '전형절차',
    workCondition: '근무조건', workingCondition: '근무조건',
    etc: '기타사항', additionalInfo: '기타사항'
  };

  for (const [key, label] of Object.entries(fieldMap)) {
    if (data[key] && String(data[key]).trim()) {
      sections.push(`<h3>${label}</h3><p>${toHtml(data[key])}</p>`);
    }
  }

  // 구조화된 데이터가 없으면 전체 필드를 순회
  if (sections.length <= 2) {
    for (const [key, value] of Object.entries(data)) {
      if (!value || typeof value !== 'string' || value.trim().length < 20) continue;
      if (['id', 'sn', 'status', 'createdAt', 'updatedAt'].includes(key)) continue;
      sections.push(`<h3>${key}</h3><p>${toHtml(value)}</p>`);
    }
  }

  return sections.join('\n');
}

// ============================================
// 동적 파서 유틸리티 함수
// ============================================

/**
 * 동적 파서의 iframe URL 패턴으로 실제 URL 생성
 * 패턴 예: "https://example.com/detail?id={param:id}" → URL 파라미터 id를 대입
 * 패턴 예: "https://example.com/detail/{path:1}" → URL 경로 1번째 세그먼트 대입
 */
function buildDynamicIframeUrl(originalUrl, pattern) {
  try {
    const u = new URL(originalUrl);
    let result = pattern;
    // {param:xxx} → URL 쿼리 파라미터 대입
    result = result.replace(/\{param:(\w+)\}/g, (_, key) => u.searchParams.get(key) || '');
    // {path:n} → URL 경로 세그먼트 대입
    const pathParts = u.pathname.split('/').filter(Boolean);
    result = result.replace(/\{path:(\d+)\}/g, (_, idx) => pathParts[parseInt(idx)] || '');
    // {hostname} → 호스트명 대입
    result = result.replace(/\{hostname\}/g, u.hostname);
    return result || null;
  } catch {
    return null;
  }
}

/**
 * 중첩 객체에서 점 표기법 경로로 값 접근
 * 예: getNestedValue(obj, "props.pageProps.data") → obj.props.pageProps.data
 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return null;
    current = current[part];
  }
  return current;
}

/**
 * 객체를 HTML로 변환 (동적 파서의 __NEXT_DATA__ 추출 결과용)
 * @param {object} data - 추출된 데이터 객체
 * @param {object} fieldMapping - { sourceField: '표시 제목' } 매핑
 */
function buildHtmlFromObject(data, fieldMapping = {}) {
  if (typeof data === 'string') return `<p>${data.replace(/\n/g, '<br>')}</p>`;
  if (!data || typeof data !== 'object') return '';

  const sections = [];
  const toHtml = (text) => text ? String(text).replace(/\n/g, '<br>') : '';

  for (const [key, value] of Object.entries(data)) {
    if (!value || (typeof value === 'string' && value.trim().length === 0)) continue;
    const label = fieldMapping[key] || key;
    if (typeof value === 'string') {
      sections.push(`<h3>${label}</h3><p>${toHtml(value)}</p>`);
    } else if (Array.isArray(value)) {
      const items = value.map(v => typeof v === 'string' ? v : JSON.stringify(v));
      sections.push(`<h3>${label}</h3><ul>${items.map(i => `<li>${toHtml(i)}</li>`).join('')}</ul>`);
    } else if (typeof value === 'object') {
      sections.push(`<h3>${label}</h3><p>${toHtml(JSON.stringify(value, null, 2))}</p>`);
    }
  }

  return sections.join('\n');
}

// ============================================
// 메인 추출 API
// ============================================

/**
 * 단일 URL에서 채용공고 추출
 * @param {string} url
 * @param {object} options - { useProxy: true, timeout: 15000 }
 * @returns {Promise<{ html, text, metadata, confidence, warnings }>}
 */
export async function extractFromUrl(url, options = {}) {
  const { useProxy = true, timeout = 15000 } = options;
  const warnings = [];

  // 1. 프록시 상태 확인
  if (useProxy) {
    const proxyOk = await checkProxyHealth();
    if (!proxyOk) {
      throw new Error(
        'CORS 프록시 서버가 실행되지 않았습니다.\n' +
        '터미널에서 다음 명령을 실행하세요:\n' +
        'python3 cors-proxy.py'
      );
    }
  }

  // 2. URL 정규화
  url = normalizeUrl(url);

  // 3. HTML 가져오기
  let rawHtml;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    rawHtml = await fetchViaProxy(url);
    clearTimeout(timer);
  } catch (e) {
    throw new Error(`URL 페치 실패: ${e.message}`);
  }

  // 4. DOM 파싱
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // 5. 메타데이터 추출
  const metadata = extractMetadata(doc, url);

  // 6. 플랫폼별 파서 선택
  const urlType = detectUrlType(url);
  const platform = getPlatformParser(url);

  let contentHtml = '';
  let confidence = 0;

  // ★ 인크루트 전용: iframe(jobpostcont.asp) 콘텐츠 추출
  if (isIncruitJobpost(url)) {
    try {
      const contResult = await fetchIncruitJobpostCont(url);
      if (contResult.html && contResult.html.length > 500) {
        contentHtml = contResult.html;
        confidence = 95;
        console.log(`[urlExtractor] 인크루트 jobpostcont 추출 성공: ${contResult.html.length}자`);
      }
    } catch (e) {
      console.warn('[urlExtractor] 인크루트 jobpostcont 추출 실패, fallback:', e.message);
    }
  }

  // ★ 잡코리아 전용: iframe(GI_Read_Comt_Ifrm) 콘텐츠 추출
  if (isJobkoreaJobpost(url)) {
    try {
      const contResult = await fetchJobkoreaIframeCont(url);
      if (contResult.html && contResult.html.length > 500) {
        contentHtml = contResult.html;
        confidence = 95;
        console.log(`[urlExtractor] 잡코리아 iframe 추출 성공: ${contResult.html.length}자`);
      }
    } catch (e) {
      console.warn('[urlExtractor] 잡코리아 iframe 추출 실패, fallback:', e.message);
    }
  }

  // ★ 사람인 전용: iframe(view-detail) 콘텐츠 추출
  if (isSaraminJobpost(url)) {
    try {
      const contResult = await fetchSaraminIframeCont(url);
      if (contResult.html && contResult.html.length > 500) {
        contentHtml = contResult.html;
        confidence = 95;
        console.log(`[urlExtractor] 사람인 iframe 추출 성공: ${contResult.html.length}자`);
      }
    } catch (e) {
      console.warn('[urlExtractor] 사람인 iframe 추출 실패, fallback:', e.message);
    }
  }

  // ★ 원티드 전용: __NEXT_DATA__ JSON에서 구조화된 콘텐츠 추출
  if (isWantedJobpost(url)) {
    const wantedResult = extractWantedFromNextData(doc);
    if (wantedResult && wantedResult.html.length > 200) {
      contentHtml = wantedResult.html;
      confidence = 95;
      if (wantedResult.metadata.title) metadata.title = wantedResult.metadata.title;
      if (wantedResult.metadata.company) metadata.company = wantedResult.metadata.company;
      if (wantedResult.metadata.location) metadata.location = wantedResult.metadata.location;
      console.log(`[urlExtractor] 원티드 __NEXT_DATA__ 추출 성공: ${wantedResult.html.length}자`);
    }
  }

  // ★ ALIO 전용: 공공기관 채용정보 시스템 (#tab-1 + .detailTxt)
  if (isAlioJobpost(url)) {
    const alioResult = extractAlioContent(doc);
    if (alioResult && alioResult.html.length > 200) {
      contentHtml = alioResult.html;
      confidence = 95;
      if (alioResult.metadata.title) metadata.title = alioResult.metadata.title;
      if (alioResult.metadata.company) metadata.company = alioResult.metadata.company;
      console.log(`[urlExtractor] ALIO 추출 성공: ${alioResult.html.length}자`);
    }
  }

  // ★ 워크넷 전용: .emp_detail + #tab-panel01~05 추출
  if (isWorknetJobpost(url)) {
    const worknetResult = extractWorknetContent(doc, rawHtml);
    if (worknetResult && worknetResult.html.length > 200) {
      contentHtml = worknetResult.html;
      confidence = 95;
      if (worknetResult.metadata.title) metadata.title = worknetResult.metadata.title;
      if (worknetResult.metadata.company) metadata.company = worknetResult.metadata.company;
      console.log(`[urlExtractor] 워크넷 추출 성공: ${worknetResult.html.length}자`);
    }
  }

  // ★ recruiter.co.kr 전용: CSR 플랫폼, API 호출 시도 → meta 태그 fallback
  if (isRecruiterCoKr(url) && confidence < 70) {
    const recruiterResult = await extractRecruiterCoKr(url, doc);
    if (recruiterResult) {
      contentHtml = recruiterResult.html;
      confidence = recruiterResult.isPartial ? 35 : 90;
      if (recruiterResult.metadata.title) metadata.title = recruiterResult.metadata.title;
      if (recruiterResult.metadata.company) metadata.company = recruiterResult.metadata.company;
      if (recruiterResult.isPartial) {
        warnings.push('이 사이트는 클라이언트 사이드 렌더링(CSR)을 사용하여 상세 내용을 자동 추출할 수 없습니다. 원문을 직접 복사하여 붙여넣기해주세요.');
      }
      console.log(`[urlExtractor] recruiter.co.kr 추출 ${recruiterResult.isPartial ? '(부분)' : '성공'}: ${contentHtml.length}자`);
    }
  }

  // ★ 동적 파서 전용: AI가 분석한 전략으로 추출
  if (confidence < 70) {
    const dynParser = getDynamicParser(new URL(url).hostname);
    if (dynParser && dynParser.strategy) {
      try {
        if (dynParser.strategy === 'iframe') {
          // iframe 전략: 1) 원본 페이지에서 iframe src 직접 추출 시도, 2) URL 패턴 fallback
          let iframeUrl = null;

          // 방법 1: 원본 페이지 DOM에서 실제 iframe src 추출
          const iframes = doc.querySelectorAll('iframe[src]');
          for (const iframe of iframes) {
            const src = iframe.getAttribute('src') || '';
            if (src && !src.startsWith('about:') && !src.includes('google') && !src.includes('facebook') && !src.includes('ads')) {
              iframeUrl = src.startsWith('http') ? src : new URL(src, url).href;
              console.log(`[urlExtractor] 동적 파서: 페이지 내 iframe src 발견 → ${iframeUrl}`);
              break;
            }
          }

          // 방법 2: URL 패턴으로 iframe URL 생성 (fallback)
          if (!iframeUrl && dynParser.iframeUrlPattern) {
            iframeUrl = buildDynamicIframeUrl(url, dynParser.iframeUrlPattern);
          }

          if (iframeUrl) {
            const iframeHtml = await fetchViaProxy(iframeUrl);
            const iframeDoc = parser.parseFromString(iframeHtml, 'text/html');

            // 셀렉터가 있으면 셀렉터로 추출
            if (dynParser.selectors && dynParser.selectors.length > 0) {
              for (const sel of dynParser.selectors) {
                const el = iframeDoc.querySelector(sel);
                if (el) {
                  (dynParser.cleanup || []).forEach(c => el.querySelectorAll(c).forEach(s => s.remove()));
                  if (el.innerHTML.trim().length > 500) {
                    contentHtml = el.innerHTML.trim();
                    confidence = 90;
                    console.log(`[urlExtractor] 동적 파서 iframe 셀렉터 추출 성공: ${contentHtml.length}자`);
                    break;
                  }
                }
              }
            }

            // 셀렉터로 못 찾았으면 body 전체에서 추출
            if (confidence < 70 && iframeDoc.body) {
              const body = iframeDoc.body;
              (dynParser.cleanup || ['script', 'style', 'noscript', 'iframe']).forEach(c => body.querySelectorAll(c).forEach(s => s.remove()));
              if (body.innerHTML.trim().length > 500) {
                contentHtml = body.innerHTML.trim();
                confidence = 85;
                console.log(`[urlExtractor] 동적 파서 iframe body 전체 추출 성공: ${contentHtml.length}자`);
              }
            }
          }
        } else if (dynParser.strategy === 'nextdata' && dynParser.nextDataPath) {
          // __NEXT_DATA__ 전략
          const nextDataEl = doc.getElementById('__NEXT_DATA__');
          if (nextDataEl) {
            const nd = JSON.parse(nextDataEl.textContent);
            const jobData = getNestedValue(nd, dynParser.nextDataPath);
            if (jobData) {
              contentHtml = buildHtmlFromObject(jobData, dynParser.fieldMapping || {});
              confidence = 90;
              console.log(`[urlExtractor] 동적 파서 __NEXT_DATA__ 추출 성공: ${contentHtml.length}자`);
            }
          }
        } else if (dynParser.strategy === 'selector') {
          // 셀렉터 전략 (기본)
          for (const sel of dynParser.selectors) {
            const el = doc.querySelector(sel);
            if (el) {
              (dynParser.cleanup || []).forEach(c => el.querySelectorAll(c).forEach(s => s.remove()));
              if (el.innerHTML.trim().length > 500) {
                contentHtml = el.innerHTML.trim();
                confidence = 85;
                console.log(`[urlExtractor] 동적 파서 셀렉터 추출 성공: ${contentHtml.length}자`);
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[urlExtractor] 동적 파서 추출 실패:', e.message);
      }
    }
  }

  // 전략 1: Schema.org JSON-LD (플랫폼 전용 추출 성공 시 건너뜀)
  if (confidence < 70 && (platform?.useJsonLd || !platform)) {
    const jsonLd = extractJsonLd(doc);
    if (jsonLd) {
      if (jsonLd.description) {
        contentHtml = jsonLd.description;
        confidence = 90;
        if (jsonLd.title) metadata.title = jsonLd.title;
        if (jsonLd.hiringOrganization?.name) metadata.company = jsonLd.hiringOrganization.name;
        if (jsonLd.jobLocation?.address?.addressLocality) metadata.location = jsonLd.jobLocation.address.addressLocality;
      }
    }
  }

  // 전략 2: 플랫폼 셀렉터
  if (confidence < 70 && platform) {
    const result = extractBySelectors(doc, platform);
    if (result.html && result.html.length > contentHtml.length) {
      contentHtml = result.html;
      confidence = Math.max(confidence, result.confidence);
      // 플랫폼별 메타데이터
      const platformMeta = extractPlatformMeta(doc, platform);
      Object.assign(metadata, platformMeta);
    }
  }

  // 전략 3: OpenGraph 기반
  if (confidence < 50) {
    const og = extractOpenGraph(doc);
    if (og.description && og.description.length > 100) {
      if (!contentHtml || contentHtml.length < og.description.length) {
        contentHtml = `<p>${escapeHtml(og.description)}</p>`;
        confidence = Math.max(confidence, 40);
      }
      if (og.title) metadata.title = metadata.title || og.title;
    }
  }

  // 전략 4: Readability (범용 추출)
  if (confidence < 60) {
    const readable = extractReadable(doc);
    if (readable.html && readable.html.length > contentHtml.length) {
      contentHtml = readable.html;
      confidence = Math.max(confidence, readable.confidence);
    }
  }

  // 5. HTML 정제
  contentHtml = sanitizeExtractedHtml(contentHtml);

  // 6. 신뢰도 평가
  if (contentHtml.length < 300) {
    confidence = Math.min(confidence, 30);
    warnings.push('추출된 콘텐츠가 너무 짧습니다. 원문을 직접 확인해주세요.');
  }

  if (confidence < 50) {
    warnings.push('추출 신뢰도가 낮습니다. 내용을 확인 후 사용하세요.');
  }

  metadata.source = urlType;
  metadata.url = url;

  // 7. 캐시 저장
  cachePattern(url, confidence);

  return {
    html: contentHtml,
    text: stripHtml(contentHtml),
    metadata,
    confidence,
    warnings
  };
}

/**
 * 복수 URL 배치 추출
 * @param {string[]} urls
 * @param {function} onProgress - (index, total, result) => void
 * @returns {Promise<Array<{ url, html, text, metadata, confidence, warnings, error }>>}
 */
export async function extractFromUrls(urls, onProgress = null) {
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    if (!url) continue;

    try {
      const result = await extractFromUrl(url);
      results.push({ url, ...result, error: null });
    } catch (e) {
      results.push({
        url,
        html: '',
        text: '',
        metadata: {},
        confidence: 0,
        warnings: [e.message],
        error: e.message
      });
    }

    if (onProgress) {
      onProgress(i + 1, urls.length, results[results.length - 1]);
    }
  }

  return results;
}

/**
 * URL 타입 감지
 * @param {string} url
 * @returns {string}
 */
export function detectUrlType(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;

    if (host === 'job.incruit.com') {
      if (u.pathname.includes('popupjobpost')) return 'incruit-popup';
      return 'incruit-desktop';
    }
    if (host === 'm.incruit.com') return 'incruit-mobile';
    if (host === 'www.incruit.com') return 'incruit';
    if (host === 'job.alio.go.kr') return 'alio';
    if (host === 'www.work24.go.kr') return 'worknet';
    if (host.endsWith('.recruiter.co.kr')) return 'recruiter-co-kr';

    if (PLATFORM_PARSERS[host]) return 'ats-known';

    // 부분 매칭 (서브도메인 지원)
    for (const domain of Object.keys(PLATFORM_PARSERS)) {
      if (host.endsWith(domain) || host.includes(domain.replace('www.', ''))) {
        return 'ats-known';
      }
    }

    // 동적 파서 등록 여부
    if (getDynamicParser(host)) return 'ats-dynamic';

    return 'external';
  } catch {
    return 'unknown';
  }
}

// ============================================
// 추출 전략 함수들
// ============================================

function extractJsonLd(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      // 직접 JobPosting 또는 배열 내에서 찾기
      if (data['@type'] === 'JobPosting') return data;
      if (Array.isArray(data)) {
        const job = data.find(d => d['@type'] === 'JobPosting');
        if (job) return job;
      }
      if (data['@graph']) {
        const job = data['@graph'].find(d => d['@type'] === 'JobPosting');
        if (job) return job;
      }
    } catch { /* skip */ }
  }
  return null;
}

function extractOpenGraph(doc) {
  const og = {};
  const metas = doc.querySelectorAll('meta[property^="og:"]');
  metas.forEach(m => {
    const prop = m.getAttribute('property').replace('og:', '');
    og[prop] = m.getAttribute('content');
  });
  return og;
}

function extractBySelectors(doc, platform) {
  // 불필요 요소 제거
  if (platform.cleanup) {
    platform.cleanup.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });
  }

  // 셀렉터 순서대로 시도
  for (const selector of platform.selectors) {
    const el = doc.querySelector(selector);
    if (el && el.innerHTML.trim().length > 100) {
      return {
        html: el.innerHTML,
        confidence: 80
      };
    }
  }

  return { html: '', confidence: 0 };
}

function extractPlatformMeta(doc, platform) {
  const meta = {};
  if (platform.metaSelectors) {
    for (const [key, selectors] of Object.entries(platform.metaSelectors)) {
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent.trim()) {
          meta[key] = el.textContent.trim();
          break;
        }
      }
    }
  }
  return meta;
}

function extractMetadata(doc, url) {
  const meta = {
    title: '',
    company: '',
    location: '',
    salary: '',
    source: ''
  };

  // <title> 태그
  const titleEl = doc.querySelector('title');
  if (titleEl) meta.title = titleEl.textContent.trim();

  // meta description
  const descMeta = doc.querySelector('meta[name="description"]');
  if (descMeta) {
    const desc = descMeta.getAttribute('content');
    if (desc && !meta.title) meta.title = desc;
  }

  return meta;
}

/**
 * Readability 방식 범용 추출
 * nav, header, footer, aside, ads 등을 제거하고 가장 큰 콘텐츠 블록을 반환
 */
function extractReadable(doc) {
  // 불필요 요소 제거
  const removeSelectors = [
    'script', 'style', 'noscript', 'iframe', 'svg',
    'nav', 'header', 'footer', 'aside',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.nav', '.header', '.footer', '.sidebar', '.menu',
    '.ad', '.ads', '.advertisement', '.banner',
    '.cookie', '.cookie-banner', '.cookie-consent', '.cookie-notice', '.cookie-bar',
    '.cookie-popup', '.cookie-modal', '.cookie-overlay', '.cookie-policy',
    '.cookies-banner', '.cookies-consent', '.cookies-notice',
    '.consent-banner', '.consent-bar', '.consent-modal', '.consent-popup',
    '.gdpr', '.gdpr-banner', '.gdpr-consent', '.gdpr-notice',
    '.cc-banner', '.cc-window', '.cc-revoke',
    '[class*="cookie-consent"]', '[class*="cookie-banner"]', '[class*="cookie-notice"]',
    '[id*="cookie-consent"]', '[id*="cookie-banner"]', '[id*="cookie-notice"]',
    '[id*="CookieConsent"]', '[id*="cookieConsent"]',
    '#onetrust-banner-sdk', '#onetrust-consent-sdk',
    '.onetrust-pc-dark-filter', '.ot-sdk-container',
    '#truste-consent-track', '#trustarc-banner',
    '.popup', '.modal', '.overlay',
    '.share', '.social', '.comment', '.related',
    '#header', '#footer', '#nav', '#sidebar'
  ];
  removeSelectors.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  });

  // 가장 큰 콘텐츠 블록 찾기
  const candidates = doc.querySelectorAll('main, article, [role="main"], .content, .post, .entry, #content, #main, .container');
  let best = null;
  let bestLen = 0;

  for (const el of candidates) {
    const text = el.textContent.trim();
    if (text.length > bestLen) {
      best = el;
      bestLen = text.length;
    }
  }

  // 후보가 없으면 body에서 직접 추출
  if (!best || bestLen < 200) {
    const body = doc.querySelector('body');
    if (body && body.textContent.trim().length > bestLen) {
      best = body;
      bestLen = body.textContent.trim().length;
    }
  }

  if (best) {
    return {
      html: best.innerHTML,
      confidence: bestLen > 500 ? 55 : 35
    };
  }

  return { html: '', confidence: 0 };
}

// ============================================
// 유틸리티 함수
// ============================================

function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

function getPlatformParser(url) {
  try {
    const host = new URL(url).hostname;

    // 1. 정적 파서 (하드코딩)
    if (PLATFORM_PARSERS[host]) return PLATFORM_PARSERS[host];

    // 정적 파서 부분 매칭
    for (const [domain, parser] of Object.entries(PLATFORM_PARSERS)) {
      if (host.endsWith(domain) || host.includes(domain.replace('www.', ''))) {
        return parser;
      }
    }

    // 2. 동적 파서 (AI 분석 결과)
    const dynamicParser = getDynamicParser(host);
    if (dynamicParser) {
      console.log(`[urlExtractor] 동적 파서 사용: ${host}`, dynamicParser.name);
      return dynamicParser;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * 쿠키 동의 배너/팝업/오버레이 제거
 * sanitizeExtractedHtml에서 호출됨
 */
function removeCookieBanners(html) {
  if (!html) return html;
  try {
    const div = document.createElement('div');
    div.innerHTML = html;

    // 셀렉터 기반 제거
    const cookieSelectors = [
      // 클래스명 패턴
      '.cookie-banner', '.cookie-consent', '.cookie-notice', '.cookie-bar',
      '.cookie-popup', '.cookie-modal', '.cookie-overlay', '.cookie-policy',
      '.cookies-banner', '.cookies-consent', '.cookies-notice',
      '.consent-banner', '.consent-bar', '.consent-modal', '.consent-popup',
      '.gdpr', '.gdpr-banner', '.gdpr-consent', '.gdpr-notice',
      '.cc-banner', '.cc-window', '.cc-revoke',
      // 와일드카드 패턴
      '[class*="cookie-consent"]', '[class*="cookie-banner"]', '[class*="cookie-notice"]',
      '[class*="CookieConsent"]', '[class*="cookieConsent"]', '[class*="cookie_consent"]',
      '[class*="CookieBanner"]', '[class*="cookieBanner"]', '[class*="cookie_banner"]',
      '[id*="cookie-consent"]', '[id*="cookie-banner"]', '[id*="cookie-notice"]',
      '[id*="CookieConsent"]', '[id*="cookieConsent"]', '[id*="cookie_consent"]',
      '[id*="CookieBanner"]', '[id*="cookieBanner"]', '[id*="cookie_banner"]',
      // 주요 서드파티 쿠키 동의 SDK
      '#onetrust-banner-sdk', '#onetrust-consent-sdk',
      '.onetrust-pc-dark-filter', '.ot-sdk-container',
      '#truste-consent-track', '#trustarc-banner',
      '#CybotCookiebotDialog', '#CybotCookiebotDialogBody',
      '[id*="cookiebot"]', '[class*="cookiebot"]',
      // 한국 사이트 패턴
      '[class*="privacy-popup"]', '[class*="privacy_popup"]',
      '[id*="privacy-popup"]', '[id*="privacy_popup"]',
      '[class*="개인정보"]',
    ];

    cookieSelectors.forEach(sel => {
      try {
        div.querySelectorAll(sel).forEach(el => el.remove());
      } catch { /* 잘못된 셀렉터 무시 */ }
    });

    // 텍스트 기반 휴리스틱: "쿠키" 관련 텍스트를 포함한 작은 fixed/sticky 요소 제거
    div.querySelectorAll('[style*="fixed"], [style*="sticky"], [style*="z-index"]').forEach(el => {
      const text = el.textContent.trim().toLowerCase();
      const isCookieRelated = /(cookie|쿠키|개인정보.*동의|gdpr|consent|accept.*all)/i.test(text);
      const isSmall = text.length < 500; // 쿠키 배너는 보통 짧음
      if (isCookieRelated && isSmall) {
        el.remove();
      }
    });

    return div.innerHTML;
  } catch {
    return html; // 파싱 실패 시 원본 반환
  }
}

function sanitizeExtractedHtml(html) {
  if (!html) return '';

  // 쿠키 동의 배너/팝업 제거 (DOM 기반)
  html = removeCookieBanners(html);

  // DOMPurify 사용 가능하면 활용
  if (typeof DOMPurify !== 'undefined') {
    html = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr', 'div', 'span',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
        'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
        'a', 'img',
        'blockquote', 'pre', 'code'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height',
        'colspan', 'rowspan', 'scope',
        'style'
      ],
      ALLOW_DATA_ATTR: false
    });
  }

  // 빈 태그 제거
  html = html.replace(/<(\w+)[^>]*>\s*<\/\1>/g, '');
  // 연속 br 정리
  html = html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
  // 연속 공백 정리
  html = html.replace(/\n{3,}/g, '\n\n');

  return html.trim();
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// 캐싱
// ============================================

const CACHE_KEY = 'url_extract_patterns';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30일

function cachePattern(url, confidence) {
  try {
    const host = new URL(url).hostname;
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[host] = {
      lastSuccess: Date.now(),
      confidence,
      count: (cache[host]?.count || 0) + 1
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export function getCachedPatterns() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const now = Date.now();
    // 만료된 항목 제거
    for (const [key, val] of Object.entries(cache)) {
      if (now - val.lastSuccess > CACHE_EXPIRY) {
        delete cache[key];
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return cache;
  } catch {
    return {};
  }
}

// ============================================
// URL 유효성 검사
// ============================================

export function isValidUrl(str) {
  try {
    const url = new URL(str.startsWith('http') ? str : 'https://' + str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractUrlsFromText(text) {
  const urlPattern = /https?:\/\/[^\s<>"')\]]+/g;
  const matches = text.match(urlPattern) || [];
  return [...new Set(matches)].filter(isValidUrl);
}
