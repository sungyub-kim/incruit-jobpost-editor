/**
 * 아이콘 유틸리티
 * Lucide Icons 래퍼 함수 - SVG 인라인 중복 제거
 */

/**
 * Lucide 아이콘 생성
 * @param {string} name - 아이콘 이름 (예: 'settings', 'download', 'copy')
 * @param {object} options - 옵션 { size, color, strokeWidth, class }
 * @returns {string} SVG HTML
 */
export function createIcon(name, options = {}) {
  const {
    size = 16,
    color = 'currentColor',
    strokeWidth = 2,
    class: className = '',
  } = options;

  // Lucide가 로드되지 않은 경우 fallback
  if (typeof lucide === 'undefined') {
    console.warn('[Icons] Lucide가 로드되지 않았습니다.');
    return `<span class="icon-placeholder ${className}" style="width:${size}px;height:${size}px;display:inline-block;"></span>`;
  }

  // Lucide 아이콘 존재 여부 확인
  const iconName = toPascalCase(name);
  if (!lucide[iconName]) {
    console.warn(`[Icons] 아이콘을 찾을 수 없습니다: ${name} (${iconName})`);
    return `<span class="icon-placeholder ${className}">?</span>`;
  }

  // SVG 생성
  const svg = lucide[iconName];
  return `<svg class="lucide lucide-${name} ${className}"
    width="${size}"
    height="${size}"
    stroke="${color}"
    stroke-width="${strokeWidth}"
    fill="none"
    viewBox="0 0 24 24"
    stroke-linecap="round"
    stroke-linejoin="round">
    ${svg.toSvg ? svg.toSvg() : ''}
  </svg>`;
}

/**
 * DOM 요소에 아이콘 렌더링
 * @param {HTMLElement} element - 대상 요소
 * @param {string} iconName - 아이콘 이름
 * @param {object} options - 옵션
 */
export function renderIcon(element, iconName, options = {}) {
  if (!element) return;
  element.innerHTML = createIcon(iconName, options);
}

/**
 * 여러 아이콘을 한번에 초기화 (data-icon 속성 사용)
 * HTML: <span data-icon="settings" data-icon-size="20"></span>
 */
export function initIcons() {
  // Lucide가 로드되지 않았으면 경고만 출력
  if (typeof lucide === 'undefined') {
    console.warn('[Icons] Lucide CDN이 로드되지 않았습니다.');
    return;
  }

  // data-icon 속성을 data-lucide로 변환하고 Lucide 초기화
  document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.getAttribute('data-icon');
    const size = el.getAttribute('data-icon-size') || '16';
    const color = el.getAttribute('data-icon-color') || 'currentColor';
    const strokeWidth = el.getAttribute('data-icon-stroke') || '2';

    // data-lucide 속성 설정
    el.setAttribute('data-lucide', iconName);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.color = color;
    el.style.strokeWidth = strokeWidth;
    el.style.display = 'inline-block';
  });

  // Lucide 아이콘 렌더링
  lucide.createIcons();
  console.log('[Icons] Lucide 아이콘 초기화 완료');
}

/**
 * kebab-case를 PascalCase로 변환
 */
function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// ============================================
// 프로젝트에서 자주 사용하는 아이콘 프리셋
// ============================================

