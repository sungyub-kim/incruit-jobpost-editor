/**
 * Workspace Manager
 * 여러 채용공고를 동시에 작업할 수 있도록 워크스페이스 관리
 * - 레지스트리 CRUD
 * - localStorage 키 네임스페이싱
 * - 기존 데이터 마이그레이션
 */

const MAX_WORKSPACES = 10;
const REGISTRY_KEY = 'workspaces';
const ACTIVE_KEY = 'active_workspace';

// 워크스페이스별로 격리되는 localStorage 키 목록
const SESSION_KEYS = [
  'session_messages',
  'session_convertedHtml',
  'session_sourceContent',
  'session_kv',
  'original_source',
  'job_number',
  'template',
  'colors',
  'ui_state'
];

let registry = [];
let activeId = null;

// ─── 레지스트리 I/O ──────────────────────

function loadRegistry() {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    registry = raw ? JSON.parse(raw) : [];
  } catch { registry = []; }
}

function saveRegistry() {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

// ─── ID 생성 ──────────────────────────────

function generateId() {
  // crypto.randomUUID이 없는 환경 대비
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'ws_' + crypto.randomUUID().slice(0, 8);
  }
  return 'ws_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── 마이그레이션 ─────────────────────────

function migrateExistingData() {
  const firstId = 'ws_1';
  const now = Date.now();

  // 기존 flat 키 → ws_1/* 로 복사
  SESSION_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val !== null) {
      localStorage.setItem(`${firstId}/${key}`, val);
      localStorage.removeItem(key);
    }
  });

  // 워크스페이스 이름 추론 (original_source 메타데이터에서)
  let name = '작업 1';
  try {
    const os = localStorage.getItem(`${firstId}/original_source`);
    if (os) {
      const parsed = JSON.parse(os);
      name = parsed?.metadata?.company || parsed?.metadata?.title || parsed?.metadata?.filename || '작업 1';
    }
  } catch { /* ignore */ }

  registry = [{ id: firstId, name, createdAt: now, updatedAt: now }];
  activeId = firstId;
  saveRegistry();
  localStorage.setItem(ACTIVE_KEY, activeId);
}

// ─── Public API ───────────────────────────

/**
 * 초기화: 레지스트리 로드 또는 마이그레이션
 * @returns {string} 활성 워크스페이스 ID
 */
export function initWorkspaces() {
  loadRegistry();

  if (registry.length === 0) {
    // 기존 session 데이터가 하나라도 있으면 마이그레이션
    const hasExisting = SESSION_KEYS.some(k => localStorage.getItem(k) !== null);
    if (hasExisting) {
      migrateExistingData();
    } else {
      // 완전 새로운 사용자 → 기본 워크스페이스 1개 생성
      const id = 'ws_1';
      const now = Date.now();
      registry = [{ id, name: '작업 1', createdAt: now, updatedAt: now }];
      activeId = id;
      saveRegistry();
      localStorage.setItem(ACTIVE_KEY, id);
    }
  } else {
    activeId = localStorage.getItem(ACTIVE_KEY);
    // 유효성 체크
    if (!activeId || !registry.find(w => w.id === activeId)) {
      activeId = registry[0].id;
      localStorage.setItem(ACTIVE_KEY, activeId);
    }
  }

  return activeId;
}

/** 레지스트리 배열 반환 (읽기용) */
export function getRegistry() {
  return [...registry];
}

/** 현재 활성 워크스페이스 ID */
export function getActiveId() {
  return activeId;
}

/** 활성 워크스페이스 변경 */
export function setActiveId(id) {
  if (!registry.find(w => w.id === id)) return false;
  activeId = id;
  localStorage.setItem(ACTIVE_KEY, id);
  // updatedAt 갱신
  const ws = registry.find(w => w.id === id);
  if (ws) ws.updatedAt = Date.now();
  saveRegistry();
  return true;
}

/**
 * 새 워크스페이스 생성
 * @param {string} [name] - 이름 (미지정 시 "작업 N")
 * @returns {string|null} 생성된 ID 또는 null (제한 초과)
 */
export function createWorkspace(name) {
  if (registry.length >= MAX_WORKSPACES) return null;

  const id = generateId();
  const now = Date.now();
  const wsName = name || `작업 ${registry.length + 1}`;

  registry.push({ id, name: wsName, createdAt: now, updatedAt: now });
  saveRegistry();
  return id;
}

/**
 * 워크스페이스 삭제
 * @returns {boolean} 성공 여부
 */
export function deleteWorkspace(id) {
  if (registry.length <= 1) return false;

  // localStorage에서 해당 워크스페이스의 모든 키 삭제
  SESSION_KEYS.forEach(key => {
    localStorage.removeItem(`${id}/${key}`);
  });

  registry = registry.filter(w => w.id !== id);
  saveRegistry();

  // 활성 워크스페이스가 삭제된 경우 첫 번째로 전환
  if (activeId === id) {
    activeId = registry[0].id;
    localStorage.setItem(ACTIVE_KEY, activeId);
  }

  return true;
}

/**
 * 워크스페이스 이름 변경
 */
export function renameWorkspace(id, newName) {
  const ws = registry.find(w => w.id === id);
  if (!ws) return false;
  ws.name = newName;
  ws.updatedAt = Date.now();
  saveRegistry();
  return true;
}

/**
 * localStorage 키에 현재 활성 워크스페이스 네임스페이스 프리픽스 추가
 * @param {string} key - 원본 키 (예: 'session_messages')
 * @returns {string} 네임스페이스 키 (예: 'ws_1/session_messages')
 */
export function wsKey(key) {
  return `${activeId}/${key}`;
}

/**
 * 특정 워크스페이스 ID 기준으로 네임스페이스 키 반환
 * (백그라운드 작업 결과를 원래 워크스페이스에 저장할 때 사용)
 */
export function wsKeyFor(wsId, key) {
  return `${wsId}/${key}`;
}

/**
 * 특정 워크스페이스의 이름을 반환
 */
export function getWorkspaceName(wsId) {
  const ws = registry.find(w => w.id === wsId);
  return ws ? ws.name : '작업';
}

/** 워크스페이스 수 제한 */
export function getMaxWorkspaces() {
  return MAX_WORKSPACES;
}
