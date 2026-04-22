/**
 * v2/designer.js — AI 디자인 패스 (JSON CSS 기반 안전 적용)
 *
 * AI에게 HTML을 직접 수정하게 하지 않는다.
 * AI는 CSS 스타일 지시를 JSON으로 반환하고, 코드가 원본 HTML에 적용한다.
 * → 텍스트 훼손 원천 차단.
 */

const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const DESIGN_PROMPT = `당신은 인크루트 채용공고 CSS 디자이너입니다.

아래 HTML은 채용공고를 구조화한 것입니다. 이 HTML을 읽고, 적용할 CSS 스타일 변경 사항을 **JSON으로만** 반환하세요.

⚠ HTML 코드를 직접 수정하거나 반환하지 마세요. JSON만 반환합니다.

## JSON 형식

\`\`\`json
{
  "rules": [
    {"selector": "CSS선택자", "style": "inline-style문자열", "class": "추가할클래스"},
    {"selector": "th", "style": "background-color:#4472c4;color:#fff;padding:8px;font-weight:bold"},
    {"selector": "table", "class": "table_type bTable_1 stable fs15", "attr": {"width":"100%","border":"1"}},
    {"selector": ".sec_title h3", "style": "color:#004494;font-size:18px;border-bottom:2px solid #004494;padding-bottom:6px"}
  ]
}
\`\`\`

## 필드 설명
- **selector**: CSS 선택자 (태그, 클래스, 조합 가능. 예: "th", "table", ".sec_title h3", "td:first-child")
- **style**: 추가할 inline style (기존 style에 병합됨)
- **class**: 추가할 CSS 클래스 (기존 class에 추가됨, 선택)
- **attr**: 추가할 HTML 속성 (선택)

## 인크루트 디자인 가이드
- 테이블 헤더(th): 파란 배경(#4472c4), 흰색 글씨, 패딩 8px
- 테이블: 전체 너비, 1px 테두리, border-collapse
- 테이블 셀(td): 패딩 6px 10px, 세로 상단 정렬, 1px 테두리
- 섹션 제목(.sec_title h3): 진한 파랑(#004494), 하단 보더, 적절한 크기
- 본문 텍스트(p): line-height 1.7, 적절한 색상
- .sec_box: 적절한 패딩
- 중요 텍스트 강조가 이미 <strong>으로 되어 있으므로 추가 불필요

## 주의
- 실용적인 규칙 10~20개 정도면 충분
- JSON만 반환. 설명 없음.

아래 HTML을 분석하고, JSON만 반환하세요.

---

`;

// 인라인 요소 단독 타겟 규칙 차단 (strong에 배지 스타일 적용 방지)
// 차단: 인라인 요소 + 섹션 타이틀 (인크루트 CSS + 사용자 커스텀이 담당)
const BLOCKED_SELECTORS = /^(strong|b|em|i|u|span|a|font|sup|sub|br|h[1-6])$/i;
const BLOCKED_SELECTOR_PATTERNS = [
  /\.sec_title/i,
  /\.sec_title_wrap/i,
  /\.sec_wrap\b/i,
  /\.sec_box\b/i,
  /\bh[1-6]\b/i,
  /^table$/i,
  /\.table_type/i,
  /\.bTable_1/i,
  /\bth\b/i,
  /\btd\b/i,
  /\btbody\b/i,
  /\btr\b/i,
  /^p$/i,             // p 스타일은 인크루트 CSS 기본값 사용
  /^div$/i,
  /\.h\d+/i,          // .h20, .h30, .h40 등 여백 클래스
];

/**
 * AI 응답에서 JSON 추출
 */
function extractJsonFromResponse(text) {
  const codeMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonStr = codeMatch ? codeMatch[1].trim() : text.trim();

  const braceStart = jsonStr.indexOf('{');
  if (braceStart < 0) return null;

  try {
    return JSON.parse(jsonStr.slice(braceStart));
  } catch {
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceEnd > braceStart) {
      try {
        return JSON.parse(jsonStr.slice(braceStart, braceEnd + 1));
      } catch { return null; }
    }
    return null;
  }
}

/**
 * JSON 스타일 규칙을 HTML에 적용
 */
