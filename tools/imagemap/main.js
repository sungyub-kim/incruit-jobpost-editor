/**
 * 이미지맵 생성기 (Image Map Generator)
 * 사각형(rect) 영역을 드래그로 그려 HTML <map> 코드를 생성합니다.
 * 여러 이미지를 슬롯으로 관리합니다.
 */

const state = {
  slots: [],          // [{ id, imageUrl, imageName, mapName, areas, nextAreaId }]
  activeSlotId: null,
  nextSlotId: 1,
  isDrawing: false,
  drawStart: null,
  selectedAreaId: null,
  exportExternal: false,
  interactionMode: null, // 'move' | 'resize'
  moveStart: null,       // { mouseX, mouseY, ax1, ay1, ax2, ay2 }
  resizeHandle: null,    // 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'
};

// ─── DOM refs ───────────────────────────────────────────
const $ = id => document.getElementById(id);

const elImageInput    = $('image-input');
const elDropZone      = $('drop-zone');
const elImgWrapper    = $('img-wrapper');
const elPreviewImg    = $('preview-img');
const elOverlay       = $('overlay');
const elAreaList      = $('area-list');
const elAreaCount     = $('area-count');
const elMapName       = $('map-name');
const elDefaultTarget = $('default-target');
const elCodeDisplay   = $('code-display');
const elCopyBtn       = $('copy-btn');
const elUndoBtn       = $('undo-btn');
const elResetBtn      = $('reset-btn');
const elFileLabel     = $('file-name-display');
const elCanvasHint    = $('canvas-hint');
const elUrlInput      = $('image-url-input');
const elUrlBtn        = $('image-url-btn');
const elUrlError      = $('url-error');
const elExportCheck   = $('export-external');
const elDownloadBtn   = $('download-btn');

// ─── 슬롯 헬퍼 ──────────────────────────────────────────
function getActive() { return state.slots.find(s => s.id === state.activeSlotId) || null; }

function addSlot(imageUrl, imageName) {
  const id = state.nextSlotId++;
  const mapIdx = state.slots.length + 1;
  const slot = { id, imageUrl, imageName, mapName: 'map' + mapIdx, areas: [], nextAreaId: 1, naturalWidth: 0, naturalHeight: 0 };
  state.slots.push(slot);
  activateSlot(id);
}

function deleteSlot(id) {
  state.slots = state.slots.filter(s => s.id !== id);

  if (state.activeSlotId === id) {
    const next = state.slots[state.slots.length - 1];
    if (next) {
      activateSlot(next.id);
    } else {
      state.activeSlotId = null;
      elPreviewImg.src = '';
      elImgWrapper.style.display = 'none';
      elDropZone.style.display = '';
      elFileLabel.textContent = '파일을 선택하세요';
      elCanvasHint.textContent = '이미지를 업로드하면 드래그로 영역을 그릴 수 있습니다';
      elMapName.value = 'map1';
      renderAll();
    }
  } else {
    renderSlotList();
    generateCode();
  }
}

function activateSlot(id) {
  state.activeSlotId = id;
  state.selectedAreaId = null;
  state.isDrawing = false;
  state.drawStart = null;

  const slot = getActive();
  if (!slot) { renderSlotList(); return; }

  elMapName.value = slot.mapName;

  function onSlotReady() {
    if (elPreviewImg.naturalWidth > 0) {
      slot.naturalWidth = elPreviewImg.naturalWidth;
      slot.naturalHeight = elPreviewImg.naturalHeight;
    }
    elDropZone.style.display = 'none';
    elImgWrapper.style.display = 'inline-block';
    elCanvasHint.textContent = '드래그하여 클릭 영역을 그리세요. ESC로 선택 해제.';
    renderAll();
  }

  elPreviewImg.onload = onSlotReady;
  elPreviewImg.onerror = () => {};
  elPreviewImg.src = slot.imageUrl;

  // 이미 캐시된 경우 onload가 안 발생하므로 즉시 처리
  if (elPreviewImg.complete && elPreviewImg.naturalWidth > 0) onSlotReady();

  renderSlotList();
}

