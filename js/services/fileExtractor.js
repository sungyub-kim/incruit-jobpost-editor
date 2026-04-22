/**
 * File Extractor Service
 * 파일에서 텍스트/HTML 추출 (서식 보존)
 * mammoth.js (Word), SheetJS (Excel), pdf.js (PDF), hwp.js (HWP)
 */

/**
 * PUA (Private Use Area) 문자 매핑 테이블
 * HWP → PDF 변환 시 한컴 폰트의 특수문자가 PUA 영역(U+E000-U+F8FF)으로 매핑되는 패턴 처리
 */
const PUA_MAP = new Map([
  // 원문자 ①-⑩
  [0xE001, '\u2460'], [0xE002, '\u2461'], [0xE003, '\u2462'], [0xE004, '\u2463'], [0xE005, '\u2464'],
  [0xE006, '\u2465'], [0xE007, '\u2466'], [0xE008, '\u2467'], [0xE009, '\u2468'], [0xE00A, '\u2469'],
  // 원문자 ⑪-⑳
  [0xE00B, '\u246A'], [0xE00C, '\u246B'], [0xE00D, '\u246C'], [0xE00E, '\u246D'], [0xE00F, '\u246E'],
  // 한글 원문자 ㉮-㉲
  [0xE010, '\u326E'], [0xE011, '\u326F'], [0xE012, '\u3270'], [0xE013, '\u3271'], [0xE014, '\u3272'],
  // 한글 원문자 ㉳-㉻ (확장)
  [0xE015, '\u3273'], [0xE016, '\u3274'], [0xE017, '\u3275'], [0xE018, '\u3276'], [0xE019, '\u3277'],
  [0xE01A, '\u3278'], [0xE01B, '\u3279'], [0xE01C, '\u327A'], [0xE01D, '\u327B'],
  // 특수 기호 (한컴 폰트 HWP Symbol 계열)
  [0xE020, '\u25CB'], [0xE021, '\u25CF'], [0xE022, '\u25A0'], [0xE023, '\u25A1'], // ○●■□
  [0xE024, '\u25B6'], [0xE025, '\u25B7'], [0xE026, '\u2605'], [0xE027, '\u2606'], // ▶▷★☆
  [0xE028, '\u203B'], [0xE029, '\u25C6'], [0xE02A, '\u25C7'],                     // ※◆◇
  [0xE02B, '\u25AA'], [0xE02C, '\u25AB'], [0xE02D, '\u25CE'], [0xE02E, '\u25A3'], // ▪▫◎▣
  [0xE02F, '\u2611'], [0xE030, '\u2610'],                                         // ☑☐
  // 화살표
  [0xE031, '\u2190'], [0xE032, '\u2191'], [0xE033, '\u2192'], [0xE034, '\u2193'], // ←↑→↓
  [0xE035, '\u2194'], [0xE036, '\u2195'],                                         // ↔↕
  [0xE037, '\u21D0'], [0xE038, '\u21D1'], [0xE039, '\u21D2'], [0xE03A, '\u21D3'], // ⇐⇑⇒⇓
  [0xE03B, '\u21D4'], [0xE03C, '\u21D5'],                                         // ⇔⇕
  // 수학/기술 기호
  [0xE040, '\u00B1'], [0xE041, '\u00D7'], [0xE042, '\u00F7'], [0xE043, '\u2260'], // ±×÷≠
  [0xE044, '\u2264'], [0xE045, '\u2265'], [0xE046, '\u221E'], [0xE047, '\u2234'], // ≤≥∞∴
  [0xE048, '\u00B0'], [0xE049, '\u2032'], [0xE04A, '\u2033'],                     // °′″
  [0xE04B, '\u2103'], [0xE04C, '\u212B'], [0xE04D, '\u2030'],                     // ℃Å‰
  [0xE04E, '\u266A'], [0xE04F, '\u266D'],                                         // ♪♭
  // 괄호/기호
  [0xE050, '\u3008'], [0xE051, '\u3009'], [0xE052, '\u300A'], [0xE053, '\u300B'], // 〈〉《》
  [0xE054, '\u300C'], [0xE055, '\u300D'], [0xE056, '\u300E'], [0xE057, '\u300F'], // 「」『』
  [0xE058, '\u3010'], [0xE059, '\u3011'],                                         // 【】
  // 로마 숫자
  [0xE060, '\u2160'], [0xE061, '\u2161'], [0xE062, '\u2162'], [0xE063, '\u2163'], // Ⅰ-Ⅳ
  [0xE064, '\u2164'], [0xE065, '\u2165'], [0xE066, '\u2166'], [0xE067, '\u2167'], // Ⅴ-Ⅷ
  [0xE068, '\u2168'], [0xE069, '\u2169'],                                         // Ⅸ-Ⅹ
  // 소문자 로마 숫자
  [0xE06A, '\u2170'], [0xE06B, '\u2171'], [0xE06C, '\u2172'], [0xE06D, '\u2173'], // ⅰ-ⅳ
  [0xE06E, '\u2174'], [0xE06F, '\u2175'], [0xE070, '\u2176'], [0xE071, '\u2177'], // ⅴ-ⅷ
  [0xE072, '\u2178'], [0xE073, '\u2179'],                                         // ⅸ-ⅹ
  // 추가 기호
  [0xE080, '\u2640'], [0xE081, '\u2642'],                                         // ♀♂
  [0xE082, '\u2660'], [0xE083, '\u2663'], [0xE084, '\u2665'], [0xE085, '\u2666'], // ♠♣♥♦
  [0xE086, '\u260E'], [0xE087, '\u260F'],                                         // ☎☏
  [0xE088, '\u2709'], [0xE089, '\u270C'],                                         // ✉✌
  // 한컴 돋움/바탕 PUA 대체 매핑 (일부 PDF 변환기에서 다른 오프셋 사용)
  [0xF020, '\u25CB'], [0xF021, '\u25CF'], [0xF022, '\u25A0'], [0xF023, '\u25A1'],
  [0xF024, '\u25B6'], [0xF025, '\u25B7'], [0xF026, '\u2605'], [0xF027, '\u2606'],
  [0xF028, '\u203B'], [0xF029, '\u25C6'], [0xF02A, '\u25C7'],
  [0xF06C, '\u25CB'], [0xF06D, '\u25CF'], [0xF06E, '\u25A0'], [0xF06F, '\u25A1'],
  [0xF0A1, '\u2460'], [0xF0A2, '\u2461'], [0xF0A3, '\u2462'], [0xF0A4, '\u2463'],
  [0xF0A5, '\u2464'], [0xF0A6, '\u2465'], [0xF0A7, '\u2466'], [0xF0A8, '\u2467'], // ⑤-⑧
  [0xF0A9, '\u2468'], [0xF0AA, '\u2469'],                                         // ⑨-⑩
  [0xF0B7, '\u2022'], // bullet •
  [0xF0B0, '\u00B0'], // degree °
  [0xF0D7, '\u00D7'], // multiplication ×
  [0xF0B1, '\u00B1'], // plus-minus ±
  // HWP 한컴 돋움/바탕 PUA (F2B0-F2BA) — 원문자 1~10 (LibreOffice HTML 변환 출력에서 관찰됨)
  [0xF2B1, '\u2460'], [0xF2B2, '\u2461'], [0xF2B3, '\u2462'], [0xF2B4, '\u2463'],
  [0xF2B5, '\u2464'], [0xF2B6, '\u2465'], [0xF2B7, '\u2466'], [0xF2B8, '\u2467'],
  [0xF2B9, '\u2468'], [0xF2BA, '\u2469'],                                         // ⑨-⑩
]);

