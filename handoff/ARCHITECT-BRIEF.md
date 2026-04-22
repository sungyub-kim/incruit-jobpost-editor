# Architect Brief — 들여쓰기 버그 수정: 테이블 들여쓰기 분리
*기획자 작성. 개발자 구현, 검수자 리뷰.*

---

## Step 22 — 테이블 안 LI/P 들여쓰기 시 테이블까지 같이 들여쓰기되는 버그 수정

### 증상

편집 모드에서 테이블 셀 안의 `<ul>`/`<ol>` 리스트 항목(`<li>`)이나 `<p>`에 커서를 두고 **들여쓰기/내어쓰기** 버튼을 누르면:
- 의도: 해당 `<li>` 또는 `<p>`만 들여쓰기
- 실제: LI/P **+ 그걸 감싸는 외곽 테이블 전체**가 동시에 들여쓰기됨

### 원인

`js/app.js` `handleIndent(direction, savedRange)` — **line 8695~8782**.

- line 8704~8705: `indentableTags = {P, H1..H6, LI}`로 블록 추출 — 정상
- line 8707~8732: **별도로** `previewContent.querySelectorAll('table')`를 돌아 range와 교차하는 모든 table의 `.table_x` 래퍼에 `margin-left`를 적용 — **이 블록이 버그 원인**.
- line 8712: `if (tbl.closest('td, th')) return;` — 중첩 테이블(셀 안 table)은 제외하지만, **외곽 table 자체는 TD/TH 밖에 있으므로 제외되지 않음**. range가 LI를 포함하면 외곽 table과도 교차 → 테이블 들여쓰기 적용.

### 수정 방향 (Project Owner 결정)

테이블 들여쓰기는 **별도 버튼으로 분리**. 일반 들여쓰기(LI/P/H)는 테이블에 영향 없음.

---

## 스코프 (이 스텝만)

### 포함

1. **`handleIndent`의 테이블 로직 제거** — line 8707~8732 블록 삭제. LI/P/H만 처리.
2. **테이블 툴바에 신규 버튼 2개 추가**:
   - `data-tbl="indentTable"` 라벨 `표→` (툴팁: "현재 표 전체를 오른쪽으로 들여쓰기")
   - `data-tbl="outdentTable"` 라벨 `표←` (툴팁: "현재 표 전체를 왼쪽으로 내어쓰기")
   - 위치: 테이블 툴바 2행 중 적절한 구역 (정렬 버튼들 근처 또는 배경색/테두리 근처). 개발자 판단으로 기존 `ttb-row` 구조에 자연스럽게 삽입.
3. **`tableToolbar.executeCommand` switch에 case 추가**:
   - `indentTable` → `this.indentTable()`
   - `outdentTable` → `this.outdentTable()`
4. **메서드 구현** (기존 `handleIndent`에서 삭제한 로직을 **기반으로**, 단 `activeTable`만 대상):
   - `indentTable()` / `outdentTable()` — `this.activeTable`의 `.table_x` 래퍼(없으면 `activeTable` 자체) `margin-left`를 18px씩 가감, 기존 `width: calc(100% - Npx)` 보정 로직 동일.
   - `activeTable` 없으면 no-op (경고 불필요 — 툴바가 떠 있으면 이미 activeTable 존재).

### 제외 (건드리지 말 것)

- `handleIndent`의 LI/P/H 처리 로직 — 무변경 (테이블 로직만 제거)
- 기존 테이블 툴바 버튼·메서드 — 무변경
- `handleHangingIndent`, `hanging-indent-wrap` 관련 로직 — 무변경 (별개 기능)
- PDF/Vision/HWP 업로드 경로 — 무관, 무변경
- 키보드 단축키 — 따로 바꾸지 말 것. Tab 등 단축키로 'indent'가 호출되더라도 이제 테이블은 반응 안 함 (의도된 변화).

---

## 기술 결정

- 삭제할 블록이 명확하므로 리팩터링 X. 그냥 `tableWrappers` 관련 선언·수집·forEach 3부분을 제거.
- 새 메서드 2개는 `tableToolbar` 객체에 기존 메서드 패턴(예: `moveRow`) 따라 추가. `buildGrid` 필요 없음 — 단순 style 조작.
- 단위 `18px`는 기존 값 유지 (일관성).

---

## 테스트/완료 기준

브라우저 로컬 서버(`python -m http.server`)에서 수동 확인:

1. **버그 재현 → 수정 확인**
   - 테이블 셀 안에 `<ul><li>항목1</li><li>항목2</li></ul>` 또는 `<p>단락</p>` 넣고 커서 위치
   - **들여쓰기 버튼** 클릭 → LI/P만 들여쓰기됨 (외곽 table은 margin-left 변동 없음) ✓
   - **내어쓰기 버튼** → LI/P만 복원 ✓
2. **신규 표 들여쓰기 버튼**
   - 테이블 선택 후 `표→` → `.table_x`에 margin-left:18px, width calc 적용 ✓
   - 여러 번 클릭 → 누적 증가 ✓
   - `표←` → 감소, 0이 되면 style 제거 ✓
3. **회귀 방지**
   - 테이블 밖 일반 `<p>`/`<li>` 들여쓰기 — 이전과 동일하게 동작 ✓
   - 기존 테이블 툴바 버튼들 — 이전과 동일 동작 ✓
   - Hanging indent (매달린 들여쓰기) 버튼 — 무변경 ✓

---

## 완료 후

- `handoff/REVIEW-REQUEST.md` 갱신 (Step 22)
- 검수자 → 기획자 → Project Owner 승인 → 배포 (`APP_BUILD 377 → 378`, `APP_BUILD_DATE` 갱신)

---

## Flag 총정리

- **`APP_BUILD` 증가 금지** (기획자가 배포 시)
- **`scripts/deploy.sh` 실행 금지**
- **기존 `handleIndent`의 LI/P/H 처리 로직 무변경** — 테이블 블록만 제거
- **키보드 단축키 추가 금지** — 버튼만
- **한국어 툴팁 필수**
- **기존 테이블 툴바 버튼 동작 무변경**
- Undo/Redo 스코프 외
