# Session Checkpoint — 2026-04-20
*다른 어떤 파일보다 먼저 이것을 읽는다. 현재 상태를 다루고 있으면 BUILD-LOG는 건너뛴다.*

---

## Where We Stopped

**build 379 배포 완료. 편집기 버그 수정 6건 + 툴바 3행 재편 (build 378·379 일괄).**

---

## 오늘 세션 성과 요약 (build 373 → 379, rhwp 스파이크·롤백 포함)

### Step 19·20 (완료·롤백)
- Step 19 스파이크: `@rhwp/core@0.7.3` WASM 브라우저 파싱 검증
- Step 20 본 통합: build 374~375 배포 → build 376 롤백 (rhwp 엔진이 샘플의 일부 표 행을 추출 못 해 데이터 누락 리스크). 방향 전환: 에디터 보강.

### Step 21 (build 377)
테이블 편집 툴바 4개 기능 추가: `셀에 표↳`, `셀 분할↓`, `행↑/↓`, `열←/→`. multi-cell 배치 편집 회귀 점검 통과.

### Step 22 (build 378·379) — 편집 모드 버그 수정 일괄

**build 378**:
- 테이블 안 LI/P 들여쓰기 시 외곽 테이블도 같이 들여쓰기되던 버그 수정 (`handleIndent` 테이블 블록 분리)
- 테이블 툴바 전용 `표←`/`표→` 버튼 추가
- 툴바 2행 → 3행 재편: (1) 표-레벨 (2) 병합/행/열 (3) 헤더/정렬/배경/테두리/너비

**build 379**:
1. 일반 들여쓰기/내어쓰기 **연속 클릭 무반응** 수정 — `handleIndent`의 LI 교체 후 `currentSelection` 갱신
2. 테이블 셀 배경색 **`적용` 버튼** 추가 — 네이티브 color picker가 셀 선택 유실시키는 문제
3. **Shift+Enter 한 번에 줄바꿈** — `handleEditableKeydown`을 `execCommand('insertLineBreak')`로 교체 (trailing-BR 문제 해결)
4. **테이블 툴바가 본문 덮는** 위치 버그 — `showToolbar`에 테이블 상단 경계 검사 추가
5. **ol 번호 증감** 기능 — `번호+`/`번호-` 버튼, `<li>` 앞 `<i></i>` 시블링 add/remove
6. **여백 추가 버튼 툴바 승격** — hover만 가능하던 `+ 여백 추가`를 플로팅 툴바 `여백` 버튼으로 승격. 현재 커서 기준 picker.

### 배포
- Cloudflare Pages 자동 (push)
- AWS EC2 runs: 24644995207 (build 377), 24645674202 (build 378), 24646497993 (build 379)

---

## 현재 프로덕션 상태

- **build 379** 배포됨 (Cloudflare Pages + AWS EC2)
- HWP/HWPX 경로: 기존 LibreOffice → convert-server.py → Vision (rhwp 완전 제거)
- 편집 모드 플로팅 툴바: ol 번호 증감, 여백 삽입, Shift+Enter 개선, 연속 들여쓰기
- 테이블 편집 툴바: 3행 레이아웃, 하위 표 / 셀 줄 분할 / 행·열 이동 / 표-레벨 들여쓰기 / 배경색 적용 버튼 / 위치 보정

---

## 다음 세션 작업 후보

### 열린 작업
1. **Mixed Content 버그 수정** — `?pipeline=v2`에서 Claude API 호출이 http proxy URL로 조립돼서 HTTPS 페이지에서 차단. 프로토콜 추론 1곳 수정.
2. **편집기 후속 후보** (보류):
   - (c) 셀 내용 드래그 이동
   - (e) 표 ↔ 텍스트 변환
3. **툴바 상시 노출 UX** (`.tbl-btn-disabled` 시각 개선)
4. `splitCellByLines` 구분자 명시 UI

### 지속 이슈 (미해결)
- 중첩 표 보존 완벽 해결 없음 (rhwp 실패 후 복귀). LibreOffice + Vision 경로가 한계 그대로.
- EC2 Linux LibreOffice HWP→PDF 실패
- Docker 베이스 이미지 취약점

### 워크플로우
- **배포는 일괄**. 수정 후 사용자 배포 지시 있을 때까지 APP_BUILD 고정, push 보류 (로컬 커밋은 OK).

---

## Resume Prompt

> You are 기획자 on incruit-jobpost-editor.
> Read handoff/SESSION-CHECKPOINT.md, then 기획자.md.
> Confirm where we stopped and what the next action is. Then wait.

---