export function mapPuaCharacters(text) {
  if (!text) return text;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xE000 && code <= 0xF8FF) {
      result += PUA_MAP.get(code) || text[i];
    } else {
      result += text[i];
    }
  }
  return result;
}

function containsPuaCharacters(text) {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xE000 && code <= 0xF8FF) return true;
  }
  return false;
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/**
 * 파일에서 HTML 추출 (서식 보존)
 * @param {File} file
 * @returns {Promise<{ text: string, html: string, warnings: string[] }>}
 */
export async function extractFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'docx':
    case 'doc':
      return extractWord(file);
    case 'xlsx':
    case 'xls':
      return extractExcel(file);
    case 'pdf':
      return extractPdf(file);
    case 'hwp':
      return extractHwp(file);
    case 'hwpx':
      return extractHwpx(file);
    default:
      throw new Error(`지원하지 않는 파일 형식: .${ext}`);
  }
}

/**
 * Word (.docx/.doc) → HTML (mammoth.js)
 * 테이블, 볼드, 이탤릭, 리스트 보존
 */
async function extractWord(file) {
  if (typeof mammoth === 'undefined') {
    throw new Error('mammoth.js 라이브러리가 로드되지 않았습니다.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='List Paragraph'] => li:fresh",
        "p[style-name='제목 1'] => h1:fresh",
        "p[style-name='제목 2'] => h2:fresh",
        "p[style-name='제목 3'] => h3:fresh",
        "p[style-name='목록 단락'] => li:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
        "table => table",
        "tr => tr",
        "td => td",
        "th => th"
      ],
      convertImage: mammoth.images.imgElement(img => img.read('base64').then(data => ({
        src: `data:${img.contentType};base64,${data}`
      })))
    }
  );

  // mammoth 출력 후 단락 정렬 복원: center/right 단락에 style 추가
  let html = result.value;
  html = _mammothFixAlignment(html);

  return {
    html,
    text: stripHtml(html),
    warnings: result.messages.map(m => m.message)
  };
}

/**
 * mammoth.js 출력 HTML에서 텍스트 정렬 단서를 찾아 style 보완
 * (mammoth는 inline style을 생성하지 않으므로 후처리로 보완)
 */
function _mammothFixAlignment(html) {
  // mammoth가 생성한 <p style="text-align: center/right/justify"> 는 이미 있을 수 있음
  // 없는 경우에도 mammoth의 class 기반 힌트를 활용
  // 현재는 pass-through (mammoth 자체가 정렬 정보를 버리므로 후처리 한계)
  return html;
}

/**
 * Excel (.xlsx/.xls) → HTML 테이블 (SheetJS)
 * 셀 병합, 헤더 보존
 */
async function extractExcel(file) {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS(XLSX) 라이브러리가 로드되지 않았습니다.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });

  let html = '';
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (workbook.SheetNames.length > 1) {
      html += `<h3>${sheetName}</h3>\n`;
    }
    html += _sheetToStyledHtml(workbook, sheet);
    html += '\n';
  }

  return {
    html,
    text: stripHtml(html),
    warnings: []
  };
}

/**
 * SheetJS 시트 → 정렬·배경·폰트 inline style 포함 HTML 테이블
 * sheet_to_html() 대체 커스텀 렌더러
 */
