/**
 * 인크루트 샘플 이미지 서비스
 * - https://betaimg.incruit.com/ui/job_vs_sample/2026/ 기반
 * - manifest.json에서 파싱된 파일 목록으로 검색 지원
 */

const BASE_URL = 'https://betaimg.incruit.com/ui/job_vs_sample/2026/';

// manifest.json 내용 (정적 배포)
const MANIFEST = [
  "가족_건강_행복_자연_소풍_화창.jpg",
  "건강_행복_자연_아이_가족.jpg",
  "건물_10.jpg",
  "건물_11.jpg",
  "건물_12.jpg",
  "건물_13.jpg",
  "건물_14.jpg",
  "건물_15.jpg",
  "건물_16.jpg",
  "건물_3.jpg",
  "건물_4.jpg",
  "건물_5.jpg",
  "건물_6.jpg",
  "건물_7.jpg",
  "건물_8.jpg",
  "건물_9.jpg",
  "경제_1.jpg",
  "경제_2.jpg",
  "경제_3.jpg",
  "경제_4.jpg",
  "경제_5.jpg",
  "경제_6.jpg",
  "경제_7.jpg",
  "계단_1.jpg",
  "계단_2.jpg",
  "네트워크_1.jpg",
  "도시_건물_비지니스_사회_.jpg",
  "무역_1.jpg",
  "무역_2.jpg",
  "무역_3.jpg",
  "보험_위험_손해사정.jpg",
  "보험_의료_나눔_손해사정.jpg",
  "보험_의료_나눔_손해사정2.jpg",
  "보험_의료_나눔_손해사정3.jpg",
  "비지니스_사회_도시_건물_1.jpg",
  "비행기_1.jpg",
  "비행기_2.jpg",
  "비행기_3.jpg",
  "사람_1.jpg",
  "사람_10.jpg",
  "사람_11.jpg",
  "사람_12.jpg",
  "사람_13.jpg",
  "사람_14.jpg",
  "사람_15.jpg",
  "사람_16.jpg",
  "사람_17.jpg",
  "사람_18.jpg",
  "사람_19.jpg",
  "사람_2.jpg",
  "사람_20.jpg",
  "사람_21.jpg",
  "사람_22.jpg",
  "사람_23.jpg",
  "사람_24.jpg",
  "사람_25.jpg",
  "사람_26.jpg",
  "사람_27.jpg",
  "사람_28.jpg",
  "사람_29.jpg",
  "사람_3.jpg",
  "사람_30.jpg",
  "사람_4.jpg",
  "사람_5.jpg",
  "사람_6.jpg",
  "사람_7.jpg",
  "사람_8.jpg",
  "사람_9.jpg",
  "사무실_1.jpg",
  "사무실_10.jpg",
  "사무실_11.jpg",
  "사무실_12.jpg",
  "사무실_13.jpg",
  "사무실_14.jpg",
  "사무실_15.jpg",
  "사무실_16.jpg",
  "사무실_17.jpg",
  "사무실_18.jpg",
  "사무실_19.jpg",
  "사무실_2.jpg",
  "사무실_20.jpg",
  "사무실_21.jpg",
  "사무실_22.jpg",
  "사무실_23.jpg",
  "사무실_3.jpg",
  "사무실_4.jpg",
  "사무실_5.jpg",
  "사무실_6.jpg",
  "사무실_7.jpg",
  "사무실_8.jpg",
  "사무실_9.jpg",
  "산업_1.jpg",
  "산업_2.jpg",
  "산업_3.jpg",
  "산업_4.jpg",
  "산업_5.jpg",
  "산업_6.jpg",
  "산업_7.jpg",
  "산업_8.jpg",
  "손_1.jpg",
  "손_10.jpg",
  "손_2.jpg",
  "손_3.jpg",
  "손_4.jpg",
  "손_5.jpg",
  "손_6.jpg",
  "손_7.jpg",
  "손_8.jpg",
  "손_9.jpg",
  "스마트인더스트리_1.jpg",
  "스마트인더스트리_2.jpg",
  "여성_가족_화목_아이_웃음.jpg",
  "자연_1.jpg",
  "자연_2.jpg",
  "자연_3.jpg",
  "자연_4.jpg",
  "자연_5.jpg",
  "자연_6.jpg",
  "자연_7.jpg",
  "자연_8.jpg",
  "자연_가족_하늘_가을.jpg",
  "행복_가족_1.jpg",
  "행복_여성_가족_화목_1.jpg",
  "화살표_1.jpg",
  "화살표_2.jpg",
  "화살표_3.jpg",
  "화살표_4.jpg",
  "화살표_5.jpg",
];

