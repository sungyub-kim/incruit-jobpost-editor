/**
 * 이미지 DB 서비스
 * - IndexedDB 기반 이미지 저장/검색/관리
 * - Figma API 연동 (프레임 가져오기)
 */

const DB_NAME = 'ImageDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const THUMB_WIDTH = 300;
const THUMB_HEIGHT = 200;

let _db = null;

// ============================================
// IndexedDB 초기화
// ============================================

export async function openDB() {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-category', 'category', { unique: false });
        store.createIndex('by-source', 'source', { unique: false });
        store.createIndex('by-created', 'createdAt', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = (e) => {
      console.error('[ImageDB] DB 열기 실패:', e.target.error);
      reject(e.target.error);
    };
  });
}

// ============================================
// 이미지 CRUD
// ============================================

/**
 * 이미지 추가
 * @param {Object} params
 * @param {File|Blob} params.file - 이미지 파일
 * @param {string} params.name - 이미지 이름
 * @param {string} params.category - 카테고리 (business, it, ...)
 * @param {string[]} params.tags - 검색용 태그
 * @param {string} [params.source='upload'] - 소스 ('upload' | 'figma' | 'url')
 * @param {string} [params.sourceUrl=''] - 원본 URL
 * @param {Object} [params.figmaMeta=null] - Figma 메타 { fileKey, nodeId, nodeName }
 * @returns {Promise<number>} 생성된 ID
 */
export async function addImage({ file, name, category, tags = [], source = 'upload', sourceUrl = '', figmaMeta = null }) {
  const db = await openDB();

  const thumbBlob = await createThumbnail(file, THUMB_WIDTH, THUMB_HEIGHT);
  const { width, height } = await getImageDimensions(file);

  const record = {
    name: name || file.name || '이름 없음',
    category: category || 'business',
    tags: tags.map(t => t.toLowerCase().trim()).filter(Boolean),
    source,
    sourceUrl,
    thumbBlob,
    fullBlob: file,
    width,
    height,
    fileSize: file.size,
    createdAt: new Date(),
    figmaMeta,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 이미지 조회 (조건별)
 * @param {Object} [filters]
 * @param {string} [filters.category] - 카테고리 필터
 * @param {string} [filters.source] - 소스 필터
 * @returns {Promise<Array>}
 */
export async function getImages(filters = {}) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let req;
    if (filters.category) {
      req = store.index('by-category').getAll(filters.category);
    } else if (filters.source) {
      req = store.index('by-source').getAll(filters.source);
    } else {
      req = store.getAll();
    }

    req.onsuccess = () => {
      let results = req.result;
      // 추가 필터
      if (filters.category && filters.source) {
        results = results.filter(r => r.source === filters.source);
      }
      // 최신순 정렬
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * ID로 이미지 가져오기
 */
export async function getImageById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 키워드 기반 검색 (이름 + 태그 매칭)
 */
export async function searchImages(keyword) {
  if (!keyword || !keyword.trim()) return getImages();

  const terms = keyword.toLowerCase().trim().split(/\s+/);
  const all = await getImages();

  return all.filter(img => {
    const searchable = [
      img.name.toLowerCase(),
      ...img.tags,
      img.category,
    ].join(' ');
    return terms.every(term => searchable.includes(term));
  });
}

/**
 * 이미지 삭제
 */
export async function deleteImage(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 이미지 메타데이터 수정
 */
export async function updateImage(id, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) { reject(new Error('이미지를 찾을 수 없습니다')); return; }

      if (updates.name !== undefined) record.name = updates.name;
      if (updates.category !== undefined) record.category = updates.category;
      if (updates.tags !== undefined) record.tags = updates.tags.map(t => t.toLowerCase().trim()).filter(Boolean);

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (e) => reject(e.target.error);
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}

/**
 * DB 통계
 */
export async function getStats() {
  const all = await getImages();
  const totalSize = all.reduce((sum, img) => sum + (img.fileSize || 0), 0);
  const categories = {};
  all.forEach(img => {
    categories[img.category] = (categories[img.category] || 0) + 1;
  });
  return { count: all.length, totalSize, categories };
}

// ============================================
// 이미지 유틸리티
// ============================================

function createThumbnail(blob, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;

      // 비율 유지 크롭 (center)
      const srcRatio = w / h;
      const dstRatio = maxW / maxH;
      let sx = 0, sy = 0, sw = w, sh = h;
      if (srcRatio > dstRatio) {
        sw = h * dstRatio;
        sx = (w - sw) / 2;
      } else {
        sh = w / dstRatio;
        sy = (h - sh) / 2;
      }

      canvas.width = maxW;
      canvas.height = maxH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, maxW, maxH);
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
    img.src = url;
  });
}