function applyStyleRules(html, rules) {
  const container = document.createElement('div');
  container.innerHTML = html;

  let appliedCount = 0;

  for (const rule of rules) {
    if (!rule.selector) continue;

    const sel = rule.selector.trim();

    // 인라인 요소 단독 타겟 차단
    if (BLOCKED_SELECTORS.test(sel)) {
      console.log(`[v2/designer] 차단 (인라인): ${sel}`);
      continue;
    }

    // 섹션 타이틀/heading 스타일 차단 (인크루트 CSS + 사용자 커스텀이 담당)
    if (BLOCKED_SELECTOR_PATTERNS.some(re => re.test(sel))) {
      console.log(`[v2/designer] 차단 (섹션타이틀): ${sel}`);
      continue;
    }

    let elements;
    try {
      elements = container.querySelectorAll(rule.selector);
    } catch {
      console.warn(`[v2/designer] 잘못된 선택자: ${rule.selector}`);
      continue;
    }

    for (const el of elements) {
      if (rule.style) {
        const existing = el.getAttribute('style') || '';
        el.setAttribute('style', existing ? existing.replace(/;?\s*$/, '; ') + rule.style : rule.style);
      }
      if (rule.class) {
        for (const cls of rule.class.split(/\s+/).filter(Boolean)) {
          el.classList.add(cls);
        }
      }
      if (rule.attr && typeof rule.attr === 'object') {
        for (const [key, val] of Object.entries(rule.attr)) {
          el.setAttribute(key, val);
        }
      }
      appliedCount++;
    }
  }

  console.log(`[v2/designer] ${rules.length}개 규칙 → ${appliedCount}개 요소에 적용`);

  // 적용된 규칙이 없으면 원본 반환 (DOM 재직렬화로 인한 HTML 깨짐 방지)
  if (appliedCount === 0) return html;
  return container.innerHTML;
}

/**
 * HTML minify — 토큰 절약
 */
function minifyHtml(html) {
  return html
    .replace(/\n{2,}/g, '\n')
    .replace(/^[ \t]+/gm, '')
    .trim();
}

/**
 * Gemini API 호출
 */
async function callGemini(prompt, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
    })
  });
  if (!resp.ok) throw new Error(`Gemini API 오류: ${resp.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Claude API 호출
 */
async function callClaude(prompt, apiKey, model) {
  const targetUrl = 'https://api.anthropic.com/v1/messages';
  const proxyBase = IS_LOCAL ? 'http://localhost:8787/proxy?url=' : '/proxy?url=';

  let url;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  };

  try {
    const healthUrl = IS_LOCAL ? 'http://localhost:8787/health' : '/proxy/health';
    const h = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
    url = h.ok ? proxyBase + encodeURIComponent(targetUrl) : targetUrl;
  } catch {
    url = targetUrl;
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  if (url === targetUrl) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!resp.ok) throw new Error(`Claude API 오류: ${resp.status}`);
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

/**
 * OpenAI API 호출
 */
async function callOpenAI(prompt, apiKey, model) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      temperature: 0.1,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!resp.ok) throw new Error(`OpenAI API 오류: ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * AI 디자인 패스 — JSON CSS 규칙 기반 (텍스트 100% 안전)
 */
export async function applyAiDesign(contentHtml, options = {}) {
  const { apiKey, model, provider } = options;
  if (!apiKey) throw new Error('AI 디자인 패스에 API 키가 필요합니다.');

  const minified = minifyHtml(contentHtml);
  console.log(`[v2/designer] minified: ${contentHtml.length} → ${minified.length} chars (${Math.round(minified.length/contentHtml.length*100)}%)`);

  const fullPrompt = DESIGN_PROMPT + minified;

  let response;
  const p = (provider || '').toLowerCase();
  if (p === 'claude' || p === 'anthropic') {
    response = await callClaude(fullPrompt, apiKey, model);
  } else if (p === 'openai') {
    response = await callOpenAI(fullPrompt, apiKey, model);
  } else {
    response = await callGemini(fullPrompt, apiKey, model);
  }

  console.log(`[v2/designer] AI 응답: ${response.length} chars`);

  const result = extractJsonFromResponse(response);
  if (!result || !Array.isArray(result.rules) || result.rules.length === 0) {
    console.warn('[v2/designer] 유효한 JSON 규칙 없음, 원본 유지');
    return contentHtml;
  }

  console.log(`[v2/designer] ${result.rules.length}개 스타일 규칙 수신`);

  return applyStyleRules(contentHtml, result.rules);
}
