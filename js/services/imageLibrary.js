/**
 * 이미지 라이브러리 서비스
 * - 로컬 이미지 + 외부 API (Unsplash, Pexels, Pixabay) 통합 관리
 */

// ============================================
// 로컬 이미지 라이브러리 (카테고리별)
// ============================================

// Unsplash 무료 이미지 (직접 링크, 프로토타입용)
// 실제 프로덕션에서는 assets/ 폴더에 다운로드하여 사용 권장
export const LOCAL_KV_IMAGES = {
  business: [
    { thumb: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80', full: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80', title: '비즈니스 오피스', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&q=80', full: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1920&q=80', title: '협업 회의', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&q=80', full: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1920&q=80', title: '팀워크', source: 'local' },
  ],
  it: [
    { thumb: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&q=80', full: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1920&q=80', title: '테크 오피스', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80', full: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1920&q=80', title: '코딩 작업', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&q=80', full: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80', title: '서버 데이터센터', source: 'local' },
  ],
  startup: [
    { thumb: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=80', full: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80', title: '스타트업 팀', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=80', full: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&q=80', title: '브레인스토밍', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80', full: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80', title: '혁신 공간', source: 'local' },
  ],
  creative: [
    { thumb: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80', full: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1920&q=80', title: '디자인 스튜디오', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', full: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80', title: '크리에이티브 워크', source: 'local' },
  ],
  service: [
    { thumb: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80', full: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&q=80', title: '고객 서비스', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80', full: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80', title: '리테일 매장', source: 'local' },
  ],
  manufacturing: [
    { thumb: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=80', full: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80', title: '공장 생산', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&q=80', full: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=1920&q=80', title: '제조 라인', source: 'local' },
  ],
  education: [
    { thumb: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&q=80', full: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1920&q=80', title: '교육 현장', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80', full: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1920&q=80', title: '도서관', source: 'local' },
  ],
  healthcare: [
    { thumb: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400&q=80', full: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1920&q=80', title: '의료 시설', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80', full: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1920&q=80', title: '헬스케어', source: 'local' },
  ],
  government: [
    { thumb: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=80', full: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1920&q=80', title: '공공 건물', source: 'local' },
  ],
  finance: [
    { thumb: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80', full: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80', title: '금융 분석', source: 'local' },
    { thumb: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&q=80', full: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=1920&q=80', title: '투자 관리', source: 'local' },
  ],
};

// ============================================
// 카테고리 메타데이터
// ============================================

export const KV_CATEGORIES = {
  business: { name: '비즈니스/일반', keywords: ['business', 'office', 'corporate', 'professional'] },
  it: { name: 'IT/기술', keywords: ['technology', 'coding', 'software', 'computer'] },
  startup: { name: '스타트업', keywords: ['startup', 'collaboration', 'innovation', 'team'] },
  creative: { name: '크리에이티브', keywords: ['design', 'creative', 'art', 'studio'] },
  service: { name: '서비스/유통', keywords: ['service', 'retail', 'customer', 'hospitality'] },
  manufacturing: { name: '제조/생산', keywords: ['manufacturing', 'factory', 'production', 'industry'] },
  education: { name: '교육', keywords: ['education', 'school', 'learning', 'university'] },
  healthcare: { name: '의료/헬스케어', keywords: ['healthcare', 'medical', 'hospital', 'health'] },
  government: { name: '공공기관', keywords: ['government', 'public', 'administration'] },
  finance: { name: '금융', keywords: ['finance', 'banking', 'investment', 'money'] },
};

// ============================================
// API 통합
// ============================================

export const IMAGE_API_PROVIDERS = {
  unsplash: {
    name: 'Unsplash',
    endpoint: 'https://api.unsplash.com/search/photos',
    apiKeyField: 'unsplashKey',
    queryParam: 'query',
    resultsPath: 'results',
    mapResult: (item) => ({
      id: item.id,
      thumb: item.urls.thumb,
      full: item.urls.regular,
      download: item.links.download_location,
      author: item.user.name,
      source: 'unsplash',
    }),
  },
  pexels: {
    name: 'Pexels',
    endpoint: 'https://api.pexels.com/v1/search',
    apiKeyField: 'pexelsKey',
    queryParam: 'query',
    resultsPath: 'photos',
    mapResult: (item) => ({
      id: item.id,
      thumb: item.src.medium,
      full: item.src.large2x,
      author: item.photographer,
      source: 'pexels',
    }),
  },
  pixabay: {
    name: 'Pixabay',
    endpoint: 'https://pixabay.com/api/',
    apiKeyField: 'pixabayKey',
    queryParam: 'q',
    resultsPath: 'hits',
    mapResult: (item) => ({
      id: item.id,
      thumb: item.webformatURL,
      full: item.largeImageURL,
      author: item.user,
      source: 'pixabay',
    }),
  },
  openverse: {
    name: 'Openverse',
    endpoint: 'https://api.openverse.org/v1/images/',
    apiKeyField: 'openverseKey',
    queryParam: 'q',
    resultsPath: 'results',
    mapResult: (item) => ({
      id: item.id,
      thumb: item.thumbnail || item.url,
      full: item.url,
      author: item.creator || item.source || 'Unknown',
      source: 'openverse',
      license: item.license,
    }),
  },
};