function getImageDimensions(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.width, height: img.height }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
    img.src = url;
  });
}

/**
 * Blob을 Object URL로 변환 (검색 결과 표시용)
 * 호출자가 URL.revokeObjectURL()로 해제해야 함
 */
export function blobToUrl(blob) {
  return blob ? URL.createObjectURL(blob) : '';
}

// ============================================
// 내보내기 / 가져오기
// ============================================

/**
 * 전체 DB를 JSON+Blob 배열로 내보내기
 * @returns {Promise<Blob>} JSON 파일 Blob
 */
export async function exportDB() {
  const all = await getImages();

  const exportData = await Promise.all(all.map(async (img) => {
    const thumbBase64 = img.thumbBlob ? await blobToBase64(img.thumbBlob) : null;
    const fullBase64 = img.fullBlob ? await blobToBase64(img.fullBlob) : null;
    return {
      name: img.name,
      category: img.category,
      tags: img.tags,
      source: img.source,
      sourceUrl: img.sourceUrl,
      width: img.width,
      height: img.height,
      fileSize: img.fileSize,
      createdAt: img.createdAt.toISOString(),
      figmaMeta: img.figmaMeta,
      thumbBase64,
      fullBase64,
    };
  }));

  const json = JSON.stringify(exportData, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * JSON 파일에서 DB 가져오기
 * @param {File} file - JSON 파일
 * @returns {Promise<number>} 가져온 이미지 수
 */
export async function importDB(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  let imported = 0;

  for (const item of data) {
    const fullBlob = item.fullBase64 ? base64ToBlob(item.fullBase64) : null;
    if (!fullBlob) continue;

    await addImage({
      file: fullBlob,
      name: item.name,
      category: item.category,
      tags: item.tags || [],
      source: item.source || 'upload',
      sourceUrl: item.sourceUrl || '',
      figmaMeta: item.figmaMeta || null,
    });
    imported++;
  }
  return imported;
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl) {
  try {
    const [meta, data] = dataUrl.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch { return null; }
}

// ============================================
// Figma API 연동
// ============================================

const FIGMA_API_BASE = 'https://api.figma.com';

// Figma API는 CORS 허용 → 직접 호출
function figmaApiUrl(path) {
  return FIGMA_API_BASE + path;
}

// 이미지 다운로드용 프록시 (환경 자동 감지)
function figmaImgProxyUrl(url) {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const base = isLocal ? 'http://localhost:8787' : '';
  return `${base}/proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Figma 파일 URL에서 fileKey 추출
 * 지원 형식:
 * - https://www.figma.com/file/XXXXX/...
 * - https://www.figma.com/design/XXXXX/...
 */
export function parseFigmaUrl(url) {
  const m = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

/**
 * Figma 파일 정보 가져오기
 */
export async function fetchFigmaFile(fileKey, token) {
  const res = await fetch(figmaApiUrl(`/v1/files/${fileKey}?depth=2`), {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API 오류 (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Figma 파일에서 최상위 프레임 목록 추출
 * @returns {Array<{ id, name, width, height }>}
 */
export async function fetchFigmaFrames(fileKey, token) {
  const file = await fetchFigmaFile(fileKey, token);
  const frames = [];

  for (const page of file.document.children || []) {
    for (const node of page.children || []) {
      if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
        frames.push({
          id: node.id,
          name: node.name,
          type: node.type,
          width: Math.round(node.absoluteBoundingBox?.width || 0),
          height: Math.round(node.absoluteBoundingBox?.height || 0),
          pageName: page.name,
        });
      }
    }
  }
  return frames;
}

/**
 * Figma 노드를 이미지로 export하고 URL 받기
 * @param {string} fileKey
 * @param {string[]} nodeIds
 * @param {string} token
 * @param {string} format - 'png' | 'svg' | 'jpg'
 * @param {number} scale - 1, 2, 3, 4
 * @returns {Object} { nodeId: imageUrl }
 */
export async function exportFigmaNodes(fileKey, nodeIds, token, format = 'png', scale = 2) {
  const ids = nodeIds.join(',');
  const res = await fetch(
    figmaApiUrl(`/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`),
    { headers: { 'X-Figma-Token': token } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma export 오류 (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.images || {};
}

/**
 * Figma 프레임들을 이미지DB에 가져오기
 * @param {string} fileKey
 * @param {Array<{id, name}>} frames - 가져올 프레임 목록
 * @param {string} token
 * @param {string} category
 * @param {string[]} tags
 * @returns {Promise<number>} 가져온 이미지 수
 */
export async function importFromFigma(fileKey, frames, token, category = 'creative', tags = []) {
  const nodeIds = frames.map(f => f.id);
  const imageUrls = await exportFigmaNodes(fileKey, nodeIds, token);

  let imported = 0;
  for (const frame of frames) {
    const imgUrl = imageUrls[frame.id];
    if (!imgUrl) continue;

    try {
      // Figma export URL에서 이미지 다운로드 (CORS proxy 경유)
      const proxyUrl = figmaImgProxyUrl(imgUrl);
      const res = await fetch(proxyUrl);
      if (!res.ok) continue;

      const blob = await res.blob();
      await addImage({
        file: blob,
        name: frame.name,
        category,
        tags: [...tags, 'figma'],
        source: 'figma',
        sourceUrl: imgUrl,
        figmaMeta: { fileKey, nodeId: frame.id, nodeName: frame.name },
      });
      imported++;
    } catch (err) {
      console.warn(`[Figma] ${frame.name} 가져오기 실패:`, err);
    }
  }
  return imported;
}

/**
 * Figma 프레임 썸네일 URL 가져오기 (미리보기용)
 */
export async function getFigmaThumbnails(fileKey, nodeIds, token) {
  return exportFigmaNodes(fileKey, nodeIds, token, 'png', 1);
}

// ============================================
// Figma Variables API
// ============================================

/**
 * Figma 파일의 로컬 변수 목록 가져오기
 *
 * 반환값 구조:
 * {
 *   variables: { [id]: { id, name, resolvedType, variableCollectionId, ... } },
 *   variableCollections: { [id]: { id, name, defaultModeId, modes: [{modeId, name}], ... } }
 * }
 *
 * 주의: Figma PAT에 "File variables" 스코프가 활성화되어 있어야 함
 */
export async function fetchFigmaVariables(fileKey, token) {
  const res = await fetch(figmaApiUrl(`/v1/files/${fileKey}/variables/local`), {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    const body = await res.text();
    // 403 → 스코프 문제
    if (res.status === 403) {
      throw new Error('Figma 토큰에 "File variables" 권한이 없습니다. Personal Access Token 생성 시 Variables 스코프를 활성화해주세요.');
    }
    throw new Error(`Figma Variables API 오류 (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.meta || {};
}

/**
 * Figma 변수 값 일괄 업데이트
 *
 * @param {string} fileKey
 * @param {string} token
 * @param {Array<{ variableId: string, modeId: string, value: any }>} updates
 *   - value: string(STRING), number(FLOAT), boolean(BOOLEAN), {r,g,b,a}(COLOR)
 */
export async function updateFigmaVariableValues(fileKey, token, updates) {
  const variableValues = updates.map(u => ({
    variableId: u.variableId,
    modeId: u.modeId,
    value: u.value,
  }));

  const res = await fetch(figmaApiUrl(`/v1/files/${fileKey}/variables`), {
    method: 'POST',
    headers: {
      'X-Figma-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ variableValues }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      throw new Error('Figma 토큰에 Variables 쓰기 권한이 없습니다. PAT 생성 시 Variables(write) 스코프를 활성화해주세요.');
    }
    throw new Error(`Figma Variables 업데이트 오류 (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * STRING 타입 변수만 필터링하여 반환 (KV 텍스트 매핑용)
 * @param {Object} variablesMeta - fetchFigmaVariables() 반환값
 * @returns {Array<{ id, name, collectionName, defaultModeId }>}
 */
export function filterStringVariables(variablesMeta) {
  const { variables = {}, variableCollections = {} } = variablesMeta;
  return Object.values(variables)
    .filter(v => v.resolvedType === 'STRING')
    .map(v => {
      const col = variableCollections[v.variableCollectionId] || {};
      return {
        id: v.id,
        name: v.name,
        collectionName: col.name || '',
        defaultModeId: col.defaultModeId || '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
