# 채용공고 키비주얼 템플릿 생성기

## 개요
채용공고 키비주얼(Key Visual) 이미지를 브라우저에서 생성하고 다운로드할 수 있는 기능.
기존 채용공고 에디터의 Settings 패널에 **"키비주얼" 탭**으로 통합.

> 참고 원본: http://115.21.118.182:3082/

---

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `index.html` | Settings 패널 탭 UI, 키비주얼 입력 폼, 프리뷰 영역 |
| `css/styles.css` | 탭/버튼/프리뷰 카드/효과 스타일, 반응형 폰트(cqi) |
| `js/app.js` | 키비주얼 상태관리, 이벤트 바인딩, 렌더링, 다운로드, 초기화 |

---

## 구현된 기능

### 1. Settings 패널 탭 UI
- **채용공고** / **키비주얼** 2개 탭 전환
- 탭 전환 시 프리뷰 영역도 함께 전환 (템플릿 미리보기 ↔ 키비주얼 미리보기)
- 탭 전환 시 상태 보존 (이전 설정값 유지)

### 2. 텍스트 입력
- **공고번호**: 단일 텍스트 입력 (예: `공고 제2026-0호`)
- **기업명 + 공고명**: 3줄 textarea (최대 3줄)
- **회사 소개**: 3줄 textarea (최대 3줄)
- **날짜 + 기업명**: 2개 입력 필드 (날짜, 기업명)
- 각 필드에 "설정 ▼" 토글 버튼 (확장 가능)
- 입력 시 200ms debounce로 실시간 프리뷰 반영

### 3. 템플릿 타입
- **오버레이형**: 배경 이미지 위에 텍스트 오버레이
- **분리형 (Split)**: 좌측 이미지 | 우측 텍스트 (CSS Grid 2열)

### 4. 텍스트 정렬
- **좌측** / **센터** / **우측**
- 버튼 그룹 UI (3열 그리드)

### 5. 효과
- **없음**: 효과 없이 순수 배경
- **그라데이션**: 하단에서 상단으로 어두워지는 오버레이 (기본값)
- **사선**: 좌상단에서 우하단으로 대각선 그라데이션
- **곡선**: 좌하단 중심 방사형 그라데이션

### 6. 높이 모드
- **고정**: 16:9 비율 (aspect-ratio)
- **유동**: 최소 높이 300px, 내용에 따라 늘어남

### 7. 컬러 설정
- **이미지 배경 컬러**: 배경 이미지가 없을 때의 배경색 (`#1f46a8`)
- **브랜드 컬러**: 분리형 템플릿의 텍스트 영역 배경색 (`#16213d`)
- 컬러 피커 + HEX 텍스트 입력 동기화

### 8. 로고 설정 (접이식)
- 접이식 아코디언 UI
- 이미지 파일 업로드 (FileReader → DataURL)
- 프리뷰에 로고 표시
- 삭제 버튼

### 9. 배경 이미지 설정
- **직접 첨부**: 파일 업로드 (drag & drop 스타일)
- **URL 입력**: 외부 이미지 URL 직접 입력
- 기본값: Unsplash 오피스 이미지
- 첨부 파일이 URL보다 우선

### 10. 키비주얼 프리뷰
- 프리뷰 헤더: "미리보기" 제목 + 현재 설정 정보 표시 + 다운로드 버튼
- 실시간 렌더링 (설정 변경 즉시 반영)
- 반응형 폰트: CSS Container Query (`cqi` 단위) + `clamp()` 사용
- 카드 크기가 작아도 모든 텍스트 가시성 보장

### 11. 다운로드
- **html2canvas** 라이브러리 사용 (CDN): 이미지 다운로드 + 클립보드 복사
- 다운로드 형식: **PNG 2x** (기본) / **PNG 4x** / **JPG** / **HTML**
- 파일명: `inckv-{공고번호}-{scale}x.{format}` (이미지) / `inckv-{공고번호}.html` (HTML)
- html2canvas 옵션: `useCORS: true`, `backgroundColor: null`
- 드롭다운 UI로 형식 선택
- 사이드바 + 프리뷰 헤더 양쪽에 다운로드 버튼