// ============================================
// Unsplash 큐레이션 컬렉션
// ============================================

export const UNSPLASH_COLLECTIONS = {
  business: '1065976',  // Business & Work
  it: '1662619',        // Technology
  startup: '3694365',   // Startup
  creative: '1163637',  // Creative Workspace
  service: '162213',    // Customer Service
  manufacturing: '1172124',  // Industry
  education: '1065412',      // Education
  healthcare: '1354607',     // Healthcare
  government: '1330645',     // Architecture
  finance: '1354951',        // Finance
};

// ============================================
// 통합 이미지 검색 함수
// ============================================

/**
 * 로컬 + API 이미지를 통합 검색
 * @param {string} category - 카테고리 키 (business, it 등)
 * @param {string} keyword - 검색 키워드 (선택)
 * @param {object} apiKeys - API 키 객체 { unsplashKey, pexelsKey, pixabayKey }
 * @returns {Promise<Array>} 이미지 배열
 */
export async function searchKvImages(category, keyword = '', apiKeys = {}) {
  const results = [];

  // 1. 로컬 이미지 먼저 추가
  if (LOCAL_KV_IMAGES[category]) {
    results.push(...LOCAL_KV_IMAGES[category].map(img => ({ ...img, source: 'local' })));
  }

  // 2. 검색 키워드 결정
  const searchKeyword = keyword || KV_CATEGORIES[category]?.keywords[0] || category;

  // 3. 활성화된 API에서 검색
  const apiPromises = [];

  Object.entries(IMAGE_API_PROVIDERS).forEach(([providerKey, provider]) => {
    const apiKey = apiKeys[provider.apiKeyField];
    if (!apiKey) return;

    const url = new URL(provider.endpoint);
    url.searchParams.set(provider.queryParam, searchKeyword);
    url.searchParams.set('per_page', '10');

    if (providerKey === 'unsplash') {
      url.searchParams.set('orientation', 'landscape');
    } else if (providerKey === 'pexels') {
      url.searchParams.set('orientation', 'landscape');
    } else if (providerKey === 'pixabay') {
      url.searchParams.set('key', apiKey);
      url.searchParams.set('image_type', 'photo');
      url.searchParams.set('orientation', 'horizontal');
    } else if (providerKey === 'openverse') {
      url.searchParams.delete('per_page');
      url.searchParams.set('page_size', '10');
      url.searchParams.set('license_type', 'commercial');
      url.searchParams.set('extension', 'jpg,png');
    }

    const headers = {};
    if (providerKey === 'unsplash') {
      headers['Authorization'] = `Client-ID ${apiKey}`;
    } else if (providerKey === 'pexels') {
      headers['Authorization'] = apiKey;
    }

    apiPromises.push(
      fetch(url, { headers })
        .then(r => r.json())
        .then(data => {
          const items = data[provider.resultsPath] || [];
          return items.map(provider.mapResult);
        })
        .catch(err => {
          console.warn(`[${provider.name}] 검색 실패:`, err);
          return [];
        })
    );
  });

  const apiResults = await Promise.all(apiPromises);
  apiResults.forEach(arr => results.push(...arr));

  return results;
}

/**
 * Unsplash 큐레이션 컬렉션에서 이미지 가져오기
 * @param {string} category - 카테고리
 * @param {string} unsplashKey - Unsplash API 키
 * @returns {Promise<Array>}
 */
export async function getUnsplashCollection(category, unsplashKey) {
  const collectionId = UNSPLASH_COLLECTIONS[category];
  if (!collectionId || !unsplashKey) return [];

  try {
    const url = `https://api.unsplash.com/collections/${collectionId}/photos?per_page=20`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${unsplashKey}` },
    });
    const data = await res.json();
    return data.map(item => ({
      id: item.id,
      thumb: item.urls.thumb,
      full: item.urls.regular,
      download: item.links.download_location,
      author: item.user.name,
      source: 'unsplash-collection',
    }));
  } catch (err) {
    console.warn('[Unsplash Collection] 가져오기 실패:', err);
    return [];
  }
}

// ============================================
// 카테고리 자동 감지
// ============================================

/**
 * 텍스트에서 카테고리 자동 감지
 * @param {string} text - 분석할 텍스트
 * @returns {string} 카테고리 키
 */
export function detectCategory(text) {
  const lowerText = text.toLowerCase();

  // 각 카테고리의 키워드 매칭 점수 계산
  const scores = {};
  Object.entries(KV_CATEGORIES).forEach(([key, meta]) => {
    scores[key] = meta.keywords.reduce((acc, keyword) => {
      return acc + (lowerText.includes(keyword) ? 1 : 0);
    }, 0);
  });

  // 가장 높은 점수의 카테고리 반환
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : 'business'; // 기본값: business
}