function _sheetToStyledHtml(workbook, sheet) {
  if (!sheet || !sheet['!ref']) return '<table></table>';

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const merges = sheet['!merges'] || [];
  const cols = sheet['!cols'] || [];
  const rows = sheet['!rows'] || [];

  // 병합 셀 맵: 'R,C' → { rs, cs } (시작 셀) 또는 null (이어진 셀)
  const mergeMap = {};
  for (const m of merges) {
    const rs = m.e.r - m.s.r + 1;
    const cs = m.e.c - m.s.c + 1;
    mergeMap[`${m.s.r},${m.s.c}`] = { rs, cs };
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) {
          mergeMap[`${r},${c}`] = null;
        }
      }
    }
  }

  const H_ALIGN = { left: 'left', center: 'center', right: 'right', fill: 'left', justify: 'justify', distributed: 'justify', centerContinuous: 'center' };
  const V_ALIGN = { top: 'top', center: 'middle', bottom: 'bottom', distributed: 'middle', justify: 'middle' };

  let tableHtml = '<table>';
  for (let R = range.s.r; R <= range.e.r; R++) {
    const rowH = rows[R] && rows[R].hpx ? `height:${rows[R].hpx}px;` : '';
    tableHtml += `<tr${rowH ? ` style="${rowH}"` : ''}>`;

    for (let C = range.s.c; C <= range.e.c; C++) {
      const key = `${R},${C}`;
      if (mergeMap[key] === null) continue; // 병합 이어진 셀 건너뜀

      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr];
      const merge = mergeMap[key];

      let tdAttrs = '';
      if (merge) {
        if (merge.cs > 1) tdAttrs += ` colspan="${merge.cs}"`;
        if (merge.rs > 1) tdAttrs += ` rowspan="${merge.rs}"`;
      }

      // 셀 스타일 추출
      const cellStyles = [];
      const s = cell && cell.s ? cell.s : null;
      if (s) {
        // 정렬
        if (s.alignment) {
          const ha = s.alignment.horizontal;
          const va = s.alignment.vertical;
          if (ha && H_ALIGN[ha]) cellStyles.push(`text-align:${H_ALIGN[ha]}`);
          if (va && V_ALIGN[va]) cellStyles.push(`vertical-align:${V_ALIGN[va]}`);
          if (s.alignment.wrapText) cellStyles.push('white-space:pre-wrap;word-break:break-word');
        }
        // 배경색
        const fill = s.fgColor || (s.fill && s.fill.fgColor);
        if (fill) {
          const rgb = fill.rgb || fill.theme;
          if (rgb && !/^(FFFFFF|000000|00000000)$/i.test(rgb)) {
            cellStyles.push(`background-color:#${rgb.slice(-6)}`);
          }
        }
        // 폰트
        const font = s.font || null;
        if (font) {
          if (font.sz) cellStyles.push(`font-size:${font.sz}pt`);
          if (font.bold) cellStyles.push('font-weight:bold');
          if (font.italic) cellStyles.push('font-style:italic');
          if (font.underline) cellStyles.push('text-decoration:underline');
          const fc = font.color && (font.color.rgb || font.color.theme);
          if (fc && !/^(000000|00000000)$/i.test(fc)) {
            cellStyles.push(`color:#${fc.slice(-6)}`);
          }
        }
      }
      // 열 너비
      if (cols[C] && cols[C].wpx) {
        cellStyles.push(`width:${cols[C].wpx}px`);
      }

      const styleAttr = cellStyles.length ? ` style="${cellStyles.join(';')}"` : '';
      const value = cell ? String(XLSX.utils.format_cell(cell) || '').replace(/\n/g, '<br>') : '';
      tableHtml += `<td${tdAttrs}${styleAttr}>${value}</td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</table>';
  return tableHtml;
}

/**
 * PDF → 텍스트 + 구조 추출 (pdf.js)
 * 텍스트 위치 기반 테이블 구조 추론
 */
async function extractPdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('pdf.js 라이브러리가 로드되지 않았습니다.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true
  }).promise;
  const warnings = [];
  let allLines = [];
  let hasPuaCharacters = false;

  const maxPages = Math.min(pdf.numPages, 50);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items;

    if (items.length === 0) continue;

    // Unicode NFC 정규화 + PUA 문자 매핑 (HWP→PDF 변환 시 한컴 폰트 특수문자 복원)
    items.forEach(item => {
      if (item.str) {
        if (containsPuaCharacters(item.str)) hasPuaCharacters = true;
        item.str = mapPuaCharacters(item.str).normalize('NFC');
      }
    });

    // 줄 단위로 그룹핑 (y좌표 기준)
    const lines = groupTextByLines(items);
    allLines.push(...lines);
  }

  // 줄을 HTML로 변환 (테이블 구조 감지 포함)
  const html = linesToHtml(allLines);

  if (pdf.numPages > 50) {
    warnings.push('PDF가 50페이지를 초과합니다. 처음 50페이지만 추출되었습니다.');
  }

  if (hasPuaCharacters) {
    warnings.push('PDF에서 HWP 전용 특수문자(PUA)가 감지되어 자동 매핑했습니다. 일부 기호가 정확하지 않을 수 있습니다.');
  }

  return {
    html,
    text: stripHtml(html),
    warnings,
    metadata: {
      format: 'pdf',
      pages: pdf.numPages,
      hasPuaCharacters
    }
  };
}

/**
 * PDF 텍스트 아이템을 줄 단위로 그룹핑
 * 동적 Y-허용치: 중앙값 폰트 크기의 40% (최소 3pt, 최대 12pt)
 */
function groupTextByLines(items) {
  if (items.length === 0) return [];

  const fontSizes = items
    .map(it => Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 12)
    .sort((a, b) => a - b);
  const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)];
  const yTolerance = Math.min(12, Math.max(3, medianFontSize * 0.4));

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  const lines = [];
  let currentLine = { y: sorted[0].transform[5], items: [sorted[0]] };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const y = item.transform[5];
    if (Math.abs(y - currentLine.y) <= yTolerance) {
      currentLine.items.push(item);
    } else {
      currentLine.items.sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(currentLine);
      currentLine = { y, items: [item] };
    }
  }
  currentLine.items.sort((a, b) => a.transform[4] - b.transform[4]);
  lines.push(currentLine);

  return lines;
}

/**
 * PDF fontName에서 굵기·기울임 감지
 */
function isFontBold(fontName) {
  if (!fontName) return false;
  const name = fontName.split('+').pop().toLowerCase();
  return /bold|heavy|black|demi|semibold/.test(name);
}
function isFontItalic(fontName) {
  if (!fontName) return false;
  const name = fontName.split('+').pop().toLowerCase();
  return /italic|oblique/.test(name);
}

/**
 * 한 줄의 아이템들을 텍스트 세그먼트(열)로 분할
 *
 * 원리: start-to-start 거리만 사용 (width 의존 제거)
 * - width 정보가 0인 한국어 PDF에서도 안정적으로 작동
 * - 열 경계 판별: end-to-start 갭(width 있을 때) 또는 start-to-start 대비 상대 갭
 *
 * @returns {{ segments: string[], text: string, fontSize: number, bold: boolean, italic: boolean }}
 */
function analyzeLineItems(items) {
  if (items.length === 0) return { segments: [], text: '', fontSize: 12, bold: false, italic: false };

  const fontSize = Math.abs(items[0].transform[0]) || Math.abs(items[0].transform[3]) || 12;

  // 굵기·기울임: 과반수 아이템 기준
  const boldCount = items.filter(it => isFontBold(it.fontName)).length;
  const italicCount = items.filter(it => isFontItalic(it.fontName)).length;
  const bold = boldCount > items.length * 0.4;
  const italic = italicCount > items.length * 0.4;

  if (items.length === 1) {
    const t = items[0].str.trim();
    return { segments: t ? [t] : [], text: t, fontSize, bold, italic };
  }

  // 갭 계산 — width > 0이면 end-to-start, 아니면 start-to-start
  const gapInfos = [];
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    const s2s = curr.transform[4] - prev.transform[4]; // start-to-start (항상 정확)
    let e2s = s2s; // end-to-start (width 있을 때만 정확)
    if (prev.width > 0) {
      e2s = curr.transform[4] - (prev.transform[4] + prev.width);
    }
    gapInfos.push({ s2s, e2s });
  }

  // ── 열 경계 임계값 결정 ──
  // 방법 A: width가 있는 아이템이 과반이면 end-to-start 기반
  const hasWidth = items.filter(it => it.width > 0).length > items.length * 0.5;

  let columnThreshold;
  if (hasWidth) {
    // end-to-start 갭이 fontSize * 2 이상이면 열 경계
    columnThreshold = fontSize * 2;
  } else {
    // start-to-start만 사용: 갭 분포에서 "큰 갭"을 찾기
    // 정렬 후 최대 점프(gap of gaps)를 찾아 자연스런 분리점 결정
    const sorted = gapInfos.map(g => g.s2s).sort((a, b) => a - b);
    let bestSplit = fontSize * 4; // 기본 절대 임계값

    if (sorted.length >= 3) {
      // 갭들 사이의 최대 점프 찾기 — 자연 경계
      let maxJump = 0, jumpAt = -1;
      for (let i = 1; i < sorted.length; i++) {
        const jump = sorted[i] - sorted[i - 1];
        if (jump > maxJump) {
          maxJump = jump;
          jumpAt = i;
        }
      }
      // 최대 점프가 의미 있는 크기(fontSize 이상)이고 분리점이 합리적이면 사용
      if (maxJump >= fontSize && jumpAt > 0) {
        const splitValue = (sorted[jumpAt - 1] + sorted[jumpAt]) / 2;
        // 분리점이 너무 작으면(fontSize * 1.5 미만) 무시 — 오탐 방지
        if (splitValue >= fontSize * 1.5) {
          bestSplit = splitValue;
        }
      }
    }
    columnThreshold = bestSplit;
  }

  // ── 세그먼트 분할 + 텍스트 결합 ──
  const segments = [];
  let seg = items[0].str;
  const textParts = [items[0].str];

  for (let i = 0; i < gapInfos.length; i++) {
    const gap = hasWidth ? gapInfos[i].e2s : gapInfos[i].s2s;
    const nextStr = items[i + 1].str;

    if (gap > columnThreshold) {
      // 열 경계
      segments.push(seg.trim());
      seg = nextStr;
      textParts.push('\t'); // 텍스트에는 탭으로 구분
      textParts.push(nextStr);
    } else {
      // 같은 열 내: 공백 삽입 여부 판단
      const wordGap = hasWidth ? (gapInfos[i].e2s > fontSize * 0.3) : (gapInfos[i].s2s > fontSize * 0.8);
      if (wordGap) {
        seg += ' ' + nextStr;
        textParts.push(' ');
      } else {
        seg += nextStr;
      }
      textParts.push(nextStr);
    }
  }
  segments.push(seg.trim());

  const validSegments = segments.filter(Boolean);
  const fullText = validSegments.join(' ');

  return { segments: validSegments, text: fullText, fontSize, bold, italic };
}

/**
 * 그룹핑된 줄을 HTML로 변환 (테이블 구조 감지)
 *
 * 테이블 판정 규칙:
 * - 2줄 이상 연속으로 2+ 세그먼트 → 테이블
 * - 단독 1줄이라도 3+ 세그먼트 → 테이블
 * - 1줄에 2 세그먼트뿐 → "키: 값" 패턴일 수 있으므로 일반 텍스트로 처리
 */
function linesToHtml(lines) {
  if (lines.length === 0) return '<p></p>';

  const LIST_MARKER_RE = /^\s*(?:[○●■□▶▷★☆※•◆◇▪▫◎▣☐☑‣⁃·\-]\s|[\u2460-\u2473]|[\u326E-\u327F]|[\u3280-\u32BF]|\d+[.)]\s|[가-힣][.)]\s|\(\d+\)\s)/;

  // 1차: 줄별 분석
  const lineData = lines.map(line => {
    const filtered = line.items.filter(it => it.str && it.str.trim());
    return analyzeLineItems(filtered);
  });

  // 2차: 테이블 영역 마킹
  const isTableLine = new Array(lineData.length).fill(false);
  let runStart = -1;
  for (let i = 0; i <= lineData.length; i++) {
    const multiSeg = i < lineData.length && lineData[i].segments.length >= 2;
    if (multiSeg) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        const runLen = i - runStart;
        if (runLen >= 2) {
          // 2줄 이상 연속 → 테이블
          for (let j = runStart; j < i; j++) isTableLine[j] = true;
        } else if (lineData[runStart].segments.length >= 3) {
          // 단독 1줄이지만 3+ 세그먼트 → 테이블
          isTableLine[runStart] = true;
        }
        runStart = -1;
      }
    }
  }

  // 3차: HTML 생성
  let html = '';
  let inTable = false;
  let tableRows = [];
  let paraBuffer = [];

  const flushPara = () => {
    if (paraBuffer.length > 0) {
      html += `<p>${paraBuffer.join('<br>')}</p>\n`;
      paraBuffer = [];
    }
  };

  for (let idx = 0; idx < lineData.length; idx++) {
    const { segments, text, fontSize, bold, italic } = lineData[idx];

    if (segments.length === 0) {
      if (inTable) { html += buildTable(tableRows); tableRows = []; inTable = false; }
      flushPara();
      continue;
    }

    if (isTableLine[idx]) {
      flushPara();
      if (!inTable) inTable = true;
      tableRows.push(segments);
      continue;
    }

    if (inTable) { html += buildTable(tableRows); tableRows = []; inTable = false; }

    // 서식 적용 (bold/italic)
    const applyFormat = (str) => {
      let s = escapeHtml(str);
      if (bold) s = `<strong>${s}</strong>`;
      if (italic) s = `<em>${s}</em>`;
      return s;
    };

    // 제목 감지
    if (fontSize > 16) {
      flushPara();
      html += `<h2>${applyFormat(text)}</h2>\n`;
    } else if (fontSize > 13) {
      flushPara();
      html += `<h3>${applyFormat(text)}</h3>\n`;
    } else if (LIST_MARKER_RE.test(text)) {
      flushPara();
      html += `<p>${applyFormat(text)}</p>\n`;
    } else {
      paraBuffer.push(applyFormat(text));
    }
  }

  flushPara();
  if (inTable && tableRows.length > 0) html += buildTable(tableRows);
  return html;
}

function buildTable(rows) {
  if (rows.length === 0) return '';
  const maxCols = Math.max(...rows.map(r => r.length));
  let html = '<table>\n';
  rows.forEach((row, idx) => {
    html += '  <tr>\n';
    for (let c = 0; c < maxCols; c++) {
      const tag = idx === 0 ? 'th' : 'td';
      html += `    <${tag}>${escapeHtml(row[c] || '')}</${tag}>\n`;
    }
    html += '  </tr>\n';
  });
  html += '</table>\n';
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** 텍스트 → 인라인 HTML 변환: \n → <br>, 줄 앞 공백 → &nbsp; */
function textToInlineHtml(text) {
  return escapeHtml(text)
    .replace(/\n( +)/g, (_, sp) => '<br>' + '&nbsp;'.repeat(sp.length))
    .replace(/\n/g, '<br>')
    .replace(/^( +)/, (_, sp) => '&nbsp;'.repeat(sp.length));
}

/**
 * HWP 파일 추출 — OLE2 네이티브 파서 (테이블/줄바꿈 보존)
 * 백엔드 convert-server.py의 parse_hwp5_native()를 JS로 포팅
 */
async function extractHwp(file) {
  const warnings = [];
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // OLE2 시그니처 확인
  if (data[0] === 0xD0 && data[1] === 0xCF && data[2] === 0x11 && data[3] === 0xE0) {
    try {
      const result = parseHwp5Native(data);
      if (result && result.html.trim()) {
        return { html: result.html, text: result.text, warnings: result.warnings };
      }
      warnings.push('OLE2 파서 결과가 비어있습니다. 기본 추출로 전환합니다.');
    } catch (e) {
      warnings.push(`OLE2 파서 오류: ${e.message}. 기본 추출로 전환합니다.`);
    }
  }

  // 폴백: 바이너리 텍스트 스캔
  const text = extractTextSegments(data);
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const html = lines.map(l => `<p>${escapeHtml(l.trim())}</p>`).join('\n');
  warnings.push('HWP 파일에서 제한적으로 텍스트를 추출했습니다. 테이블이 포함된 경우 .docx로 변환 후 업로드를 권장합니다.');
  return { html, text: lines.join('\n'), warnings };
}

// ============================================
// OLE2 Compound Binary Reader (JS 포팅)
// ============================================

const ENDOFCHAIN = 0xFFFFFFFE;
const NOSTREAM = 0xFFFFFFFF;

// HWP record tag IDs
const HWPTAG_PARA_HEADER = 66;
const HWPTAG_PARA_TEXT = 67;
const HWPTAG_CTRL_HEADER = 71;
const HWPTAG_LIST_HEADER = 72;
const HWPTAG_TABLE = 77;

// Control chars consuming 16 bytes in PARA_TEXT
const CTRL_16BYTE = new Set([1,2,3,4,5,6,7,8,9,11,12,14,15,16,17,18,19,20,21,22,23]);

/** DataView 기반 Little-Endian 읽기 헬퍼 */
function readU16(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}
function readU32(data, offset) {
  return (data[offset] | (data[offset+1] << 8) | (data[offset+2] << 16) | (data[offset+3] << 24)) >>> 0;
}

class OLE2Reader {
  constructor(data) {
    this.data = data;
    this.sectorShift = readU16(data, 30);
    this.sectorSize = 1 << this.sectorShift;
    this.miniSectorShift = readU16(data, 32);
    this.miniSectorSize = 1 << this.miniSectorShift;
    this.numFatSectors = readU32(data, 44);
    this.firstDirSid = readU32(data, 48);
    this.miniStreamCutoff = readU32(data, 56);
    this.firstMinifatSid = readU32(data, 60);
    this.numMinifatSectors = readU32(data, 64);
    this.firstDifatSid = readU32(data, 68);
    this.numDifatSectors = readU32(data, 72);

    this.fat = this._buildFat();
    this.entries = this._readDirectory();
    this._miniFat = null;
    this._miniStream = null;
  }

  _sectorData(sid) {
    const offset = (sid + 1) * this.sectorSize;
    return this.data.subarray(offset, offset + this.sectorSize);
  }

  _getChain(startSid) {
    const chain = [];
    let sid = startSid;
    const seen = new Set();
    while (sid < ENDOFCHAIN && !seen.has(sid)) {
      seen.add(sid);
      chain.push(sid);
      if (sid >= this.fat.length) break;
      sid = this.fat[sid];
    }
    return chain;
  }

  _buildFat() {
    // DIFAT: first 109 entries from header (offset 76)
    const difat = [];
    for (let i = 0; i < 109; i++) {
      const s = readU32(this.data, 76 + i * 4);
      if (s < ENDOFCHAIN) difat.push(s);
    }
    // Additional DIFAT sectors
    if (this.numDifatSectors > 0 && this.firstDifatSid < ENDOFCHAIN) {
      let sid = this.firstDifatSid;
      const ipp = this.sectorSize / 4 - 1;
      const seen = new Set();
      for (let n = 0; n < this.numDifatSectors; n++) {
        if (sid >= ENDOFCHAIN || seen.has(sid)) break;
        seen.add(sid);
        const sec = this._sectorData(sid);
        for (let j = 0; j < ipp; j++) {
          const s = readU32(sec, j * 4);
          if (s < ENDOFCHAIN) difat.push(s);
        }
        sid = readU32(sec, ipp * 4);
      }
    }
    // Read FAT sectors
    const fat = [];
    const epp = this.sectorSize / 4;
    for (let k = 0; k < this.numFatSectors && k < difat.length; k++) {
      const sec = this._sectorData(difat[k]);
      for (let j = 0; j < epp; j++) {
        fat.push(readU32(sec, j * 4));
      }
    }
    return fat;
  }

  _readDirectory() {
    const chain = this._getChain(this.firstDirSid);
    const chunks = chain.map(sid => this._sectorData(sid));
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const raw = new Uint8Array(totalLen);
    let off = 0;
    for (const chunk of chunks) {
      raw.set(chunk, off);
      off += chunk.length;
    }
    const entries = [];
    for (let i = 0; i + 128 <= raw.length; i += 128) {
      const entry = raw.subarray(i, i + 128);
      const nameSize = readU16(entry, 64);
      if (nameSize <= 0 || nameSize > 64) { entries.push(null); continue; }
      let name = '';
      try {
        name = new TextDecoder('utf-16le').decode(entry.subarray(0, nameSize - 2));
      } catch { name = ''; }
      entries.push({
        name,
        type: entry[66],
        child: readU32(entry, 76),
        left: readU32(entry, 68),
        right: readU32(entry, 72),
        startSid: readU32(entry, 116),
        size: readU32(entry, 120),
      });
    }
    return entries;
  }

  _ensureMini() {
    if (this._miniFat !== null) return;
    this._miniFat = [];
    if (this.firstMinifatSid < ENDOFCHAIN) {
      const chain = this._getChain(this.firstMinifatSid);
      const epp = this.sectorSize / 4;
      for (const sid of chain) {
        const sec = this._sectorData(sid);
        for (let j = 0; j < epp; j++) this._miniFat.push(readU32(sec, j * 4));
      }
    }
    // Mini stream = root entry's data chain
    const root = this.entries[0];
    if (root && root.startSid < ENDOFCHAIN) {
      const chain = this._getChain(root.startSid);
      const chunks = chain.map(sid => this._sectorData(sid));
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const ms = new Uint8Array(totalLen);
      let off = 0;
      for (const chunk of chunks) { ms.set(chunk, off); off += chunk.length; }
      this._miniStream = ms;
    } else {
      this._miniStream = new Uint8Array(0);
    }
  }

  _getMiniChain(startSid) {
    const chain = [];
    let sid = startSid;
    const seen = new Set();
    while (sid < ENDOFCHAIN && !seen.has(sid)) {
      seen.add(sid);
      chain.push(sid);
      if (sid >= this._miniFat.length) break;
      sid = this._miniFat[sid];
    }
    return chain;
  }

  readStream(entry) {
    if (!entry || entry.type !== 2) return new Uint8Array(0);
    const size = entry.size;
    if (size === 0) return new Uint8Array(0);

    if (size < this.miniStreamCutoff) {
      this._ensureMini();
      const chain = this._getMiniChain(entry.startSid);
      const chunks = chain.map(msid => {
        const off = msid * this.miniSectorSize;
        return this._miniStream.subarray(off, off + this.miniSectorSize);
      });
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const raw = new Uint8Array(Math.min(totalLen, size));
      let off = 0;
      for (const chunk of chunks) {
        const len = Math.min(chunk.length, size - off);
        raw.set(chunk.subarray(0, len), off);
        off += len;
        if (off >= size) break;
      }
      return raw;
    } else {
      const chain = this._getChain(entry.startSid);
      const chunks = chain.map(sid => this._sectorData(sid));
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const raw = new Uint8Array(Math.min(totalLen, size));
      let off = 0;
      for (const chunk of chunks) {
        const len = Math.min(chunk.length, size - off);
        raw.set(chunk.subarray(0, len), off);
        off += len;
        if (off >= size) break;
      }
      return raw;
    }
  }

  /** 디렉토리 트리 순회 (Red-Black Tree 순서) */
  *_walkTree(did, parentPath = '') {
    if (did === NOSTREAM || did >= this.entries.length) return;
    const entry = this.entries[did];
    if (!entry) return;
    yield* this._walkTree(entry.left, parentPath);
    const fullPath = parentPath ? parentPath + '/' + entry.name : entry.name;
    yield [fullPath, entry];
    if ((entry.type === 1 || entry.type === 5) && entry.child !== NOSTREAM) {
      yield* this._walkTree(entry.child, fullPath);
    }
    yield* this._walkTree(entry.right, parentPath);
  }

  listEntries() {
    const root = this.entries[0];
    if (!root) return [];
    const result = [['Root Entry', root]];
    if (root.child !== NOSTREAM) {
      for (const item of this._walkTree(root.child, 'Root Entry')) {
        result.push(item);
      }
    }
    return result;
  }
}

// ============================================
// HWP 5.0 Record Parser + Table/Text Extractor
// ============================================

function parseHwpRecords(streamData) {
  const records = [];
  let pos = 0;
  while (pos + 4 <= streamData.length) {
    const header = readU32(streamData, pos);
    const tagId = header & 0x3FF;
    const level = (header >> 10) & 0x3FF;
    let size = (header >> 20) & 0xFFF;
    pos += 4;
    if (size === 0xFFF && pos + 4 <= streamData.length) {
      size = readU32(streamData, pos);
      pos += 4;
    }
    const payload = streamData.subarray(pos, pos + size);
    pos += size;
    records.push({ tag: tagId, level, payload });
  }
  return records;
}

function extractTextFromPara(payload) {
  const parts = [];
  let pos = 0;
  while (pos + 2 <= payload.length) {
    const ch = readU16(payload, pos);
    if (ch >= 32) {
      parts.push(String.fromCharCode(ch));
      pos += 2;
    } else if (ch === 13 || ch === 10) {
      parts.push('\n');
      pos += 2;
    } else if (ch === 30) {
      parts.push('-');
      pos += 2;
    } else if (CTRL_16BYTE.has(ch)) {
      pos += 16;
      if (pos > payload.length) break;
    } else {
      pos += 2;
    }
  }
  return parts.join('');
}

function hwpExtractContent(records) {
  const allParagraphs = [];
  const tableStack = []; // 중첩 테이블 컨텍스트 스택
  let currentTable = null;
  let currentCell = null;
  let tableCells = [];
  let tableStartLevel = -1;
  let awaitingParaText = false;

  function buildTablePara() {
    if (!tableCells.length) return null;
    let rows = currentTable ? currentTable.rows : 0;
    let cols = currentTable ? currentTable.cols : 0;
    let maxRow = 0, maxCol = 0;
    for (const c of tableCells) {
      maxRow = Math.max(maxRow, c.row + c.rowspan);
      maxCol = Math.max(maxCol, c.col + c.colspan);
    }
    rows = Math.max(rows, maxRow);
    cols = Math.max(cols, maxCol);
    return { type: 'table', rows, cols, cells: tableCells };
  }

  /** 중첩 테이블을 부모 셀로 병합하며 스택 pop */
  function popNestedTable() {
    const nestedPara = buildTablePara();
    const parent = tableStack.pop();
    currentTable = parent.table;
    tableCells = parent.cells;
    currentCell = parent.cell;
    tableStartLevel = parent.startLevel;
    // 중첩 테이블 HTML을 부모 셀에 추가
    if (parent.cell && nestedPara) {
      parent.cell.nestedTables = parent.cell.nestedTables || [];
      parent.cell.nestedTables.push(nestedPara);
    } else if (nestedPara) {
      allParagraphs.push(nestedPara);
    }
  }

  for (const rec of records) {
    // 레벨 기반 중첩 테이블 자동 pop: 현재 셀이 없고 레코드 레벨이 테이블 시작 레벨 이하이면 pop
    while (tableStack.length > 0 && currentCell === null &&
           currentTable && tableCells.length > 0 && rec.level <= tableStartLevel) {
      popNestedTable();
      awaitingParaText = false;
    }

    // 빈 문단 감지: PARA_HEADER로 셀 내 문단 수 정확히 추적
    if (rec.tag === HWPTAG_PARA_HEADER) {
      if (currentCell !== null && awaitingParaText) {
        // 이전 문단이 비어 있음 (PARA_TEXT 없는 문단)
        currentCell.paraCount++;
        if (currentCell.paraCount >= currentCell.paraTarget) {
          currentCell = null;
        }
      }
      awaitingParaText = (currentCell !== null);
    }

    if (rec.tag === HWPTAG_CTRL_HEADER && rec.payload.length >= 4) {
      const b = rec.payload;
      const isTbl = (b[0]===116 && b[1]===98 && b[2]===108 && b[3]===32) ||
                    (b[0]===32 && b[1]===108 && b[2]===98 && b[3]===116);
      if (isTbl) {
        if (currentTable) {
          if (currentCell !== null && awaitingParaText) {
            currentCell.paraCount++;
          }
          // 기존 테이블 내부 → 중첩 테이블: 컨텍스트를 스택에 push
          tableStack.push({ table: currentTable, cells: tableCells, cell: currentCell, startLevel: tableStartLevel });
          tableCells = [];
        }
        currentTable = { rows: 0, cols: 0 };
        tableStartLevel = rec.level;
        currentCell = null;
        awaitingParaText = false;
      }
    } else if (rec.tag === HWPTAG_TABLE && currentTable && rec.payload.length >= 8) {
      currentTable.rows = readU16(rec.payload, 4);
      currentTable.cols = readU16(rec.payload, 6);
    } else if (rec.tag === HWPTAG_LIST_HEADER && currentTable) {
      if (currentCell !== null && awaitingParaText) {
        currentCell.paraCount++;
      }
      currentCell = null;
      awaitingParaText = false;
      const p = rec.payload;
      if (p.length >= 16) {
        const numPara = readU16(p, 0);
        const colAddr = readU16(p, 8);
        const rowAddr = readU16(p, 10);
        const colSpan = readU16(p, 12);
        const rowSpan = readU16(p, 14);
        currentCell = {
          row: rowAddr, col: colAddr,
          rowspan: Math.max(rowSpan, 1), colspan: Math.max(colSpan, 1),
          texts: [], nestedTables: [], paraTarget: numPara, paraCount: 0,
        };
        tableCells.push(currentCell);
      }
    } else if (rec.tag === HWPTAG_PARA_TEXT) {
      awaitingParaText = false;
      const text = extractTextFromPara(rec.payload).replace(/\n+$/, '');
      if (currentCell !== null) {
        if (text.trim()) currentCell.texts.push(text);
        currentCell.paraCount++;
        if (currentCell.paraCount >= currentCell.paraTarget) currentCell = null;
      } else if (currentTable && tableCells.length && tableStack.length > 0) {
        // 중첩 테이블 종료 → pop 후 부모 셀에 텍스트 추가
        popNestedTable();
        if (currentCell !== null) {
          if (text.trim()) currentCell.texts.push(text);
          currentCell.paraCount++;
          if (currentCell.paraCount >= currentCell.paraTarget) currentCell = null;
        } else if (text.trim()) {
          allParagraphs.push({ type: 'text', text });
        }
      } else {
        if (currentTable && tableCells.length) {
          const tablePara = buildTablePara();
          if (tablePara) allParagraphs.push(tablePara);
          tableCells = [];
          currentTable = null;
          currentCell = null;
        }
        if (text.trim()) allParagraphs.push({ type: 'text', text });
      }
    }
  }

  // 마지막 빈 문단 처리
  if (currentCell !== null && awaitingParaText) {
    currentCell.paraCount++;
    if (currentCell.paraCount >= currentCell.paraTarget) {
      currentCell = null;
    }
  }

  // 잔여 중첩 테이블 스택 flush
  while (tableStack.length > 0) popNestedTable();
  if (currentTable && tableCells.length) {
    const tablePara = buildTablePara();
    if (tablePara) allParagraphs.push(tablePara);
  }
  return allParagraphs;
}

function hwpParagraphsToHtml(allParagraphs) {
  const htmlParts = [];
  const textParts = [];

  for (const para of allParagraphs) {
    if (para.type === 'text') {
      const txt = para.text.trim();
      if (txt) {
        textParts.push(txt);
        htmlParts.push(`<p>${textToInlineHtml(txt)}</p>`);
      }
    } else if (para.type === 'table') {
      const occupied = new Set();
      const sortedCells = para.cells.slice().sort((a, b) => a.row - b.row || a.col - b.col);

      htmlParts.push('<table>');
      for (let r = 0; r < para.rows; r++) {
        htmlParts.push('  <tr>');
        for (const cell of sortedCells) {
          if (cell.row !== r) continue;
          const c = cell.col;
          if (occupied.has(`${r},${c}`)) continue;

          const cellText = cell.texts.join('\n');
          textParts.push(cellText);
          const cellTag = r === 0 ? 'th' : 'td';
          let attrs = '';
          const rs = cell.rowspan || 1;
          const cs = cell.colspan || 1;
          if (rs > 1) attrs += ` rowspan="${rs}"`;
          if (cs > 1) attrs += ` colspan="${cs}"`;
          for (let dr = 0; dr < rs; dr++) {
            for (let dc = 0; dc < cs; dc++) {
              occupied.add(`${r + dr},${c + dc}`);
            }
          }
          let cellHtml = escapeHtml(cellText).replace(/\n/g, '<br>');
          // 중첩 테이블이 있으면 셀 내부에 렌더링
          if (cell.nestedTables && cell.nestedTables.length > 0) {
            for (const nested of cell.nestedTables) {
              const { html: nestedHtml } = hwpParagraphsToHtml([nested]);
              cellHtml += nestedHtml;
            }
          }
          htmlParts.push(`    <${cellTag}${attrs}>${cellHtml}</${cellTag}>`);
        }
        htmlParts.push('  </tr>');
      }
      htmlParts.push('</table>');
    }
  }

  return { html: htmlParts.join('\n'), text: textParts.join('\n') };
}

/** HWP 5.0 네이티브 파서 메인 함수 */
function parseHwp5Native(data) {
  const ole = new OLE2Reader(data);

  // FileHeader 확인
  let fhEntry = null;
  for (const [, entry] of ole.listEntries()) {
    if (entry.name.toLowerCase() === 'fileheader') { fhEntry = entry; break; }
  }
  if (!fhEntry) return null;

  const fhData = ole.readStream(fhEntry);
  if (fhData.length < 40) return null;
  // 'HWP Document File' 시그니처 (17 bytes)
  const sig = new TextDecoder('ascii').decode(fhData.subarray(0, 17));
  if (sig !== 'HWP Document File') return null;

  const props = readU32(fhData, 36);
  const compressed = !!(props & 0x01);
  const encrypted = !!(props & 0x02);

  if (encrypted) {
    return {
      html: '<p>암호화된 HWP 파일은 지원하지 않습니다.</p>',
      text: '암호화된 HWP 파일은 지원하지 않습니다.',
      warnings: ['HWP 파일이 암호화되어 있습니다.'],
    };
  }

  // BodyText/Section 스트림 수집
  const sectionEntries = [];
  for (const [path, entry] of ole.listEntries()) {
    if (path.toLowerCase().includes('bodytext') && entry.name.toLowerCase().includes('section')) {
      sectionEntries.push([path, entry]);
    }
  }
  sectionEntries.sort((a, b) => a[0].localeCompare(b[0]));
  if (!sectionEntries.length) return null;

  const allParagraphs = [];
  const warnings = [];

  for (const [secPath, secEntry] of sectionEntries) {
    let raw = ole.readStream(secEntry);
    if (!raw.length) continue;

    // zlib 압축 해제
    if (compressed) {
      try {
        raw = hwpDecompress(raw);
      } catch (e) {
        warnings.push(`${secPath} 압축 해제 실패: ${e.message}`);
        continue;
      }
    }

    const records = parseHwpRecords(raw);
    const paras = hwpExtractContent(records);
    allParagraphs.push(...paras);
  }

  if (!allParagraphs.length) return null;

  const { html, text } = hwpParagraphsToHtml(allParagraphs);
  return { html, text, warnings };
}

/** zlib (deflate) 압축 해제 — DecompressionStream API 동기 폴백 */
function hwpDecompress(data) {
  // HWP는 raw deflate (-15), 일반 zlib, 또는 gzip 래핑을 사용할 수 있음
  // 브라우저에서는 DecompressionStream이 비동기이므로 수동 inflate 시도

  // 방법 1: pako 라이브러리 (있으면)
  if (typeof pako !== 'undefined') {
    try { return new Uint8Array(pako.inflate(data)); } catch {}
    try { return new Uint8Array(pako.inflateRaw(data)); } catch {}
  }

  // 방법 2: fflate 라이브러리 (있으면)
  if (typeof fflate !== 'undefined') {
    try { return fflate.decompressSync(data); } catch {}
    try { return fflate.inflateSync(data); } catch {}
  }

  // 방법 3: 수동 inflate (간이 구현)
  // HWP raw deflate를 처리하기 위한 최소 inflate
  return manualInflate(data);
}

/** 간이 inflate — pako/fflate가 없으면 실패 */
function manualInflate(/* data */) {
  throw new Error('zlib 압축 해제 라이브러리가 필요합니다 (pako)');
}

/** 바이너리에서 텍스트 세그먼트 스캔 (최후 폴백) */
function extractTextSegments(uint8) {
  const segments = [];
  let i = 0;
  while (i < uint8.length - 1) {
    const lo = uint8[i];
    const hi = uint8[i + 1];
    const cp = (hi << 8) | lo;
    if ((cp >= 0xAC00 && cp <= 0xD7AF) || (cp >= 0x0020 && cp <= 0x007E)) {
      let end = i + 2;
      while (end < uint8.length - 1) {
        const ncp = (uint8[end + 1] << 8) | uint8[end];
        if ((ncp >= 0xAC00 && ncp <= 0xD7AF) || (ncp >= 0x0020 && ncp <= 0x007E) ||
            ncp === 0x000A || ncp === 0x000D || ncp === 0x0009) {
          end += 2;
        } else break;
      }
      if (end - i >= 8) {
        const segment = new TextDecoder('utf-16le').decode(uint8.slice(i, end));
        if (segment.trim().length > 2) segments.push(segment);
      }
      i = end;
    } else {
      i += 2;
    }
  }
  return segments.join('\n');
}

/**
 * HWPX 파일 추출 (ZIP 기반 HWP 형식)
 * HWPX는 ZIP 아카이브 안에 XML 파일로 구성됨
 */
async function extractHwpx(file) {
  const warnings = [];
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // ZIP 시그니처 확인 (PK = 0x50 0x4B)
  if (uint8[0] !== 0x50 || uint8[1] !== 0x4B) {
    warnings.push('HWPX 파일이 아닌 것 같습니다. HWP 형식으로 시도합니다.');
    return extractHwp(file);
  }

  // JSZip이 있으면 ZIP 해제 + XML 파싱
  if (typeof JSZip !== 'undefined') {
    try {
      return await extractHwpxWithJSZip(arrayBuffer, warnings);
    } catch (e) {
      warnings.push(`JSZip 파싱 실패: ${e.message}. 기본 추출로 전환합니다.`);
    }
  }

  // JSZip 없이 regex 폴백
  return extractHwpxRegexFallback(uint8, warnings);
}

/** JSZip + DOMParser로 HWPX 구조 파싱 (테이블 보존) */
async function extractHwpxWithJSZip(arrayBuffer, warnings) {
  const zip = await JSZip.loadAsync(arrayBuffer);

  // section XML 파일 찾기
  const sectionFiles = [];
  zip.forEach((path, entry) => {
    if (path.toLowerCase().includes('section') && path.endsWith('.xml')) {
      sectionFiles.push({ path, entry });
    }
  });
  sectionFiles.sort((a, b) => a.path.localeCompare(b.path));

  if (sectionFiles.length === 0) {
    zip.forEach((path, entry) => {
      if (path.endsWith('.xml') && !path.toLowerCase().includes('meta') && sectionFiles.length === 0) {
        sectionFiles.push({ path, entry });
      }
    });
  }

  const htmlParts = [];
  const textParts = [];

  for (const { entry } of sectionFiles) {
    const xmlString = await entry.async('string');
    const { html, text } = parseHwpxSectionXml(xmlString);
    if (html) htmlParts.push(html);
    if (text) textParts.push(text);
  }

  const html = htmlParts.join('\n');
  const text = textParts.join('\n');

  if (html.trim()) {
    return { html, text, warnings };
  }

  warnings.push('HWPX XML에서 구조를 추출하지 못했습니다.');
  throw new Error('HWPX 구조 추출 실패');
}

/** DOMParser로 HWPX section XML 파싱 */
function parseHwpxSectionXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const htmlParts = [];
  const textParts = [];
  const root = doc.documentElement;

  for (const child of root.children) {
    const localName = child.localName;

    if (localName === 'tbl') {
      const { html, text } = parseHwpxTable(child);
      htmlParts.push(html);
      textParts.push(text);
    } else if (localName === 'p') {
      const pText = extractTextFromHwpxElement(child);
      if (pText.trim()) {
        htmlParts.push(`<p>${textToInlineHtml(pText)}</p>`);
        textParts.push(pText);
      }
    }
  }

  return { html: htmlParts.join('\n'), text: textParts.join('\n') };
}

/** HWPX tbl 요소를 HTML 테이블로 변환 */
function parseHwpxTable(tblElem) {
  const htmlParts = ['<table>'];
  const textParts = [];
  let rowIdx = 0;

  for (const trElem of tblElem.children) {
    if (trElem.localName !== 'tr') continue;

    htmlParts.push('  <tr>');
    for (const tcElem of trElem.children) {
      if (tcElem.localName !== 'tc') continue;

      // cellSpan 추출
      let colspan = 1, rowspan = 1;
      const cellSpanElem = Array.from(tcElem.children).find(e => e.localName === 'cellSpan');
      if (cellSpanElem) {
        colspan = parseInt(cellSpanElem.getAttribute('colSpan') || '1', 10);
        rowspan = parseInt(cellSpanElem.getAttribute('rowSpan') || '1', 10);
      }

      // 셀 내용: 직계 자식만 순회 (중첩 테이블 내부 p 중복 방지)
      const paras = [];
      const nestedTableHtmls = [];
      for (const child of tcElem.children) {
        if (child.localName === 'p') {
          paras.push(extractTextFromHwpxElement(child));
        } else if (child.localName === 'tbl') {
          const nested = parseHwpxTable(child);
          if (nested.html) nestedTableHtmls.push(nested.html);
          if (nested.text) textParts.push(nested.text);
        }
      }
      while (paras.length > 0 && !paras[paras.length - 1].trim()) paras.pop();

      const cellText = paras.join('\n');
      textParts.push(cellText);

      const tag = rowIdx === 0 ? 'th' : 'td';
      let cellHtml = escapeHtml(cellText).replace(/\n/g, '<br>');
      if (nestedTableHtmls.length > 0) cellHtml += nestedTableHtmls.join('');
      let attrs = '';
      if (colspan > 1) attrs += ` colspan="${colspan}"`;
      if (rowspan > 1) attrs += ` rowspan="${rowspan}"`;
      htmlParts.push(`    <${tag}${attrs}>${cellHtml}</${tag}>`);
    }
    htmlParts.push('  </tr>');
    rowIdx++;
  }

  htmlParts.push('</table>');
  return { html: htmlParts.join('\n'), text: textParts.join('\n') };
}

/** HWPX 요소 내부의 모든 't' 텍스트 수집 */
function extractTextFromHwpxElement(elem) {
  const tElems = elem.getElementsByTagNameNS('*', 't');
  const texts = [];
  for (const t of tElems) {
    if (t.textContent) texts.push(t.textContent);
  }
  return texts.join('');
}

/** JSZip 없이 regex 기반 HWPX 텍스트 추출 (폴백) */
function extractHwpxRegexFallback(uint8, warnings) {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(uint8);
  const textMatches = [];

  const hpTagPattern = /<hp:t[^>]*>([^<]+)<\/hp:t>/g;
  let match;
  while ((match = hpTagPattern.exec(text)) !== null) {
    const t = match[1].trim();
    if (t.length > 0) textMatches.push(t);
  }

  if (textMatches.length === 0) {
    const genericPattern = /<(?:t|text|val)[^>]*>([^<]+)<\/(?:t|text|val)>/g;
    while ((match = genericPattern.exec(text)) !== null) {
      const t = match[1].trim();
      if (t.length > 1) textMatches.push(t);
    }
  }

  if (textMatches.length > 0) {
    const html = textMatches.map(t => `<p>${escapeHtml(t)}</p>`).join('\n');
    warnings.push('HWPX 파일의 서식(볼드, 표 등)은 보존되지 않을 수 있습니다.');
    return { html, text: textMatches.join('\n'), warnings };
  }

  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\x20-\x7E\uAC00-\uD7AF\u3131-\u318E\n\r\t.,;:!?\-()[\]{}'"\/\\@#$%&*+=<>~`]/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim();

  const lines = cleaned.split('\n').filter(l => l.trim().length > 2);
  if (lines.length > 0) {
    const html = lines.map(l => `<p>${escapeHtml(l.trim())}</p>`).join('\n');
    warnings.push('HWPX 파일에서 제한적으로 텍스트를 추출했습니다. .docx 변환을 권장합니다.');
    return { html, text: lines.join('\n'), warnings };
  }

  warnings.push('HWPX 파일에서 텍스트를 추출하지 못했습니다. .docx로 변환 후 다시 시도해주세요.');
  return { html: '<p>HWPX 파일 추출 실패</p>', text: '', warnings };
}

export function getSupportedExtensions() {
  return ['hwp', 'hwpx', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
}

export function getFileTypeLabel(ext) {
  const labels = {
    hwp: 'HWP',
    hwpx: 'HWPX',
    pdf: 'PDF',
    doc: 'Word',
    docx: 'Word',
    xls: 'Excel',
    xlsx: 'Excel'
  };
  return labels[ext] || ext.toUpperCase();
}

export function getFileTypeColor(ext) {
  const colors = {
    hwp: '#2b7ce9',
    hwpx: '#2b7ce9',
    pdf: '#e74c3c',
    doc: '#2b579a',
    docx: '#2b579a',
    xls: '#217346',
    xlsx: '#217346'
  };
  return colors[ext] || '#888';
}
