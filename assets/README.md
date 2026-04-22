# Assets 폴더 구조

이 폴더는 프로젝트에서 사용하는 정적 에셋(이미지, 아이콘 등)을 관리합니다.

## 📁 폴더 구조

```
assets/
├── kv/                    # 키비주얼 이미지
│   ├── business/         # 비즈니스/일반 (오피스, 회의실 등)
│   ├── it/               # IT/기술 (코딩, 서버 등)
│   ├── startup/          # 스타트업 (협업 공간 등)
│   ├── creative/         # 크리에이티브 (디자인 스튜디오 등)
│   ├── service/          # 서비스/유통 (고객 서비스, 리테일 등)
│   ├── manufacturing/    # 제조/생산 (공장, 생산 라인 등)
│   ├── education/        # 교육 (교실, 도서관 등)
│   ├── healthcare/       # 의료/헬스케어 (병원, 의료 장비 등)
│   ├── government/       # 공공기관 (관공서 등)
│   └── finance/          # 금융 (은행, 투자 등)
└── README.md             # 이 파일

```

## 🖼️ 이미지 추가 가이드

### 1. 키비주얼 이미지 추가

1. **카테고리 선택**: 위 10개 카테고리 중 적절한 폴더 선택
2. **이미지 준비**:
   - 원본: 최소 1920x1080px (Full HD), JPG/PNG
   - 썸네일: 400x300px, JPG (옵션, 자동 생성 가능)
3. **파일명 규칙**: `{설명}-{번호}.jpg` (예: `office-meeting-1.jpg`)
4. **등록**: `js/services/imageLibrary.js`의 `LOCAL_KV_IMAGES` 배열에 추가

예시:
```javascript
// js/services/imageLibrary.js
export const LOCAL_KV_IMAGES = {
  business: [
    { thumb: 'assets/kv/business/office-1-thumb.jpg', full: 'assets/kv/business/office-1.jpg', title: '비즈니스 오피스 1' },
    // 👇 새 이미지 추가
    { thumb: 'assets/kv/business/conference-room-thumb.jpg', full: 'assets/kv/business/conference-room.jpg', title: '회의실' },
  ],
};
```

### 2. 썸네일 생성 (ImageMagick 사용 시)

```bash
# 단일 이미지
convert office-1.jpg -resize 400x300^ -gravity center -extent 400x300 office-1-thumb.jpg

# 폴더 일괄 처리
cd assets/kv/business
for img in *.jpg; do
  convert "$img" -resize 400x300^ -gravity center -extent 400x300 "${img%.jpg}-thumb.jpg"
done
```

### 3. 이미지 최적화

```bash
# JPG 압축 (품질 80%)
jpegoptim --max=80 *.jpg

# PNG 압축
optipng -o5 *.png
```

---

## 📊 권장 사양

| 항목 | 권장 사양 | 비고 |
|------|-----------|------|
| **원본 이미지** |  |  |
| 해상도 | 1920x1080px 이상 | Full HD |
| 비율 | 16:9 또는 21:9 | 가로형 |
| 포맷 | JPG (사진), PNG (그래픽) |  |
| 파일 크기 | 500KB 이하 | 최적화 후 |
| **썸네일** |  |  |
| 해상도 | 400x300px | 고정 |
| 포맷 | JPG |  |
| 파일 크기 | 50KB 이하 |  |

---

## 🎨 이미지 소스 추천

### 무료 이미지 사이트 (상업적 이용 가능)

1. **Unsplash** (https://unsplash.com/)
   - 고품질, 가로형 이미지 풍부
   - API 지원 (이미 통합됨)
   - 크레딧 표시 권장

2. **Pexels** (https://www.pexels.com/)
   - 다양한 카테고리
   - API 지원 (이미 통합됨)

3. **Pixabay** (https://pixabay.com/)
   - 200만+ 이미지
   - API 지원 (통합 예정)

4. **Unsplash Collections** (큐레이션)
   - Business & Work: https://unsplash.com/collections/1065976
   - Technology: https://unsplash.com/collections/1662619
   - Startup: https://unsplash.com/collections/3694365

### 유료 스톡 (필요 시)

- Adobe Stock
- Shutterstock
- Getty Images

---

## 🔍 카테고리별 이미지 키워드

API 검색 또는 수동 수집 시 참고:

| 카테고리 | 한글 키워드 | 영어 키워드 |
|---------|------------|-------------|
| business | 비즈니스, 오피스, 회의, 팀워크 | business, office, meeting, teamwork |
| it | 기술, 개발, 코딩, 서버 | technology, coding, software, developer |
| startup | 스타트업, 혁신, 협업 | startup, innovation, collaboration |
| creative | 디자인, 창작, 스튜디오 | design, creative, art, studio |
| service | 서비스, 고객, 리테일 | service, customer, retail, hospitality |
| manufacturing | 제조, 공장, 생산 | manufacturing, factory, production |
| education | 교육, 학교, 학습 | education, school, learning |
| healthcare | 의료, 병원, 건강 | healthcare, medical, hospital |
| government | 공공, 행정 | government, public, administration |
| finance | 금융, 은행, 투자 | finance, banking, investment |

---

## 📝 체크리스트 (이미지 추가 시)

- [ ] 카테고리에 맞는 폴더에 저장
- [ ] 원본 + 썸네일 모두 준비
- [ ] 파일명 규칙 준수 (소문자, 하이픈 구분)
- [ ] 이미지 최적화 (파일 크기 확인)
- [ ] `imageLibrary.js`에 등록
- [ ] 브라우저에서 테스트 (썸네일/원본 모두 로드 확인)
- [ ] 라이선스 확인 (상업적 이용 가능 여부)

---

**작성일**: 2026-02-14