// ─── 슬롯 목록 렌더링 ────────────────────────────────────
function renderSlotList() {
  const slotGroup = $('slot-group');
  const slotList  = $('slot-list');
  const slotCount = $('slot-count');

  if (state.slots.length === 0) {
    slotGroup.style.display = 'none';
    return;
  }
  slotGroup.style.display = '';
  slotCount.textContent = state.slots.length;
  slotList.innerHTML = '';

  state.slots.forEach((slot, idx) => {
    const item = document.createElement('div');
    item.className = 'slot-item' + (slot.id === state.activeSlotId ? ' active' : '');
    item.innerHTML = `
      <img class="slot-thumb" src="${slot.imageUrl}" alt="">
      <div class="slot-info">
        <span class="slot-name">${escHtml(slot.imageName || ('image' + (idx + 1)))}</span>
        <span class="slot-map">${escHtml(slot.mapName)}</span>
      </div>
      <button class="slot-delete" data-id="${slot.id}" title="삭제">✕</button>
    `;
    item.addEventListener('click', e => {
      if (e.target.classList.contains('slot-delete')) return;
      activateSlot(slot.id);
    });
    item.querySelector('.slot-delete').addEventListener('click', e => {
      e.stopPropagation();
      deleteSlot(parseInt(e.target.dataset.id));
    });
    slotList.appendChild(item);
  });
}

// 이미지 width가 maxWidth보다 크면 canvas로 리사이즈 후 새 dataURL 반환.
// 그 외(이하/CORS 실패/오류)는 원본 반환.
function resizeIfLarge(imageUrl, maxWidth = 900) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!img.naturalWidth || img.naturalWidth <= maxWidth) { resolve(imageUrl); return; }
      const scale = maxWidth / img.naturalWidth;
      const newW = maxWidth;
      const newH = Math.round(img.naturalHeight * scale);
      try {
        const c = document.createElement('canvas');
        c.width = newW;
        c.height = newH;
        c.getContext('2d').drawImage(img, 0, 0, newW, newH);
        // PNG 투명도 보존. (JPEG로 바꾸면 더 작지만 품질/투명 손실)
        resolve(c.toDataURL('image/png'));
      } catch {
        // CORS tainted canvas — 원본 유지
        resolve(imageUrl);
      }
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}

// ─── 이미지 로드 (파일) ─────────────────────────────────
function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const imageName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'image';
  elUrlInput.value = '';
  elUrlError.style.display = 'none';
  elFileLabel.textContent = file.name;

  // data URL로 변환 (blob: URL은 다운로드 시 깨짐) + 900px 초과 시 리사이즈
  const reader = new FileReader();
  reader.onload = async (e) => {
    const resized = await resizeIfLarge(e.target.result, 900);
    addSlot(resized, imageName);
  };
  reader.readAsDataURL(file);
}

// ─── 이미지 로드 (URL) ──────────────────────────────────
function loadImageFromUrl(url) {
  url = url.trim();
  if (!url) return;
  elUrlError.style.display = 'none';

  const pathname  = url.split('?')[0];
  const basename  = pathname.split('/').pop() || 'image';
  const imageName = basename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'image';

  const testImg = new Image();
  testImg.crossOrigin = 'anonymous';
  testImg.onload = async () => {
    elUrlError.style.display = 'none';
    // 900px 초과면 dataURL로 리사이즈(CORS 허용 시), 아니면 원본 URL 유지
    const resized = await resizeIfLarge(url, 900);
    addSlot(resized, imageName);
    elUrlInput.value = '';
  };
  testImg.onerror = () => {
    elUrlError.style.display = 'block';
  };
  testImg.src = url;
}

// ─── 좌표 변환 ───────────────────────────────────────────
function getImgCoords(e) {
  const rect   = elPreviewImg.getBoundingClientRect();
  const scaleX = elPreviewImg.naturalWidth  / elPreviewImg.clientWidth;
  const scaleY = elPreviewImg.naturalHeight / elPreviewImg.clientHeight;
  return {
    x: Math.round(Math.max(0, Math.min((e.clientX - rect.left) * scaleX, elPreviewImg.naturalWidth))),
    y: Math.round(Math.max(0, Math.min((e.clientY - rect.top)  * scaleY, elPreviewImg.naturalHeight))),
  };
}

function toPct(px, dim) { return (px / dim * 100).toFixed(4) + '%'; }

