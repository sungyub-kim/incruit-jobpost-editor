/**
 * v2/index.js — convertV2 오케스트레이터
 *
 * 파이프라인: parseSource → AI 헤딩 감지+분류 → assemble → verify
 */
import { parseSource } from './parser.js';
import { detectAndClassifyHeadings } from './classifier.js';
import { assemble } from './assembler.js';
import { verifyNewPipeline } from './verify.js';
import { mapPuaCharacters } from '../services/fileExtractor.js';

/**
 * v2 변환 파이프라인
 * @param {string} sourceHtml - 원문 HTML
 * @param {object} options
 * @returns {{ html: string, verifyReport: object, debug: object }}
 */
export async function convertV2(sourceHtml, options = {}) {
  const progress = options.onProgress || (() => {});

  // ─── [0] PUA 문자 정규화 — HWP 커스텀 폰트(F2B1 등)를 표준 유니코드로 치환 (build 411)
  // 이 단계 없으면 ①② 같은 원문자가 렌더 시 ≡ 비슷한 fallback 글리프로 표시됨
  const mapped = mapPuaCharacters(sourceHtml || '');
  if (mapped !== sourceHtml) {
    console.log('[v2] PUA 문자 치환 적용됨');
    sourceHtml = mapped;
  }

  // ─── [1] 원문 파싱 (모든 단락을 para/table로) ───
  progress('원문 파싱 중...');

  window.__v2SourceHtml = sourceHtml;
  console.log('[v2] 입력 HTML 길이:', sourceHtml.length, '자');
  console.log('[v2] 입력 HTML 시작 300자:', sourceHtml.substring(0, 300));

  const nodes = parseSource(sourceHtml);
  const nodeCount = nodes.length;
  const tableCount = nodes.filter(n => n.type === 'table').length;
  const totalRawLen = nodes.reduce((s, n) => s + n.rawHtml.length, 0);
  const coverage = sourceHtml.length > 0 ? Math.round(totalRawLen / sourceHtml.length * 100) : 0;

  console.log('[v2] 파싱 결과:', nodeCount, '개 노드');
  console.log('[v2] 타입별:', JSON.stringify(nodes.reduce((a, n) => { a[n.type] = (a[n.type] || 0) + 1; return a; }, {})));
  console.log('[v2] 파싱 커버리지:', coverage + '% (' + totalRawLen + '/' + sourceHtml.length + ')');

  progress(`파싱 완료: ${nodeCount}개 노드 (테이블 ${tableCount}, 커버리지 ${coverage}%)`);

  // ─── [2] AI 헤딩 감지 + 분류 (통합) ───
  // 모든 non-table 단락을 AI에 보내서 섹션 제목 감지 + 분류를 한번에
  const paragraphs = nodes
    .filter(n => n.type === 'para' || n.type === 'heading')
    .map(n => ({
      id: n.id,
      text: n.rawText,
      isBold: n.type === 'heading' || /<strong|<b[\s>]/i.test(n.rawHtml)
    }));

  const provider = options.provider || _detectProvider(options.model);
  progress(`AI 섹션 감지 중... (${paragraphs.length}개 단락)`);

  const { headingIds, mapping: headingMapping } = await detectAndClassifyHeadings(
    paragraphs, options.apiKey, options.model, provider
  );

  // parser가 감지한 heading + AI가 감지한 heading 통합
  for (const node of nodes) {
    if (headingIds.has(node.id) && node.type !== 'heading') {
      node.type = 'heading';
      node.level = 2;
    }
  }

  const headingCount = nodes.filter(n => n.type === 'heading').length;
  progress(`섹션 감지 완료: ${headingCount}개 heading`);

  // ─── [3] 독립 숫자 + heading 병합 (후처리) ───
  // AI 감지 후에도 독립 숫자가 heading 앞에 있으면 병합
  for (let i = nodes.length - 2; i >= 0; i--) {
    const curr = nodes[i];
    const next = nodes[i + 1];
    if (curr.type === 'para' && next.type === 'heading' && /^\s*\d+\s*$/.test(curr.rawText)) {
      next.sectionNumber = curr.rawText.trim();
      nodes.splice(i, 1);
    }
  }

  // ─── [4] 조립 ───
  progress('HTML 조립 중...');
  const assembled = assemble(nodes, headingMapping, {
    useIncruitWrapper: options.useIncruitWrapper !== false,
    brandColor: options.brandColor
  });
  progress('조립 완료');

  // ─── [5] 검증 ───
  progress('원문 보존 검증 중...');
  let finalContentHtml = assembled.contentHtml;
  const verifyReport = verifyNewPipeline(sourceHtml, finalContentHtml);

  progress(`검증 완료: ${verifyReport.grade} 등급 (텍스트 ${verifyReport.textMatch}%)`);

  // 디버그
  window.__lastV2Result = {
    nodes,
    headingIds: [...headingIds],
    headingMapping: Object.fromEntries(headingMapping),
    assembled,
    verifyReport
  };
  window.__lastVerifyReport = verifyReport;

  return {
    html: assembled.html,
    verifyReport,
    debug: {
      nodeCount: nodes.length,
      headingCount,
      tableCount,
      sectionOrder: assembled.debug.sectionOrder,
      unmappedCount: assembled.debug.unmappedCount,
      headingMapping: Object.fromEntries(headingMapping)
    }
  };
}

function _detectProvider(model) {
  if (!model) return 'gemini';
  const m = model.toLowerCase();
  if (m.includes('claude') || m.includes('opus') || m.includes('sonnet') || m.includes('haiku')) return 'claude';
  if (m.includes('gpt') || m.includes('o1') || m.includes('o3') || m.includes('o4')) return 'openai';
  return 'gemini';
}