### 12. 초기화
- 모든 설정을 기본값으로 리셋
- confirm 다이얼로그로 실수 방지
- 폼 입력값, 옵션 버튼 상태, 프리뷰 모두 초기화

### 13. KV 토글 스위치
- on/off 스위치로 키비주얼 활성화/비활성화
- `#kv-toggle` 체크박스 + 커스텀 슬라이더 UI
- `syncKvVisibility()`로 인라인 섹션 표시 제어

### 14. 프리셋 시스템
- **5개 프리셋**: cleanCorporate(깔끔한 기업형), startupVibe(스타트업 감성), government(공공기관), creative(크리에이티브), minimal(미니멀)
- 각 프리셋에 templateType, textAlign, effect, heightMode, bgColor, brandColor, textShadow, fieldStyles, textPosition 포함
- 프리셋 적용 시 텍스트/로고/이미지는 보존하고 스타일만 변경
- `KV_PRESETS` 상수 정의 (app.js)

### 15. 필드별 스타일 컨트롤
- 각 텍스트 필드(공고번호, 기업명+공고명, 회사소개, 날짜+기업명)에 개별 스타일 설정
- **글꼴 크기**: 레인지 슬라이더 + 숫자 입력 연동
- **글꼴 색상**: 컬러 피커 + HEX 입력 동기화
- **굵기**: Bold 체크박스
- "설정 ▼" 토글로 패널 접기/펼치기

### 16. 텍스트 그림자
- **없음** / **가벼운** / **보통** / **강하게** (4단계)
- `getTextShadowCss()` 함수로 CSS text-shadow 값 반환
- 오버레이 이미지 위 텍스트 가독성 향상

### 17. 텍스트 포지션 (절대 위치 조정)
- 고정 높이 모드에서 활성화 (유동 높이 시 비활성)
- 4개 필드별 left(0-600px) / top(0-400px) 슬라이더
- 아코디언 UI로 필드별 접기/펼치기
- `state.kv.textPosition` 객체에 좌표 저장

### 18. 타이틀 자동 맞춤
- `#kv-title-autofit` 체크박스 (기본: 활성)
- 제목이 카드 높이 40% 초과 시 글꼴 크기 자동 축소
- `autoFitTitle()` 함수에서 현재 크기 ~ 20px까지 반복 축소

### 19. AI 연동 기능