// ─── 그리기 이벤트 ───────────────────────────────────────
elImgWrapper.addEventListener('mousedown', e => {
  if (e.button !== 0 || !getActive()) return;
  if (state.interactionMode) return; // 이동/리사이즈 중이면 무시
  e.preventDefault();
  state.isDrawing = true;
  state.drawStart = getImgCoords(e);
  state.selectedAreaId = null;

  let dr = $('drawing-rect');
  if (!dr) {
    dr = document.createElement('div');
    dr.id = 'drawing-rect';
    elOverlay.appendChild(dr);
  }
  dr.style.display = 'block';
  updateDrawingRect(state.drawStart, state.drawStart);
  renderOverlay();
});

document.addEventListener('mousemove', e => {
  if (state.isDrawing && state.drawStart) {
    updateDrawingRect(state.drawStart, getImgCoords(e));
    return;
  }

  if ((state.interactionMode === 'move' || state.interactionMode === 'resize') && state.moveStart) {
    const slot = getActive();
    const area = slot?.areas.find(a => a.id === state.selectedAreaId);
    if (!area) return;

    const scaleX = elPreviewImg.naturalWidth  / elPreviewImg.clientWidth;
    const scaleY = elPreviewImg.naturalHeight / elPreviewImg.clientHeight;
    const dx = Math.round((e.clientX - state.moveStart.mouseX) * scaleX);
    const dy = Math.round((e.clientY - state.moveStart.mouseY) * scaleY);
    const imgW = elPreviewImg.naturalWidth;
    const imgH = elPreviewImg.naturalHeight;
    const { ax1, ay1, ax2, ay2 } = state.moveStart;

    if (state.interactionMode === 'move') {
      const w = ax2 - ax1, h = ay2 - ay1;
      const nx1 = Math.max(0, Math.min(ax1 + dx, imgW - w));
      const ny1 = Math.max(0, Math.min(ay1 + dy, imgH - h));
      area.x1 = nx1; area.y1 = ny1;
      area.x2 = nx1 + w; area.y2 = ny1 + h;
    } else {
      const dir = state.resizeHandle;
      let nx1 = ax1, ny1 = ay1, nx2 = ax2, ny2 = ay2;
      if (dir.includes('w')) nx1 = Math.max(0,    Math.min(ax1 + dx, ax2 - 5));
      if (dir.includes('e')) nx2 = Math.min(imgW, Math.max(ax2 + dx, ax1 + 5));
      if (dir.includes('n')) ny1 = Math.max(0,    Math.min(ay1 + dy, ay2 - 5));
      if (dir.includes('s')) ny2 = Math.min(imgH, Math.max(ay2 + dy, ay1 + 5));
      area.x1 = nx1; area.y1 = ny1;
      area.x2 = nx2; area.y2 = ny2;
    }
    renderOverlay();
    generateCode();
  }
});

document.addEventListener('mouseup', e => {
  if (state.interactionMode === 'move' || state.interactionMode === 'resize') {
    state.interactionMode = null;
    state.moveStart = null;
    state.resizeHandle = null;
    renderAll();
    return;
  }

  if (!state.isDrawing || !state.drawStart) return;
  state.isDrawing = false;

  const dr = $('drawing-rect');
  if (dr) dr.style.display = 'none';

  const slot = getActive();
  if (!slot) { state.drawStart = null; return; }

  const end = getImgCoords(e);
  const x1 = Math.min(state.drawStart.x, end.x);
  const y1 = Math.min(state.drawStart.y, end.y);
  const x2 = Math.max(state.drawStart.x, end.x);
  const y2 = Math.max(state.drawStart.y, end.y);

  if ((x2 - x1) < 5 || (y2 - y1) < 5) { state.drawStart = null; return; }

  const area = {
    id: slot.nextAreaId++,
    x1, y1, x2, y2,
    href: '',
    alt: '',
    target: elDefaultTarget.value,
  };
  slot.areas.push(area);
  state.selectedAreaId = area.id;
  state.drawStart = null;
  renderAll();
});

function updateDrawingRect(start, cur) {
  const nw = elPreviewImg.naturalWidth;
  const nh = elPreviewImg.naturalHeight;
  const dr = $('drawing-rect');
  if (!dr) return;
  const lx = Math.min(start.x, cur.x), ly = Math.min(start.y, cur.y);
  const rx = Math.max(start.x, cur.x), ry = Math.max(start.y, cur.y);
  dr.style.left   = toPct(lx, nw);
  dr.style.top    = toPct(ly, nh);
  dr.style.width  = toPct(rx - lx, nw);
  dr.style.height = toPct(ry - ly, nh);
}

