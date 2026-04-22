/**
 * AI Service - Handles AI API calls
 */

/**
 * Send message to AI
 */
export async function sendMessage(messages, apiKey, provider = 'openai') {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (provider === 'openai') {
    return sendToOpenAI(messages, apiKey);
  } else if (provider === 'claude') {
    return sendToClaude(messages, apiKey);
  }

  throw new Error('Unknown provider');
}

/**
 * Send to OpenAI API
 */
async function sendToOpenAI(messages, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Send to Claude API
 */
async function sendToClaude(messages, apiKey) {
  const targetUrl = 'https://api.anthropic.com/v1/messages';
  const proxyBase = '/proxy?url=';
  let url;

  // Anthropic API는 브라우저 CORS를 차단하므로 프록시 경유
  try {
    const h = await fetch('/health', { signal: AbortSignal.timeout(2000) });
    url = h.ok ? proxyBase + encodeURIComponent(targetUrl) : targetUrl;
  } catch {
    url = targetUrl;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Claude API error');
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Build context message with current file
 */
export function buildContextMessage(currentFile) {
  if (!currentFile) {
    return 'You are a helpful coding assistant.';
  }

  return `You are a helpful coding assistant. The user is currently editing a ${currentFile.language} file.

Current file: ${currentFile.name}
File content:
\`\`\`${currentFile.language}
${currentFile.content}
\`\`\`

Help the user with questions about this file or provide code improvements.`;
}

/**
 * Extract code blocks from AI response
 */
export function extractCodeBlocks(text) {
  const codeBlocks = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }

  return codeBlocks;
}
