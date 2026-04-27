/**
 * Fair Page Builder — Section Schema
 * 각 섹션 블록의 데이터 구조 정의
 *
 * field types:
 *   text      — 단순 텍스트
 *   textarea  — 여러 줄 텍스트
 *   image     — 이미지 경로
 *   link      — URL
 *   repeater  — 반복 항목 배열
 */

const FAIR_BUILDER_SCHEMA = {

  /* ─────────────────────────────────────
   * 비주얼 섹션 (메인 배너)
   * ───────────────────────────────────── */
  section_visual: {
    id: 'section_visual',
    name: '메인 비주얼',
    sectionClass: 'main-visual',
    anchorId: '',
    enabled: true,
    fields: {
      sec_title: { type: 'text', label: '배경 설명', default: '메인 비주얼' },
    }
  },

  /* ─────────────────────────────────────
   * 헤더 (고정, 로고만 교체)
   * ───────────────────────────────────── */
  header: {
    id: 'header',
    name: '헤더 로고',
    fixed: true,
    fields: {
      logo_href:  { type: 'link',  label: '로고 링크 URL',    default: '#' },
      logo_title: { type: 'text',  label: '로고 title 속성',  default: '기업명' },
    }
  },

  /* ─────────────────────────────────────
   * 섹션 0 — 버튼 (그라디언트 배너)
   * ───────────────────────────────────── */
  section_gradient: {
    id: 'section_gradient',
    name: '버튼 배너',
    sectionClass: 'section section-color-gradient',
    anchorId: '',
    enabled: true,
    fields: {
      buttons: {
        type: 'repeater',
        label: '버튼 목록',
        itemLabel: '버튼',
        maxItems: 4,
        fields: {
          label: { type: 'text', label: '버튼 텍스트', default: '' },
          href:  { type: 'link', label: '링크 URL',    default: '' },
          style: { type: 'text', label: '추가 클래스 (예: btn--puple)', default: '' },
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 섹션 1 — 행사안내
   * ───────────────────────────────────── */
  section_event_info: {
    id: 'section_event_info',
    name: '행사안내',
    sectionClass: 'section section-color-bg1',
    anchorId: 'm-section-01',
    enabled: true,
    fields: {
      sec_title:  { type: 'text', label: '섹션 제목', default: '행사안내' },
      sec_sub:    { type: 'text', label: '섹션 소제목', default: 'Opening Speech' },
      posters: {
        type: 'repeater',
        label: '포스터 박스',
        itemLabel: '포스터',
        maxItems: 5,
        fields: {
          type:      { type: 'text',  label: '유형 (online/offline)', default: 'online' },
          title:     { type: 'text',  label: '제목', default: '온라인 행사안내' },
          period:    { type: 'text',  label: '기간', default: '' },
          url:       { type: 'link',  label: '행사 URL', default: '' },
          location:  { type: 'text',  label: '장소', default: '' },
          programs:  { type: 'textarea', label: '프로그램 목록 (줄바꿈 구분)', default: '' },
          contact:   { type: 'text',  label: '문의처', default: '' },
          apply_link:{ type: 'link',  label: '신청 버튼 링크', default: '' },
          apply_target:{ type: 'select', label: '신청 버튼 열기 방식', default: '_blank',
            options: [{ value: '_blank', label: '새창 (_blank)' }, { value: '_self', label: '현재창 (_self)' }] },
          logos: {
            type: 'repeater',
            label: '로고 이미지',
            itemLabel: '로고',
            maxItems: 4,
            fields: {
              src: { type: 'image', label: '이미지 경로', default: '' },
              alt: { type: 'text',  label: 'alt 텍스트',  default: '' },
            }
          }
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 섹션 2 — 인사말
   * ───────────────────────────────────── */
  section_greetings: {
    id: 'section_greetings',
    name: '인사말',
    sectionClass: 'section section-color-bg2',
    anchorId: 'm-section-02',
    enabled: true,
    fields: {
      sec_title:   { type: 'text',     label: '섹션 제목', default: '인사말' },
      photo_src:   { type: 'image',    label: '인물 사진 경로', default: '' },
      photo_alt:   { type: 'text',     label: '사진 alt', default: '' },
      position:    { type: 'text',     label: '직책', default: '' },
      name:        { type: 'text',     label: '이름', default: '' },
      body:        { type: 'textarea', label: '인사말 본문', default: '' },
    }
  },

  /* ─────────────────────────────────────
   * 섹션 3 — 행사소개 (링크 카드형)
   * ───────────────────────────────────── */
  section_intro_links: {
    id: 'section_intro_links',
    name: '행사소개',
    sectionClass: 'section section-color-bg3',
    anchorId: 'm-section-03',
    enabled: true,
    fields: {
      sec_title: { type: 'text', label: '섹션 제목', default: '행사소개' },
      items: {
        type: 'repeater',
        label: '링크 카드',
        itemLabel: '카드',
        maxItems: 5,
        fields: {
          number: { type: 'text',  label: '번호',    default: '1' },
          title:  { type: 'text',  label: '제목',    default: '' },
          img_src:{ type: 'image', label: '아이콘',  default: '' },
          img_alt:{ type: 'text',  label: 'alt',     default: '' },
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 섹션 4 — 채용공고
   * ───────────────────────────────────── */
  section_joblist: {
    id: 'section_joblist',
    name: '채용공고',
    sectionClass: 'section joblist',
    anchorId: 'm-section-04',
    enabled: true,
    fixed_content: true,
    note: '채용공고 리스트는 동적 데이터. 탭 이름만 편집 가능.',
    fields: {
      sec_title: { type: 'text', label: '섹션 제목', default: '채용공고' },
      tabs: {
        type: 'repeater',
        label: '탭 목록',
        itemLabel: '탭',
        maxItems: 5,  /* v0.21.0: 채용관 5순위 — 2~5개 제한 */
        fields: {
          name: { type: 'text', label: '탭 이름', default: '' },
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 섹션 5 — 성공사례 자료실
   * ───────────────────────────────────── */
  section_success: {
    id: 'section_success',
    name: '성공사례',
    sectionClass: 'section section-color-bg4',
    anchorId: 'm-section-05',
    enabled: true,
    fields: {
      sec_title: { type: 'text', label: '섹션 제목', default: '성공사례 자료실' },
      items: {
        type: 'repeater',
        label: '링크 카드',
        itemLabel: '카드',
        maxItems: 5,
        fields: {
          title:   { type: 'text',  label: '제목',    default: '' },
          sub:     { type: 'text',  label: '부제',    default: '' },
          img_src: { type: 'image', label: '아이콘',  default: '' },
          href:    { type: 'link',  label: '링크 URL', default: '' },
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 섹션 6 — 소개 기관
   * ───────────────────────────────────── */
  section_organizations: {
    id: 'section_organizations',
    name: '소개 기관',
    sectionClass: 'section cont-wr section-color-bg',
    anchorId: '',
    enabled: true,
    fields: {
      sec_title: { type: 'text', label: '섹션 제목', default: '소개 기관' },
      items: {
        type: 'repeater',
        label: '기관',
        itemLabel: '기관',
        maxItems: 6,
        fields: {
          href:    { type: 'link',  label: '링크 URL',   default: '' },
          img_src: { type: 'image', label: '아이콘 경로', default: '' },
          img_alt: { type: 'text',  label: 'alt',         default: '' },
          name:    { type: 'text',  label: '기관명',       default: '' },
          desc:    { type: 'text',  label: '설명',         default: '' },
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 섹션 7 — 영상
   * ───────────────────────────────────── */
  section_videos: {
    id: 'section_videos',
    name: '영상',
    sectionClass: 'section section-color-bg2',
    anchorId: '',
    enabled: false,
    fields: {
      sec_title: { type: 'text', label: '섹션 제목', default: '영상' },
      items: {
        type: 'repeater',
        label: '영상',
        itemLabel: '영상',
        maxItems: 6,
        fields: {
          youtube_url: { type: 'link', label: 'YouTube Embed URL', default: '' },
          title:       { type: 'text', label: '영상 제목',           default: '' },
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 섹션 8 — 공지사항
   * ───────────────────────────────────── */
  section_notice: {
    id: 'section_notice',
    name: '공지사항',
    sectionClass: 'section notice',
    anchorId: '',
    enabled: false,
    fields: {
      sec_title: { type: 'text', label: '섹션 제목', default: '공지사항' },
      items: {
        type: 'repeater',
        label: '공지',
        itemLabel: '공지',
        maxItems: 10,
        fields: {
          title:   { type: 'text',     label: '제목',   default: '' },
          date:    { type: 'text',     label: '날짜',   default: '' },
          content: { type: 'textarea', label: '내용',   default: '' },
        }
      }
    }
  },

  /* ─────────────────────────────────────
   * 푸터 (고정)
   * ───────────────────────────────────── */
  footer: {
    id: 'footer',
    name: '푸터',
    fixed: true,
    fields: {}
  }

};

/* 섹션 기본 순서 */
const FAIR_BUILDER_DEFAULT_ORDER = [
  'section_visual',
  'section_event_info',
  'section_gradient',
  'section_greetings',
  'section_intro_links',
  'section_joblist',
  'section_success',
  'section_organizations',
  'section_videos',
  'section_notice',
];

/* CSS :root 색상 토큰 */
const FAIR_BUILDER_COLORS = {
  '--c-color':  { label: '메인 컬러',          default: '#e4007f' },
  '--s-color':  { label: '서브 컬러',           default: '#752782' },
  '--s-color1': { label: '온라인 뱃지 컬러',    default: '#ef8796' },
  '--s-color2': { label: '오프라인 뱃지 컬러',  default: '#d185dd' },
  '--s-color3': { label: '버튼1 컬러',          default: '#f46d80' },
  '--s-color4': { label: '버튼2 컬러',          default: '#c91be5' },
};