// ─── 키보드 ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    state.selectedAreaId = null;
    renderOverlay();
    renderAreaList();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    const slot = getActive();
    if (slot && state.selectedAreaId !== null) {
      slot.areas = slot.areas.filter(a => a.id !== state.selectedAreaId);
      state.selectedAreaId = null;
      renderAll();
    }
  }
});

// ─── 오버레이 렌더링 ─────────────────────────────────────
function renderOverlay() {
  const dr = $('drawing-rect');
  elOverlay.innerHTML = '';
  if (dr) elOverlay.appendChild(dr);

  const slot = getActive();
  if (!slot) return;

  const nw = elPreviewImg.naturalWidth;
  const nh = elPreviewImg.naturalHeight;

  slot.areas.forEach((a, idx) => {
    const isSelected = a.id === state.selectedAreaId;
    const div = document.createElement('div');
    div.className = 'area-rect' + (isSelected ? ' selected' : '');
    div.style.left   = toPct(a.x1, nw);
    div.style.top    = toPct(a.y1, nh);
    div.style.width  = toPct(a.x2 - a.x1, nw);
    div.style.height = toPct(a.y2 - a.y1, nh);

    const label = document.createElement('div');
    label.className = 'rect-label';
    label.textContent = idx + 1;
    div.appendChild(label);

    // 클릭/드래그 → 선택 + 이동
    div.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      state.selectedAreaId = a.id;
      state.interactionMode = 'move';
      state.moveStart = { mouseX: e.clientX, mouseY: e.clientY, ax1: a.x1, ay1: a.y1, ax2: a.x2, ay2: a.y2 };
      renderOverlay();
      renderAreaList();
    });

    // 선택된 영역에 리사이즈 핸들 추가
    if (isSelected) {
      ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
        const handle = document.createElement('div');
        handle.className = `resize-handle handle-${dir}`;
        handle.addEventListener('mousedown', e => {
          e.stopPropagation();
          e.preventDefault();
          state.interactionMode = 'resize';
          state.resizeHandle = dir;
          state.moveStart = { mouseX: e.clientX, mouseY: e.clientY, ax1: a.x1, ay1: a.y1, ax2: a.x2, ay2: a.y2 };
        });
        div.appendChild(handle);
      });
    }

    elOverlay.appendChild(div);
  });
}

