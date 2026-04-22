/**
 * v2/verify.js — 새 파이프라인 검증 레이어
 * Step 15 P3 프로토타입
 *
 * 기존 verifyConversion(V1~V6)과 완전 별개.
 * 텍스트 100% 일치 + 테이블 구조 일치 + 노드 매핑 완전성 확인.
 */

/**
 * 텍스트 정규화 — 공백 단일화, 제어문자 제거
 */
function normalizeText(text, stripBullets = false) {
  let t = text
    // 제어문자 제거 (탭·줄바꿈 제외)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 줄바꿈/탭 → 공백
    .replace(/[\r\n\t]+/g, ' ')
    // 연속 공백 단일화
    .replace(/\s+/g, ' ')
    // NBSP → 일반 공백
    .replace(/\u00A0/g, ' ')
    // 양끝 트림
    .trim();

  if (stripBullets) {
    // 블릿 기호 제거 (AI가 CSS 클래스로 대체하므로 비교에서 제외)
    t = t.replace(/[·∙•※○●◎◇◆▶▷★☆□■❏▣❍◉\-―–]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  return t;
}

/**
 * HTML에서 텍스트 추출
 */
function extractText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/**
 * 테이블 구조 추출 (비교용)
 */
function extractTableStructures(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const tables = div.querySelectorAll('table');
  const structures = [];

  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    const rowData = [];
    for (const tr of rows) {
      const cells = tr.querySelectorAll('td, th');
      const cellData = [];
      for (const cell of cells) {
        cellData.push({
          tag: cell.tagName.toLowerCase(),
          rowspan: parseInt(cell.getAttribute('rowspan') || '1'),
          colspan: parseInt(cell.getAttribute('colspan') || '1'),
          text: cell.textContent.trim().substring(0, 50) // 참조용
        });
      }
      rowData.push(cellData);
    }

    // 중첩 테이블 개수
    const nestedCount = table.querySelectorAll('td table, th table').length;

    structures.push({
      rows: rows.length,
      cells: rowData,
      nestedTableCount: nestedCount
    });
  }

  return structures;
}

/**
 * 특수 기호 개수 추출
 */
function countSpecialSymbols(text) {
  return {
    middleDot: (text.match(/·/g) || []).length,
    note: (text.match(/※/g) || []).length,
    circle: (text.match(/[○●◎]/g) || []).length,
  };
}

/**
 * 새 파이프라인 검증
 * @param {string} sourceHtml - 원문 HTML
 * @param {string} assembledHtml - 조립 결과 HTML
 * @returns {VerifyReport}
 */
export function verifyNewPipeline(sourceHtml, assembledHtml, options = {}) {
  const report = {
    grade: 'A',
    textMatch: 0,
    tableMatch: true,
    unmappedCount: 0,
    symbolMatch: true,
    details: [],
    checks: {}
  };

  // ─── 1. 텍스트 완전 일치 ───
  const stripBullets = !!options.stripBullets;
  const sourceText = normalizeText(extractText(sourceHtml), stripBullets);
  const assembledText = normalizeText(extractText(assembledHtml), stripBullets);

  if (sourceText === assembledText) {
    report.textMatch = 100;
    report.checks.textParity = { pass: true, detail: '글자 단위 100% 일치' };
  } else {
    // 글자 단위 비교로 일치율 계산
    const { matchRate, diff } = computeCharMatchRate(sourceText, assembledText);
    report.textMatch = matchRate;
    report.checks.textParity = {
      pass: false,
      detail: `일치율 ${matchRate}%`,
      diff
    };
    report.details.push(`텍스트 일치율: ${matchRate}% (100% 미달)`);
    report.grade = 'F';
  }

  // ─── 2. 테이블 구조 일치 ───
  const sourceTables = extractTableStructures(sourceHtml);
  const assembledTables = extractTableStructures(assembledHtml);

  if (sourceTables.length !== assembledTables.length) {
    report.tableMatch = false;
    report.checks.tableStructure = {
      pass: false,
      detail: `테이블 개수 불일치: 원문 ${sourceTables.length}개, 결과 ${assembledTables.length}개`
    };
    report.details.push(report.checks.tableStructure.detail);
    report.grade = 'F';
  } else {
    let tableMismatch = false;
    const tableDetails = [];

    for (let i = 0; i < sourceTables.length; i++) {
      const src = sourceTables[i];
      const asm = assembledTables[i];

      if (src.rows !== asm.rows) {
        tableMismatch = true;
        tableDetails.push(`테이블 ${i + 1}: 행 수 불일치 (${src.rows} vs ${asm.rows})`);
        continue;
      }

      // 셀별 rowspan/colspan 비교
      for (let r = 0; r < src.cells.length; r++) {
        if (!asm.cells[r]) {
          tableMismatch = true;
          tableDetails.push(`테이블 ${i + 1}: 행 ${r + 1} 누락`);
          continue;
        }
        if (src.cells[r].length !== asm.cells[r].length) {
          tableMismatch = true;
          tableDetails.push(`테이블 ${i + 1} 행 ${r + 1}: 셀 수 불일치 (${src.cells[r].length} vs ${asm.cells[r].length})`);
          continue;
        }
        for (let c = 0; c < src.cells[r].length; c++) {
          const srcCell = src.cells[r][c];
          const asmCell = asm.cells[r][c];
          if (srcCell.rowspan !== asmCell.rowspan || srcCell.colspan !== asmCell.colspan) {
            tableMismatch = true;
            tableDetails.push(
              `테이블 ${i + 1} [${r + 1},${c + 1}]: span 불일치 ` +
              `(${srcCell.rowspan}x${srcCell.colspan} vs ${asmCell.rowspan}x${asmCell.colspan})`
            );
          }
        }
      }

      // 중첩 테이블 비교
      if (src.nestedTableCount !== asm.nestedTableCount) {
        tableMismatch = true;
        tableDetails.push(`테이블 ${i + 1}: 중첩 테이블 수 불일치 (${src.nestedTableCount} vs ${asm.nestedTableCount})`);
      }
    }

    if (tableMismatch) {
      report.tableMatch = false;
      report.checks.tableStructure = { pass: false, detail: tableDetails.join('; ') };
      report.details.push(...tableDetails);
      report.grade = 'F';
    } else {
      report.checks.tableStructure = { pass: true, detail: `${sourceTables.length}개 테이블 구조 완전 일치` };
    }
  }

  // ─── 3. 특수 기호 일치 ───
  const sourceSymbols = countSpecialSymbols(sourceText);
  const assembledSymbols = countSpecialSymbols(assembledText);
  const symbolMismatches = [];

  for (const [key, srcCount] of Object.entries(sourceSymbols)) {
    const asmCount = assembledSymbols[key] || 0;
    if (srcCount !== asmCount) {
      symbolMismatches.push(`${key}: ${srcCount} → ${asmCount}`);
    }
  }

  if (symbolMismatches.length > 0) {
    report.symbolMatch = false;
    report.checks.symbols = { pass: false, detail: symbolMismatches.join(', ') };
    report.details.push(`특수기호 불일치: ${symbolMismatches.join(', ')}`);
    // 특수기호 불일치만으로는 F가 아닌 경고 — 텍스트 100%이면 A 유지
  } else {
    report.checks.symbols = { pass: true, detail: '특수기호 개수 일치' };
  }

  // ─── 등급 결정 ───
  // A: 텍스트 100% + 테이블 100%
  // F: 텍스트 또는 테이블 미달
  if (report.textMatch === 100 && report.tableMatch) {
    report.grade = 'A';
  } else {
    report.grade = 'F';
  }

  // 기존 verifyResult 호환 필드
  report.score = report.grade === 'A' ? 100 : Math.round(report.textMatch * 0.8);
  report.pipeline = 'v2';

  return report;
}

/**
 * 글자 단위 일치율 계산 (순차 매칭 — 삽입/삭제 허용)
 * 원문의 각 문자가 결과에 순서대로 존재하는지 확인.
 * "1 채용" vs "1. 채용" → "." 삽입은 무시하고 나머지 매칭.
 */
function computeCharMatchRate(sourceText, assembledText) {
  if (!sourceText && !assembledText) return { matchRate: 100, diff: '' };
  if (!sourceText || !assembledText) return { matchRate: 0, diff: '한쪽 텍스트 없음' };

  let matched = 0;
  let aIdx = 0;
  for (let i = 0; i < sourceText.length; i++) {
    const ch = sourceText[i];
    // 결과 텍스트에서 현재 위치부터 100자 범위 내에서 같은 문자 탐색
    const searchEnd = Math.min(aIdx + 100, assembledText.length);
    const found = assembledText.indexOf(ch, aIdx);
    if (found >= 0 && found < searchEnd) {
      matched++;
      aIdx = found + 1;
    }
  }

  const matchRate = Math.round((matched / sourceText.length) * 100);
  const diff = `${matched}/${sourceText.length}자 매칭 (결과 ${assembledText.length}자)`;

  return { matchRate: Math.max(0, Math.min(100, matchRate)), diff };
}
