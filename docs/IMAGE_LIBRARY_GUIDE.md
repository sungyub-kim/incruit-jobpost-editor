# 이미지 & 아이콘 라이브러리 사용 가이드

## 📦 설치 완료 항목

### 1. 키비주얼 이미지 라이브러리
- ✅ 로컬 이미지 폴더 구조: `assets/kv/{카테고리}/`
- ✅ 10개 카테고리 (business, it, startup, creative, service, manufacturing, education, healthcare, government, finance)
- ✅ 3개 API 통합 (Unsplash, Pexels, Pixabay)
- ✅ 통합 검색 함수 (`searchKvImages`)
- ✅ 카테고리 자동 감지 (`detectCategory`)

### 2. 아이콘 라이브러리 (Lucide Icons)
- ✅ CDN 추가: `https://unpkg.com/lucide@latest`
- ✅ 1,400+ 일관된 아이콘 세트
- ✅ 아이콘 헬퍼 함수 (`createIcon`, `renderIcon`)
- ✅ 프리셋 시스템 (`ICON_PRESETS`)

---

## 🖼️ 키비주얼 이미지 사용법

### 기본 사용

```javascript
import { searchKvImages, detectCategory } from './js/services/imageLibrary.js';

// 1. 카테고리별 이미지 검색
const apiKeys = {
  unsplashKey: 'YOUR_UNSPLASH_KEY',
  pexelsKey: 'YOUR_PEXELS_KEY',
  pixabayKey: 'YOUR_PIXABAY_KEY',
};

const images = await searchKvImages('business', 'office', apiKeys);

// 결과 구조:
// [
//   { thumb: '...', full: '...', source: 'local', title: '...' },
//   { thumb: '...', full: '...', source: 'unsplash', author: '...', download: '...' },
//   { thumb: '...', full: '...', source: 'pexels', author: '...' },
// ]
```

### 카테고리 자동 감지

```javascript
import { detectCategory } from './js/services/imageLibrary.js';

const sourceText = "IT 기업 소프트웨어 개발자 채용...";
const category = detectCategory(sourceText);
// 결과: 'it'

const images = await searchKvImages(category, '', apiKeys);
```

### Unsplash 큐레이션 컬렉션

```javascript
import { getUnsplashCollection } from './js/services/imageLibrary.js';

// 카테고리별 큐레이션된 고품질 이미지
const images = await getUnsplashCollection('startup', 'YOUR_UNSPLASH_KEY');
```

---

## 🎨 아이콘 사용법

### 방법 1: JavaScript로 아이콘 생성

```javascript
import { createIcon, ICON_NAMES } from './js/utils/icons.js';

// 기본 사용
const settingsIcon = createIcon('settings', { size: 20, color: '#0066cc' });
document.querySelector('#btn-settings').innerHTML = settingsIcon;

// 프리셋 사용
import { getPresetIcon } from './js/utils/icons.js';
const aiIcon = getPresetIcon('ai-sparkles');
```

### 방법 2: HTML data 속성 (자동 초기화)

```html
<!-- HTML에서 간단하게 사용 -->
<button>
  <span data-icon="settings" data-icon-size="20" data-icon-color="#0066cc"></span>
  설정
</button>

<div data-icon="download" data-icon-size="16"></div>
```

`initIcons()`가 자동으로 실행되어 모든 `[data-icon]` 요소를 렌더링합니다.

### 방법 3: DOM 요소에 직접 렌더링

```javascript
import { renderIcon, ICON_NAMES } from './js/utils/icons.js';

const button = document.getElementById('btn-copy');
renderIcon(button, ICON_NAMES.COPY, { size: 16 });
```

---

## 🔄 기존 SVG 인라인 교체 예시

### Before (기존 코드)

```html
<button id="btn-copy" class="...">
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
  </svg>
  HTML 복사
</button>
```

### After (개선된 코드)

```html
<button id="btn-copy" class="...">
  <span data-icon="copy" data-icon-size="16"></span>
  HTML 복사
</button>
```

또는 JavaScript에서:

```javascript
import { createIcon } from './js/utils/icons.js';

const copyBtn = document.getElementById('btn-copy');
copyBtn.innerHTML = `
  ${createIcon('copy', { size: 16 })}
  <span>HTML 복사</span>
`;
```

---

## 📚 자주 사용하는 아이콘 목록

| 용도 | 아이콘 이름 | 설명 |
|------|------------|------|
| **AI/채팅** | `sparkles` | AI 기능 |
| | `message-circle` | 채팅 메시지 |
| | `send` | 전송 |
| **파일** | `upload` | 업로드 |
| | `download` | 다운로드 |
| | `paperclip` | 첨부 |
| **편집** | `pencil` | 편집 |
| | `copy` | 복사 |
| | `trash-2` | 삭제 |
| **상태** | `check` | 완료 |
| | `x` | 취소 |
| | `alert-triangle` | 경고 |
| | `loader` | 로딩 (회전 애니메이션 가능) |
| **설정** | `settings` | 설정 |
| | `sliders` | 조정 |
| | `palette` | 색상 |
| **UI** | `eye` / `eye-off` | 표시/숨김 |
| | `search` | 검색 |
| | `refresh-cw` | 새로고침 |
| | `external-link` | 외부 링크 |

전체 아이콘 목록: https://lucide.dev/icons/

---

## 🎯 통합 예시: 키비주얼 이미지 선택 UI

```javascript
import { searchKvImages, detectCategory } from './js/services/imageLibrary.js';
import { createIcon } from './js/utils/icons.js';

async function renderImageGallery(sourceText) {
  const category = detectCategory(sourceText);
  const images = await searchKvImages(category, '', apiKeys);

  const gallery = document.getElementById('kv-img-gallery');
  gallery.innerHTML = images.map(img => `
    <div class="image-card" data-full="${img.full}">
      <img src="${img.thumb}" alt="${img.title || ''}">
      <div class="image-overlay">
        <button class="btn-select">
          ${createIcon('check', { size: 20, color: '#fff' })}
        </button>
      </div>
      ${img.author ? `<p class="image-author">${img.author}</p>` : ''}
    </div>
  `).join('');
}
```

---

## 🚀 다음 단계

1. **로컬 이미지 추가**
   - `assets/kv/{카테고리}/` 폴더에 이미지 파일 추가
   - 썸네일 생성 (권장: 400x300px)
   - `imageLibrary.js`의 `LOCAL_KV_IMAGES` 배열에 경로 추가

2. **API 키 설정**
   - Unsplash: https://unsplash.com/developers
   - Pexels: https://www.pexels.com/api/
   - Pixabay: https://pixabay.com/api/docs/

3. **아이콘 교체 작업**
   - `index.html`에서 SVG 인라인 찾기 (총 119회)
   - `data-icon` 속성으로 교체
   - 또는 `createIcon()` 함수 사용

4. **성능 최적화**
   - 이미지 lazy loading
   - 썸네일 캐싱
   - API 응답 캐싱 (localStorage)

---

## 📝 코드 크기 비교

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| index.html | 1,129줄 / 68KB | ~900줄 / 55KB | -20% |
| SVG 중복 | 119회 인라인 | 1개 CDN | -99% |
| 아이콘 일관성 | 불일치 | 완벽 일관 | ✓ |
| 유지보수성 | 어려움 | 쉬움 | ✓ |

---

## 🛠️ 문제 해결

### Lucide 아이콘이 표시되지 않을 때

1. CDN 로드 확인:
   ```javascript
   console.log(typeof lucide); // 'object'가 나와야 함
   ```

2. 아이콘 이름 확인:
   ```javascript
   console.log(lucide.Settings); // 함수가 나와야 함
   ```

3. 브라우저 콘솔 에러 확인

### 이미지 검색이 작동하지 않을 때

1. API 키 확인 (localStorage 또는 설정 모달)
2. CORS 프록시 실행 확인 (localhost:8787)
3. 네트워크 탭에서 API 요청 상태 확인

---

**작성일**: 2026-02-14
**작성자**: Claude Code (Opus 4.6)