export const ICON_PRESETS = {
  // AI 관련
  'ai-sparkles': { name: 'sparkles', size: 16, strokeWidth: 2 },
  'ai-message': { name: 'message-circle', size: 16, strokeWidth: 2 },
  'ai-send': { name: 'send', size: 16, strokeWidth: 2 },

  // 파일 작업
  'file-upload': { name: 'upload', size: 16, strokeWidth: 2 },
  'file-download': { name: 'download', size: 16, strokeWidth: 2 },
  'file-attach': { name: 'paperclip', size: 16, strokeWidth: 2 },

  // 편집
  'edit': { name: 'pencil', size: 16, strokeWidth: 2 },
  'copy': { name: 'copy', size: 16, strokeWidth: 2 },
  'trash': { name: 'trash-2', size: 16, strokeWidth: 2 },

  // 설정
  'settings': { name: 'settings', size: 16, strokeWidth: 2 },
  'info': { name: 'info', size: 16, strokeWidth: 2 },
  'help': { name: 'help-circle', size: 16, strokeWidth: 2 },

  // 상태
  'check': { name: 'check', size: 16, strokeWidth: 2 },
  'x': { name: 'x', size: 16, strokeWidth: 2 },
  'alert': { name: 'alert-triangle', size: 16, strokeWidth: 2 },
  'loader': { name: 'loader', size: 16, strokeWidth: 2 },

  // 네비게이션
  'chevron-down': { name: 'chevron-down', size: 16, strokeWidth: 2 },
  'chevron-up': { name: 'chevron-up', size: 16, strokeWidth: 2 },
  'chevron-left': { name: 'chevron-left', size: 16, strokeWidth: 2 },
  'chevron-right': { name: 'chevron-right', size: 16, strokeWidth: 2 },

  // UI 요소
  'eye': { name: 'eye', size: 16, strokeWidth: 2 },
  'eye-off': { name: 'eye-off', size: 16, strokeWidth: 2 },
  'external-link': { name: 'external-link', size: 16, strokeWidth: 2 },
  'refresh': { name: 'refresh-cw', size: 16, strokeWidth: 2 },
};

/**
 * 프리셋 아이콘 가져오기
 */
export function getPresetIcon(presetName) {
  const preset = ICON_PRESETS[presetName];
  if (!preset) {
    console.warn(`[Icons] 프리셋을 찾을 수 없습니다: ${presetName}`);
    return createIcon('help-circle');
  }
  return createIcon(preset.name, preset);
}

// ============================================
// 아이콘 명세 (자주 사용하는 것들)
// ============================================

export const ICON_NAMES = {
  // 파일/문서
  FILE: 'file',
  FILE_TEXT: 'file-text',
  FOLDER: 'folder',
  FOLDER_OPEN: 'folder-open',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  PAPERCLIP: 'paperclip',

  // 편집
  EDIT: 'pencil',
  EDIT_2: 'edit-2',
  EDIT_3: 'edit-3',
  COPY: 'copy',
  TRASH: 'trash-2',
  SAVE: 'save',

  // AI/채팅
  MESSAGE_CIRCLE: 'message-circle',
  MESSAGE_SQUARE: 'message-square',
  SEND: 'send',
  SPARKLES: 'sparkles',
  BOT: 'bot',

  // 상태/피드백
  CHECK: 'check',
  CHECK_CIRCLE: 'check-circle',
  X: 'x',
  X_CIRCLE: 'x-circle',
  ALERT_TRIANGLE: 'alert-triangle',
  ALERT_CIRCLE: 'alert-circle',
  INFO: 'info',
  LOADER: 'loader',

  // 설정/도구
  SETTINGS: 'settings',
  SLIDERS: 'sliders',
  PALETTE: 'palette',
  LAYOUT: 'layout',

  // 네비게이션
  CHEVRON_DOWN: 'chevron-down',
  CHEVRON_UP: 'chevron-up',
  CHEVRON_LEFT: 'chevron-left',
  CHEVRON_RIGHT: 'chevron-right',
  ARROW_LEFT: 'arrow-left',
  ARROW_RIGHT: 'arrow-right',

  // UI
  EYE: 'eye',
  EYE_OFF: 'eye-off',
  SEARCH: 'search',
  FILTER: 'filter',
  REFRESH: 'refresh-cw',
  EXTERNAL_LINK: 'external-link',
  LINK: 'link',
  IMAGE: 'image',

  // 키비주얼 관련
  LAYERS: 'layers',
  SQUARE: 'square',
  CIRCLE: 'circle',
  TYPE: 'type',
  ALIGN_LEFT: 'align-left',
  ALIGN_CENTER: 'align-center',
  ALIGN_RIGHT: 'align-right',
};

// 자동 초기화 (DOMContentLoaded 시)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Lucide 로드 확인 후 초기화
    if (typeof lucide !== 'undefined') {
      console.log('[Icons] Lucide Icons 초기화 완료');
      initIcons();
    } else {
      console.warn('[Icons] Lucide가 로드되지 않았습니다. CDN 확인 필요.');
    }
  });
}