#### AI KV JSON 자동 추출
- 채용공고 변환 시 AI 프롬프트에 KV JSON 출력 요청 포함
- `buildConversionPrompt()`에서 JSON 블록 형식 지정
- `tryApplyKvJson()`: AI 응답의 ```json 블록 파싱 → KV 필드 자동 채우기
- 추출 항목: jobCode, title, description, date, companyName, industry

#### 정규식 기반 자동 채우기
- `tryAutoFillKvFromSource()`: 원문 텍스트에서 정규식으로 정보 추출
- `parseJobPostContent()`: 공고번호, 기업명, 공고명, 날짜, 회사소개 추출
- AI 응답 없이도 로컬에서 즉시 동작

#### 업종별 배경 자동 선택
- `pickBgImageByKeywords()`: 17개 업종 키워드 매칭 → Unsplash 이미지 자동 매핑
- `KV_BG_IMAGES` 상수: IT/개발, 사무, 금융, 마케팅, 디자인, 제조, 건설, 의료, 바이오, 교육, 물류, 유통, 서비스, HR 등
- `detectBestPreset()`: 원문 키워드 기반 최적 프리셋 자동 선택

### 20. 이미지 검색
- **Unsplash/Pexels API** 연동 (API 키 필요)
- 키워드 입력 + 검색 버튼 / Enter 키
- `suggestImageKeyword()`: 채용공고 텍스트 → 영어 검색 키워드 자동 추천
- 검색 결과 그리드 표시, 클릭으로 배경 이미지 적용
- Unsplash 다운로드 추적 (API 규정 준수)
- API 키 미설정 시 경고 메시지 표시

### 21. 내보내기/공유 기능

#### 다운로드 확장
- **PNG 2x** (기본): 고해상도 이미지
- **PNG 4x**: 초고해상도 이미지
- **JPG**: 압축 이미지
- **HTML**: 독립 실행형 HTML 파일 (Pretendard 폰트 CDN 내장)
- 파일명 패턴: `inckv-{공고번호}-{scale}x.{format}`
- 드롭다운 UI로 형식 선택

#### 클립보드 이미지 복사
- `copyKvToClipboard()`: html2canvas(2x) → blob → `navigator.clipboard.write()`
- "복사됨" 피드백 1.5초 후 복귀

#### 미리보기 팝업
- `openKvPreviewPopup()`: 새 브라우저 창으로 KV 프리뷰 열기

#### 변환 결과 복사 버튼 그룹
- `buildCopyButtons()`: HTML 복사 / 미리보기 복사 / KV 복사 (3개 버튼 그룹)
- KV 활성화 시에만 KV 복사 버튼 표시

### 22. 준비 완료 배지
- 변환 완료 시 KV 탭에 초록색 점(●) 표시
- 탭 클릭 시 배지 제거 (이미 확인한 것으로 간주)

### 23. 한국어 스마트 줄바꿈
- `smartWrapKorean()` / `wrapText()`: 텍스트를 최대 3줄로 자동 분리
- 단어 경계 보존

---

## 기술 상세

### 상태 구조 (`state.kv`)
```javascript
{
  jobCode: '공고 제2026-0호',
  title: '기업명이 들어갑니다.\n공고명이 들어갑니다.\n최대 3줄까지 가능합니다.',
  description: '회사에 대한 소개가 들어갑니다.\n...',
  date: '2026년 01월 30일',
  companyName: '기업명',
  templateType: 'overlay',    // 'overlay' | 'split'
  textAlign: 'left',          // 'left' | 'center' | 'right'
  effect: 'gradient',         // 'none' | 'gradient' | 'diagonal' | 'curve'
  textShadow: 'medium',       // 'none' | 'light' | 'medium' | 'strong'
  heightMode: 'fixed',        // 'fixed' | 'fluid'
  bgColor: '#1f46a8',
  brandColor: '#16213d',
  logoDataUrl: '',
  bgImageDataUrl: '',
  bgImageUrl: 'https://images.unsplash.com/photo-...',
  fieldStyles: {              // 필드별 개별 스타일
    jobCode:     { fontSize: 14, color: '#ffffff', bold: false },
    title:       { fontSize: 28, color: '#ffffff', bold: true },
    description: { fontSize: 16, color: '#ffffffcc', bold: false },
    dateCompany: { fontSize: 13, color: '#ffffffaa', bold: false }
  },
  textPosition: {             // 필드별 절대 위치 (고정 높이 전용)
    jobCode:     { left: 40, top: 30 },
    title:       { left: 40, top: 80 },
    description: { left: 40, top: 200 },
    dateCompany: { left: 40, top: 320 }
  }
}
```

### 주요 함수

#### 핵심 함수
| 함수 | 역할 |
|------|------|
| `setupKeyVisual()` | 이벤트 바인딩 (탭, 입력, 버튼, 컬러, 파일, 프리셋, 포지션, 이미지 검색) |
| `syncKvState()` | DOM 입력값 → state.kv 동기화 |
| `debounceKvPreview()` | 200ms debounce 프리뷰 갱신 |
| `renderKvPreview()` | state.kv 기반 프리뷰 카드 HTML 생성 |
| `syncKvVisibility()` | KV 토글에 따른 인라인 섹션 표시/숨김 |
| `updateKvControls()` | state.kv 값을 UI 컨트롤에 반영 |
| `resetKv()` | 모든 설정 초기화 |

#### 프리셋/스타일 함수
| 함수 | 역할 |
|------|------|
| `applyKvPreset()` | 프리셋 스타일 적용 (텍스트/로고/이미지 보존) |
| `detectBestPreset()` | 원문 키워드 기반 최적 프리셋 자동 감지 |
| `autoFitTitle()` | 제목 오버플로 시 글꼴 크기 자동 축소 |
| `getTextShadowCss()` | 텍스트 그림자 CSS 값 반환 |

#### AI 연동 함수
| 함수 | 역할 |
|------|------|
| `buildKvPrompt()` | KV 텍스트 추출용 AI 프롬프트 생성 |
| `tryApplyKvJson()` | AI 응답 JSON 블록 파싱 → KV 필드 자동 채움 |
| `tryAutoFillKvFromSource()` | 정규식으로 원문에서 KV 데이터 추출 |
| `parseJobPostContent()` | 채용공고 텍스트 파싱 (공고번호/기업명/날짜 등) |
| `forceAutoFillKv()` | 자동 채우기 강제 재실행 |
| `pickBgImageByKeywords()` | 17개 업종 키워드 → 배경 이미지 자동 선택 |
| `suggestImageKeyword()` | 채용공고 → 영어 이미지 검색 키워드 추천 |
| `isKvFieldDefault()` | KV 필드 기본값 여부 확인 |

#### 내보내기 함수
| 함수 | 역할 |
|------|------|
| `downloadKvImage()` | html2canvas로 PNG/JPG 다운로드 (2x/4x 스케일) |
| `downloadKvHtml()` | 독립 실행형 HTML 파일 다운로드 |
| `copyKvToClipboard()` | KV 이미지를 클립보드에 복사 |
| `openKvPreviewPopup()` | KV를 새 창으로 열기 |
| `generateKvHtml()` | KV HTML 코드 문자열 생성 |
| `getKvCardStyles()` | 스타일시트에서 KV CSS 규칙 추출 |
| `buildCopyButtons()` | HTML/미리보기/KV 복사 버튼 그룹 생성 |

#### 이미지 검색 함수
| 함수 | 역할 |
|------|------|
| `searchKvImages()` | Unsplash/Pexels 통합 검색 |
| `searchUnsplash()` | Unsplash API 검색 |
| `searchPexels()` | Pexels API 검색 |
| `renderImageResults()` | 이미지 검색 결과 그리드 렌더링 |
| `updateImgSearchKeyWarning()` | API 키 미설정 경고 표시 |

#### 텍스트 처리 함수
| 함수 | 역할 |
|------|------|
| `smartWrapKorean()` | 한국어 텍스트 최대 3줄 자동 분리 |
| `wrapText()` | 텍스트 줄바꿈 (최대 3줄) |

### CSS 반응형 폰트
```css
.kv-card .kv-title-text {
  font-size: clamp(14px, 5cqi, 28px);  /* Container Query Inline */
}
```
- `container-type: inline-size` 적용
- 카드 폭에 비례하여 폰트 크기 자동 조절
- 최소/최대 크기 보장 (`clamp`)

### 외부 의존성
- **html2canvas 1.4.1** (CDN): 프리뷰 → PNG/JPG 변환 + 클립보드 이미지 복사
- **Unsplash** (기본 배경 이미지): 무료 이미지 URL + 이미지 검색 API
- **Pexels** (이미지 검색): 무료 이미지 검색 API
- **Pretendard** (CDN 폰트): HTML 내보내기 시 내장

---

## 원본 대비 미구현 기능

| 기능 | 상태 | 비고 |
|------|------|------|
| ~~이미지 소스 검색 (Unsplash/Pexels)~~ | **구현 완료** | `searchKvImages()`, `searchUnsplash()`, `searchPexels()` — API 키 설정 후 사용 |
| ~~텍스트 포지션 (절대 위치 조정)~~ | **구현 완료** | `#kv-text-position-section` — 4개 필드별 left/top 슬라이더 |
| AI 어시스턴트 (대화형) | 미구현 | 별도 AI 대화형 인터페이스. 단, AI 연동은 존재 (자동 추출/자동 채우기) |
| 기업 홈페이지 이미지 크롤링 | 미구현 | 서버사이드 크롤러 필요 |
| 클립아트코리아/나노바나나AI 연동 | 미구현 | 별도 API 연동 필요 |