// ─── 영역 목록 렌더링 ────────────────────────────────────
function renderAreaList() {
  const slot  = getActive();
  const areas = slot ? slot.areas : [];
  elAreaCount.textContent = areas.length;
  elUndoBtn.disabled = areas.length === 0;

  if (areas.length === 0) {
    elAreaList.innerHTML = '<p class="area-empty">이미지 위에서 드래그하여<br>클릭 영역을 추가하세요</p>';
    return;
  }

  elAreaList.innerHTML = '';
  areas.forEach((a, idx) => {
    const item = document.createElement('div');
    item.className = 'area-item' + (a.id === state.selectedAreaId ? ' selected' : '');
    item.innerHTML = `
      <div class="area-item-header">
        <span class="area-badge">${idx + 1}</span>
        <span class="area-coords">${a.x1},${a.y1} → ${a.x2},${a.y2}</span>
        <button class="area-delete" data-id="${a.id}" title="영역 삭제">✕</button>
      </div>
      <input class="area-url-input" type="text" placeholder="https://..." value="${escHtml(a.href)}" data-id="${a.id}" data-field="href">
      <input class="area-url-input" type="text" placeholder="alt 텍스트 (선택)" value="${escHtml(a.alt)}" data-id="${a.id}" data-field="alt" style="margin-bottom:0;">
    `;

    item.addEventListener('click', e => {
      if (e.target.classList.contains('area-delete') || e.target.classList.contains('area-url-input')) return;
      state.selectedAreaId = a.id;
      renderOverlay();
      renderAreaList();
    });

    item.querySelectorAll('.area-url-input').forEach(input => {
      input.addEventListener('input', e => {
        const found = slot.areas.find(x => x.id === parseInt(e.target.dataset.id));
        if (found) { found[e.target.dataset.field] = e.target.value; generateCode(); }
      });
      input.addEventListener('click', e => e.stopPropagation());
    });

    item.querySelector('.area-delete').addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      slot.areas = slot.areas.filter(x => x.id !== id);
      if (state.selectedAreaId === id) state.selectedAreaId = null;
      renderAll();
    });

    elAreaList.appendChild(item);
  });

  const sel = elAreaList.querySelector('.area-item.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

// ─── HTML 코드 생성 ──────────────────────────────────────
function getOutputMode() {
  return document.querySelector('input[name="output-mode"]:checked')?.value || 'imagemap';
}

function buildCodeString() {
  if (state.slots.length === 0) return null;
  return getOutputMode() === 'intro' ? buildIntroCodeString() : buildImageMapCodeString();
}

function buildImageMapCodeString() {
  const cpDisplay = state.exportExternal ? 'display:block' : 'display:none';

  return state.slots.map((slot, idx) => {
    const mapName = (slot.mapName || ('map' + (idx + 1))).replace(/[^a-zA-Z0-9_-]/g, '_');
    const areaLines = slot.areas.map(a => {
      const coords = `${a.x1},${a.y1},${a.x2},${a.y2}`;
      const href   = a.href   ? ` href="${escAttr(a.href)}"` : ' href=""';
      const alt    = a.alt    ? ` alt="${escAttr(a.alt)}"` : ' alt=""';
      const target = a.target ? ` target="${a.target}"` : '';
      return `  <area shape="rect" coords="${coords}"${href}${alt}${target}>`;
    }).join('\n');
    const mapTag = slot.areas.length > 0
      ? `\n<map name="${mapName}">\n${areaLines}\n</map>`
      : `\n<map name="${mapName}"></map>`;

    return `<div class="temp_img_v3" style="max-width: 900px; width: 100%; position: relative; text-align: center; margin:0 auto;">\n` +
           `<img src="${slot.imageUrl}" usemap="#${mapName}">\n` +
           `<div style="${cpDisplay}"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>\n` +
           `</div>${mapTag}`;
  }).join('\n\n') + _buildOcrHiddenBlock();
}

// OCR 텍스트를 display:none div로 래핑 반환 (두 모드 공용)
function _buildOcrHiddenBlock() {
  const ocrText = ($('ocr-text')?.value || '').trim();
  if (!ocrText) return '';
  const lines = ocrText.split('\n').map(l => escHtml(l.trim())).filter(Boolean).join('<br />\n\t');
  return `\n\t<div style="display: none">\n\t${lines}\n\t</div>\n`;
}

function buildIntroCodeString() {
  if (state.slots.length === 0) return null;

  return state.slots.map(slot => {
    const nw = slot.naturalWidth;
    const nh = slot.naturalHeight;
    if (!nw || !nh) return `<!-- 이미지 크기를 알 수 없습니다: ${escHtml(slot.imageName)} -->`;

    let html = `<div id="templwrap_v3">\n`;
    html += `\t<div style="position: relative">`;
    html += `<img src="${slot.imageUrl}" style="width:100%; display:block;" alt="">`;

    slot.areas.forEach(a => {
      const left   = (a.x1 / nw * 100).toFixed(2);
      const top    = (a.y1 / nh * 100).toFixed(2);
      const width  = ((a.x2 - a.x1) / nw * 100).toFixed(2);
      const height = ((a.y2 - a.y1) / nh * 100).toFixed(2);
      const href   = a.href ? escAttr(a.href) : '';
      const title  = a.alt ? ` title="${escAttr(a.alt)}"` : '';
      const target = a.target || '_blank';
      html += `<a href="${href}" target="${target}"${title} style="position:absolute; left:${left}%; top:${top}%; width:${width}%; height:${height}%; display:block;"></a>`;
    });

    const cpDisplay = state.exportExternal ? 'display:block' : 'display:none';
    html += `<div style="${cpDisplay}"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>`;
    html += `</div>\n`;

    // OCR 숨김 텍스트 (두 모드 공통 헬퍼)
    html += _buildOcrHiddenBlock();

    html += `</div>\n`;
    html += `<input style="margin: 0px; padding: 0px; border: 0px currentColor; width: 0px; height: 0px; font-size: 0px" id="isIncruit" value="Y" type="hidden" />\n`;
    html += `<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css" />\n`;
    html += `<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css" />\n`;
    html += `<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css" />`;
    return html;
  }).join('\n\n');
}

let _lastFullCode = ''; // 복사/다운로드용 전체 코드

function truncateDataUrls(code) {
  return code.replace(/data:image\/[^"']+/g, m =>
    m.length > 80 ? m.slice(0, 40) + '...(축약)...' + m.slice(-20) : m
  );
}

function generateCode() {
  if (state.slots.length === 0) {
    _lastFullCode = '';
    elCodeDisplay.textContent = '<!-- 이미지를 업로드하고 영역을 그리면 코드가 자동 생성됩니다 -->';
    return;
  }
  _lastFullCode = buildCodeString() || '';
  elCodeDisplay.textContent = truncateDataUrls(_lastFullCode);
}

// ─── EUC-KR 인코딩 ─────────────────────────────────────
let _eucKrTable = null;

function getEucKrTable() {
  if (_eucKrTable) return _eucKrTable;
  const decoder = new TextDecoder('euc-kr');
  _eucKrTable = {};
  for (let b1 = 0x81; b1 <= 0xFE; b1++) {
    for (let b2 = 0x41; b2 <= 0xFE; b2++) {
      const ch = decoder.decode(new Uint8Array([b1, b2]));
      if (ch && ch !== '\uFFFD' && ch.length === 1) {
        _eucKrTable[ch.charCodeAt(0)] = [b1, b2];
      }
    }
  }
  return _eucKrTable;
}

function encodeEucKr(str) {
  const table = getEucKrTable();
  const bytes = [];
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) {
      bytes.push(code);
    } else if (table[code]) {
      bytes.push(...table[code]);
    } else {
      // EUC-KR에 없는 문자 → HTML 엔티티 fallback
      for (const c of ('&#' + code + ';')) bytes.push(c.charCodeAt(0));
    }
  }
  return new Uint8Array(bytes);
}

