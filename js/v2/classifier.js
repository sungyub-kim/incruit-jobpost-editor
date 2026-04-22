/**
 * v2/classifier.js — AI 헤딩 감지 + 분류 통합
 *
 * 모든 단락 텍스트를 AI에 보내서:
 * 1. 어떤 단락이 섹션 제목인지 감지
 * 2. 각 섹션을 어떤 카테고리로 분류할지 결정
 * → 텍스트 수정 없음 (ID만 반환)
 */

const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const DETECT_PROMPT = `당신은 채용공고 섹션 감지기입니다.

아래는 채용공고에서 추출한 단락 목록입니다. 각 단락에 id와 text가 있습니다.

## 작업
1. 이 중에서 **섹션 제목(큰 타이틀)**인 단락을 찾으세요.
2. 각 섹션 제목을 아래 카테고리로 분류하세요.

## 섹션 제목 판별 기준
- "1. 모집개요", "채용 분야 및 인원", "자격요건" 같은 섹션 구분 제목
- 번호(1., 2., ①, Ⅰ.) 또는 볼드로 강조된 짧은 제목
- "가. 연봉", "나. 수당" 같은 소제목은 **제외** (상위 섹션에 포함)
- 일반 본문 문장, 표 내용, 주의사항(※)은 **제외**

## 허용 카테고리
positions: 모집 부문/분야/인원
duties: 담당 업무
requirements: 자격 요건/응시자격
preferred: 우대 사항
conditions: 근무 조건
salary: 급여/보수
benefits: 복리후생
process: 전형 절차
period: 접수 기간
application: 지원 방법/제출서류
misc: 기타 안내/유의사항/채용근거
other: 위에 해당 안 됨

## 응답 형식 (JSON만, 설명 없음)
\`\`\`json
{"headings": [{"id": 3, "section": "positions"}, {"id": 7, "section": "requirements"}]}
\`\`\`

섹션 제목이 아닌 단락은 포함하지 마세요.`;

/**
 * AI 헤딩 감지 + 분류 통합
 * @param {Array<{id: number, text: string, isBold: boolean}>} paragraphs - 모든 단락
 * @param {string} apiKey
 * @param {string} model
 * @param {string} provider - 'gemini' | 'claude' | 'openai'
 * @returns {{ headingIds: Set<number>, mapping: Map<number, string> }}
 */
export async function detectAndClassifyHeadings(paragraphs, apiKey, model, provider) {
  if (!paragraphs || paragraphs.length === 0) {
    return { headingIds: new Set(), mapping: new Map() };
  }

  // API 키 없으면 키워드 폴백
  if (!apiKey) {
    console.log('[v2/classifier] API 키 없음 — 키워드 폴백');
    return keywordFallback(paragraphs);
  }

  try {
    // 단락 목록 (토큰 절약: text만, 25자 초과 생략)
    const items = paragraphs.map(p => ({
      id: p.id,
      text: p.text.length > 60 ? p.text.substring(0, 60) + '...' : p.text,
      bold: p.isBold || false
    }));

    const userMessage = JSON.stringify(items, null, 0);
    console.log(`[v2/classifier] AI 감지 요청: ${paragraphs.length}개 단락`);

    const response = await callAI(DETECT_PROMPT + '\n\n---\n\n' + userMessage, apiKey, model, provider);
    console.log(`[v2/classifier] AI 응답: ${response.length} chars`);

    const result = parseResponse(response);
    if (result.headingIds.size > 0) {
      console.log(`[v2/classifier] AI 감지: ${result.headingIds.size}개 heading, 분류:`, Object.fromEntries(result.mapping));
      return result;
    }

    console.warn('[v2/classifier] AI 응답에서 heading을 찾지 못함 — 키워드 폴백');
    return keywordFallback(paragraphs);
  } catch (err) {
    console.warn('[v2/classifier] AI 호출 실패 — 키워드 폴백:', err.message);
    return keywordFallback(paragraphs);
  }
}

/**
 * AI 응답 파싱
 */
function parseResponse(text) {
  const headingIds = new Set();
  const mapping = new Map();

  const codeMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonStr = codeMatch ? codeMatch[1].trim() : text.trim();

  try {
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart < 0 || braceEnd < 0) return { headingIds, mapping };

    const data = JSON.parse(jsonStr.slice(braceStart, braceEnd + 1));
    const items = data.headings || data.sections || data.results || [];

    for (const item of items) {
      const id = item.id || item.nodeId;
      const section = item.section || item.category || 'other';
      if (typeof id === 'number') {
        headingIds.add(id);
        mapping.set(id, section);
      }
    }
  } catch (e) {
    console.warn('[v2/classifier] JSON 파싱 실패:', e.message);
  }

  return { headingIds, mapping };
}