// ============================================
// 파일명 파싱 → 검색용 인덱스 구축
// ============================================

/**
 * 파일명에서 키워드 배열 추출
 * "사무실_10.jpg" → ["사무실"]
 * "가족_건강_행복_자연_소풍_화창.jpg" → ["가족","건강","행복","자연","소풍","화창"]
 */
function parseKeywords(filename) {
  const base = filename.replace(/\.jpg$/i, '');
  return base
    .split('_')
    .map(k => k.trim())
    .filter(k => k && !/^\d+$/.test(k)); // 숫자만인 토큰 제거
}

/**
 * 대표 카테고리(첫 번째 비숫자 키워드) 반환
 */
function parseCategory(filename) {
  return parseKeywords(filename)[0] || '기타';
}

// 전체 이미지 목록 (파싱된 형태)
export const INCRUIT_SAMPLE_IMAGES = MANIFEST.map(filename => ({
  filename,
  url: BASE_URL + encodeURIComponent(filename),
  thumb: BASE_URL + encodeURIComponent(filename), // 별도 썸네일 없음 — 원본 사용
  title: filename.replace(/\.jpg$/i, '').replace(/_\d+$/, '').replace(/_/g, ' '),
  category: parseCategory(filename),
  keywords: parseKeywords(filename),
  source: 'incruit-sample',
}));

// ============================================
// 카테고리 목록
// ============================================

/** 고유 카테고리 목록 (가나다순) */
export const INCRUIT_SAMPLE_CATEGORIES = [
  ...new Set(INCRUIT_SAMPLE_IMAGES.map(img => img.category)),
].sort();

// ============================================
// 검색 함수
// ============================================

/**
 * 키워드로 샘플 이미지 검색
 * @param {string} keyword - 검색어 (빈 문자열이면 전체 반환)
 * @returns {Array} 일치하는 이미지 목록
 */
export function searchIncruitSamples(keyword = '') {
  if (!keyword.trim()) return INCRUIT_SAMPLE_IMAGES;

  const terms = keyword.trim().split(/\s+/);
  return INCRUIT_SAMPLE_IMAGES.filter(img => {
    const searchable = img.keywords.join(' ');
    return terms.every(term => searchable.includes(term));
  });
}

/**
 * 카테고리로 샘플 이미지 필터링
 * @param {string} category - 카테고리명
 * @returns {Array}
 */
export function filterIncruitSamplesByCategory(category) {
  if (!category) return INCRUIT_SAMPLE_IMAGES;
  return INCRUIT_SAMPLE_IMAGES.filter(img => img.category === category);
}

/**
 * 키워드 + 카테고리 복합 검색
 * @param {string} keyword
 * @param {string} category
 * @returns {Array}
 */
export function queryIncruitSamples({ keyword = '', category = '' } = {}) {
  let results = INCRUIT_SAMPLE_IMAGES;
  if (category) results = results.filter(img => img.category === category);
  if (keyword.trim()) {
    const terms = keyword.trim().split(/\s+/);
    results = results.filter(img => {
      const searchable = img.keywords.join(' ');
      return terms.every(term => searchable.includes(term));
    });
  }
  return results;
}