// ─── HTML 다운로드 ───────────────────────────────────────
function downloadHtml() {
  const code = _lastFullCode || buildCodeString();
  if (!code) return;
  const meta = '<meta http-equiv="Content-Type" content="text/html; charset=euc-kr">\n';
  const blob = new Blob([encodeEucKr(meta + code)], { type: 'text/html;charset=euc-kr' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (elMapName.value.trim() || 'imagemap') + '.html';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 전체 렌더 ───────────────────────────────────────────
function renderAll() {
  renderOverlay();
  renderAreaList();
  renderSlotList();
  generateCode();
}

// ─── 파일 업로드 ─────────────────────────────────────────
elImageInput.addEventListener('change', e => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
  elImageInput.value = ''; // 같은 파일 재선택 허용
});

// ─── URL 입력 ────────────────────────────────────────────
elUrlBtn.addEventListener('click', () => loadImageFromUrl(elUrlInput.value));
elUrlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') loadImageFromUrl(elUrlInput.value);
});

// ─── 드롭존 드래그 앤 드롭 ──────────────────────────────
const dropTarget = $('canvas-container');
dropTarget.addEventListener('dragover', e => {
  e.preventDefault();
  elDropZone.classList.add('drag-over');
});
dropTarget.addEventListener('dragleave', () => {
  elDropZone.classList.remove('drag-over');
});
dropTarget.addEventListener('drop', e => {
  e.preventDefault();
  elDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadImage(file);
});

// ─── 맵 이름 변경 → 활성 슬롯에 반영 ───────────────────
elMapName.addEventListener('input', () => {
  const slot = getActive();
  if (slot) slot.mapName = elMapName.value;
  generateCode();
  renderSlotList();
});

// ─── 출력 형식 변경 ─────────────────────────────────────
function updateModeUI() {
  const isIntro = getOutputMode() === 'intro';
  const mapNameGroup = $('map-name-group');
  const ocrGroup = $('ocr-group');
  if (mapNameGroup) mapNameGroup.style.display = isIntro ? 'none' : '';
  // OCR은 두 모드 모두에서 제공 (이미지맵 모드에서도 숨김 텍스트 주입)
  if (ocrGroup) ocrGroup.style.display = '';
  generateCode();
}

document.querySelectorAll('input[name="output-mode"]').forEach(radio => {
  radio.addEventListener('change', updateModeUI);
});

// ─── 타겟 / 외부 반출 ───────────────────────────────────
elDefaultTarget.addEventListener('change', generateCode);
elExportCheck.addEventListener('change', () => {
  state.exportExternal = elExportCheck.checked;
  generateCode();
});