/**
 * 키워드 기반 폴백 (AI 미사용)
 */
function keywordFallback(paragraphs) {
  const headingIds = new Set();
  const mapping = new Map();

  // 주요 번호 패턴 (1., 2., Ⅰ.)
  const MAIN_NUM = /^[\s]*(\d+\.|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\.)\s*/;
  // 한국어 소제목 (가., 나.) → 제외
  const SUB_NUM = /^[\s]*[가나다라마바사아자차카타파하]\.\s*/;
  // 25자 제한 + 서술어 어미 제외
  const SENTENCE_END = /(?:있음|없음|됨|함|임|것|등|바람|합니다|됩니다|습니다|입니다|않음|한다|된다|이다)[\s.)]*$/;

  for (const p of paragraphs) {
    const text = p.text;
    if (!text || text.length > 25 || text.length < 2) continue;
    if (SUB_NUM.test(text)) continue;
    if (/^[\s\d.\-·•※○●◎◇◆▶▷★☆()\[\]]+$/.test(text)) continue;
    if (/^[※·•○●◎▶▷★☆□■\-]/.test(text)) continue;
    if (SENTENCE_END.test(text)) continue;

    if (MAIN_NUM.test(text) || p.isBold) {
      headingIds.add(p.id);
      mapping.set(p.id, classifyByKeyword(text));
    }
  }

  console.log(`[v2/classifier] 키워드 폴백: ${headingIds.size}개 heading`);
  return { headingIds, mapping };
}

/**
 * 키워드 분류
 */
function classifyByKeyword(text) {
  const t = text.replace(/^\s*[\d.ⅠⅡⅢⅣⅤⅥ]+[.\s)]*/, '').trim().toLowerCase();

  const rules = [
    [/회사\s*소개|기업\s*소개|기관\s*소개/, 'company_intro'],
    [/모집\s*(부문|분야|직종|인원|개요)|채용\s*(분야|직무|개요|인원)/, 'positions'],
    [/담당\s*업무|주요\s*업무|직무\s*(내용|소개)/, 'duties'],
    [/자격\s*(요건|조건)|지원\s*(자격|요건)|응시\s*자격/, 'requirements'],
    [/우대\s*(사항|조건)|가점/, 'preferred'],
    [/근무\s*(조건|환경|형태|장소)|고용\s*형태/, 'conditions'],
    [/급여|연봉|보수|임금|처우/, 'salary'],
    [/복리\s*후생|복지/, 'benefits'],
    [/전형\s*(절차|과정|방법|일정)|선발/, 'process'],
    [/접수\s*(기간|마감)|마감일|모집\s*기간|공고\s*기간/, 'period'],
    [/접수\s*방법|지원\s*방법|제출\s*서류|지원\s*서류/, 'application'],
    [/기타|참고|유의|주의|비고|문의|채용\s*근거/, 'misc'],
  ];

  for (const [re, section] of rules) {
    if (re.test(t)) return section;
  }
  return 'other';
}

/**
 * AI API 호출 (Gemini / Claude / OpenAI)
 */
async function callAI(prompt, apiKey, model, provider) {
  const p = (provider || '').toLowerCase();

  if (p === 'claude' || p === 'anthropic') {
    return callClaude(prompt, apiKey, model);
  } else if (p === 'openai') {
    return callOpenAI(prompt, apiKey, model);
  } else {
    return callGemini(prompt, apiKey, model);
  }
}

async function callGemini(prompt, apiKey, model) {
  const m = model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 }
    })
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${errBody.substring(0, 200)}`);
  }
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) {
    console.warn('[v2/classifier] Gemini 빈 응답. 전체 응답:', JSON.stringify(data).substring(0, 500));
  }
  return text;
}

async function callClaude(prompt, apiKey, model) {
  const targetUrl = 'https://api.anthropic.com/v1/messages';
  const proxyBase = IS_LOCAL ? 'http://localhost:8787/proxy?url=' : '/proxy?url=';
  let url;
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };

  try {
    const h = await fetch(IS_LOCAL ? 'http://localhost:8787/health' : '/proxy/health', { signal: AbortSignal.timeout(2000) });
    url = h.ok ? proxyBase + encodeURIComponent(targetUrl) : targetUrl;
  } catch { url = targetUrl; }
  if (url === targetUrl) headers['anthropic-dangerous-direct-browser-access'] = 'true';

  const resp = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({ model: model || 'claude-sonnet-4-5-20250929', max_tokens: 2048, temperature: 0, messages: [{ role: 'user', content: prompt }] })
  });
  if (!resp.ok) throw new Error(`Claude ${resp.status}`);
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(prompt, apiKey, model) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model || 'gpt-4o', temperature: 0, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] })
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}