// ─── 복사 버튼 ───────────────────────────────────────────
elCopyBtn.addEventListener('click', () => {
  if (!_lastFullCode) return;
  navigator.clipboard.writeText(_lastFullCode).then(() => {
    const orig = elCopyBtn.textContent;
    elCopyBtn.textContent = '✓ 복사됨';
    elCopyBtn.style.background = '#10b981';
    setTimeout(() => {
      elCopyBtn.textContent = orig;
      elCopyBtn.style.background = '';
    }, 1500);
  });
});

// ─── HTML 다운로드 버튼 ──────────────────────────────────
elDownloadBtn.addEventListener('click', downloadHtml);

// ─── 마지막 영역 취소 ────────────────────────────────────
elUndoBtn.addEventListener('click', () => {
  const slot = getActive();
  if (!slot || slot.areas.length === 0) return;
  const last = slot.areas[slot.areas.length - 1];
  if (state.selectedAreaId === last.id) state.selectedAreaId = null;
  slot.areas.pop();
  renderAll();
});

// ─── 전체 초기화 ─────────────────────────────────────────
elResetBtn.addEventListener('click', () => {
  if (state.slots.length === 0) return;
  if (!confirm('모든 이미지와 영역을 초기화하시겠습니까?')) return;

  state.slots = [];
  state.activeSlotId = null;
  state.nextSlotId = 1;
  state.isDrawing = false;
  state.drawStart = null;
  state.selectedAreaId = null;
  state.interactionMode = null;
  state.moveStart = null;
  state.resizeHandle = null;

  elPreviewImg.src = '';
  elImgWrapper.style.display = 'none';
  elDropZone.style.display = '';
  elFileLabel.textContent = '파일을 선택하세요';
  elCanvasHint.textContent = '이미지를 업로드하면 드래그로 영역을 그릴 수 있습니다';
  elImageInput.value = '';
  elUrlInput.value = '';
  elUrlError.style.display = 'none';
  elMapName.value = 'map1';

  renderAll();
});

// ─── OCR (AI 비전 텍스트 추출) ──────────────────────────
const elOcrBtn  = $('ocr-btn');
const elOcrText = $('ocr-text');

elOcrBtn?.addEventListener('click', runOcr);
elOcrText?.addEventListener('input', generateCode);

async function runOcr() {
  const slot = getActive();
  if (!slot) { alert('이미지를 먼저 업로드하세요.'); return; }

  // Gemini API 키 (메인 앱과 localStorage 공유)
  const apiKey = localStorage.getItem('ai_api_key_gemini') || '';
  if (!apiKey) {
    alert('메인 앱 설정에서 Gemini API 키를 먼저 입력해주세요.');
    return;
  }

  const model = localStorage.getItem('ai_model_gemini') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // 이미지 base64 변환
  let base64;
  if (slot.imageUrl.startsWith('data:')) {
    base64 = slot.imageUrl.split(',')[1];
  } else {
    // 외부 URL → canvas → base64
    try {
      base64 = await urlToBase64(slot.imageUrl);
    } catch {
      alert('이미지를 변환할 수 없습니다. 파일로 직접 업로드해주세요.');
      return;
    }
  }

  elOcrBtn.disabled = true;
  elOcrBtn.textContent = '추출 중...';

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: '이 이미지에서 보이는 모든 텍스트를 **처음부터 끝까지 전부** 줄 단위로 추출하세요. 이미지가 길어도 중간에 생략하거나 "…" 로 요약하지 말고 보이는 모든 글자를 그대로 출력하세요. HTML 태그 없이 순수 텍스트만, 각 줄은 줄바꿈으로 구분하세요.' }
          ]
        }],
        // maxOutputTokens 4096 → 32768: 긴 채용공고 이미지에서 텍스트가 잘리지 않도록 확장.
        generationConfig: { temperature: 0.1, maxOutputTokens: 32768 }
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 오류 (${resp.status})`);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('텍스트를 찾을 수 없습니다.');

    elOcrText.value = text.trim();
    generateCode();
  } catch (e) {
    alert('텍스트 추출 실패: ' + e.message);
  } finally {
    elOcrBtn.disabled = false;
    elOcrBtn.textContent = '이미지에서 텍스트 추출';
  }
}

function urlToBase64(imgUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
}

// ─── 유틸 ────────────────────────────────────────────────
function escHtml(str)  { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function escAttr(str)  { return str.replace(/"/g, '&quot;'); }
