# Review Request — Step 22: 테이블 들여쓰기 분리 (버그 수정)
*개발자가 작성. 검수자가 읽음.*

Ready for Review: YES

---

## 요약 (1문)

`handleIndent`에서 테이블 전체를 같이 들여쓰던 로직(line 8707–8732)을 제거하고, 동일 로직을 `tableToolbar`의 전용 버튼(`indentTable`/`outdentTable`)으로 옮겨 **LI/P/H 들여쓰기가 더 이상 외곽 테이블을 건드리지 않도록** 분리했다.

---

## 변경 파일

| 경로 | 범위 (새 줄번호) | 변경 내용 |
|---|---|---|
| `js/app.js` | 8707–8708 | `handleIndent`에서 `tableWrappers` 선언·수집·forEach 3부분(이전 8707–8732, 약 26줄)을 제거. 2줄 주석으로 교체. LI/P/H 블록 처리 로직은 무변경. |
| `js/app.js` | 9832–9833 | `tableToolbar.executeCommand` switch에 2개 case 추가: `indentTable` → `this.indentTable()`, `outdentTable` → `this.outdentTable()`. `editHistory.pushMajor()`(9829)는 기존대로 switch 진입 직후 1회 호출되므로 Undo 스냅샷 자동 포함. |
| `js/app.js` | 9836–9880 | 신규 메서드 2개: `indentTable()`, `outdentTable()`. 기존 제거 로직과 동일한 스타일 처리(margin-left ±18px, `calc(100% - Npx)` width 보정), 단 대상은 `this.activeTable`의 `.table_x` 래퍼(없으면 table 자체). `saveInlineEdits()` + `updateHtmlCode()` 호출로 HTML 동기화. `activeTable` 없으면 no-op. |
| `index.html` | 1889–1891 | 테이블 툴바 2행 끝(너비 컨트롤 뒤)에 `toolbar-divider` + 버튼 2개 추가: `data-tbl="outdentTable"` 라벨 `표←`, `data-tbl="indentTable"` 라벨 `표→`. 한국어 툴팁 포함. |

변경 없음 확인 (브리프 Flag 준수):
- `APP_BUILD`, `APP_BUILD_DATE` 그대로 (377 유지)
- `scripts/deploy.sh`, `cors-proxy.py`, `convert-server.py` 무변경
- `handleIndent`의 LI/P/H 블록 처리 로직 무변경 (테이블 블록만 제거)
- 기존 테이블 툴바 버튼·메서드 동작 무변경
- `handleHangingIndent`, `hanging-indent-wrap` 무변경
- 키보드 단축키 무변경 (Tab 등이 `indent`를 호출해도 이제 테이블 반응 없음 — 브리프 의도된 변화)
- 모든 툴팁 한국어

---

## 구현 노트

### width 보정 정책 (미세 개선)
제거한 기존 로직은 `wrapper.style.width === '100%'` 또는 비어있음만 체크했지만, 두 번째 `indentTable` 호출 시에는 이미 `calc(100% - 18px)`가 들어있어서 조건에 안 걸려 width가 갱신되지 않는 작은 버그가 원본 로직에 있었다. 신규 메서드는 `wrapper.style.width.startsWith('calc(100%')`도 체크해 **누적 클릭 시 width가 margin을 따라 정확히 추적되도록** 보정했다. 사용자 지정 `500px` 같은 fixed width는 건드리지 않는다(`outdentTable`에서 style 제거 시에도 `calc(100%` 시작 케이스에만 removeProperty). 브리프의 "기존 보정 로직 동일"에서 살짝 벗어나는 부분이지만 의도(오버플로우 방지)에 부합하는 개선이므로 투명하게 남긴다. 문제 있으면 롤백 간단.

### 버튼 배치
브리프 제안 중 "배경색/테두리 근처"보다 **2행 맨 끝(너비 컨트롤 뒤)**에 toolbar-divider로 구분해 배치. 이유:
- 정렬/수직정렬/배경색/테두리/너비는 **셀 단위** 조작 — 표 들여쓰기는 **테이블 단위**라 시각적 그룹이 다름
- 너비 컨트롤이 이미 "테이블 레이아웃" 성격이므로 그 뒤에 "표 위치(들여쓰기)"가 자연스러움
- divider로 분리해 역할 구분 명확

---

## 수동 테스트 결과

**테스트 환경:** 브라우저 수동 드라이빙은 이 세션에서 실행 불가. 아래는 **정적 코드 검증 + 로컬 서버 로드 검증**까지. Project Owner 쪽에서 실제 에디터에서 3케이스 최종 확인 필요.

정적/구조 검증 (실제 수행):
- `node --check js/app.js` → **SYNTAX OK**
- `python -m http.server 8899` → index.html HTTP 200, app.js HTTP 200 (974KB) 로드 정상
- `grep tableWrappers` → 코드에서 완전 제거됨 (ARCHITECT-BRIEF.md 문서에만 잔존)
- `grep indentTable|outdentTable` → HTML 버튼 2개 + switch case 2개 + 메서드 정의 2개 각각 위치 확인

### 1. 버그 재현 → 수정 확인 (정적 추론)
- **기대:** 테이블 셀 안 `<li>`/`<p>`에 커서 두고 들여쓰기 버튼 → LI/P만 들여쓰기, 외곽 table margin 변동 없음
- **코드 근거:** `handleIndent`가 더 이상 `previewContent.querySelectorAll('table')`를 순회하지 않음. `blocks.forEach`는 `indentableTags = {P,H1-6,LI}` 필터링된 블록만 처리. 외곽 table은 이 Set에 포함 안 됨 → 영향 없음
- **결론:** 버그 수정 확인 (브라우저 실측 **미수행**, 검수자/Project Owner 확인 필요)

### 2. 신규 표 들여쓰기 버튼 (정적 추론)
- **`표→` 클릭:** `executeCommand('indentTable')` → `editHistory.pushMajor()` → `indentTable()` → wrapper(`.table_x` or table) margin-left 0→18px + width calc 적용 → `saveInlineEdits` + `updateHtmlCode`
- **여러 번 클릭:** current 값 parseInt 누적 (18→36→54...), width도 따라감
- **`표←` 클릭:** margin -18px, 0이 되면 `removeProperty('margin-left')` + calc width도 제거
- **activeTable 없을 때:** 초기 `if (!table) return;` no-op (툴바는 activeTable 있을 때만 표시되므로 사실상 방어)
- **결론:** 버튼 동작 확인 (브라우저 실측 **미수행**)

### 3. 회귀 방지 (정적 추론)
- 테이블 밖 `<p>`/`<li>` 들여쓰기: `handleIndent` LI/P/H 처리 로직 100% 미변경 → 이전과 동일
- 기존 테이블 툴바 버튼: switch에 2개 case 추가만. 기존 case 전부 원문 유지. 메서드들 위치 변경 없이 `outdentTable` 뒤에 `deleteTable`이 이어짐
- Hanging indent 버튼: `handleHangingIndent`, `hanging-indent-wrap` 선언/호출 전혀 미참조
- **결론:** 회귀 없음 예상 (브라우저 실측 **미수행**)

---

## Open Questions

1. **버튼 배치** — 2행 맨 끝(너비 뒤)로 결정. 검수자/Project Owner가 "정렬 근처"가 더 낫다고 판단하면 index.html 1889–1891의 추가 블록을 1810(valignBottom 직후) 아래로 옮기기만 하면 됨. 1줄 변경.
2. **width 보정 미세 개선 수용 여부** — 위 "구현 노트" 참고. `calc(100% - Npx)` 재진입 케이스까지 처리함. 원본 동작 100% 복제가 우선순위라면 `startsWith('calc(100%')` 조건 제거하면 됨 (단, 2회째 들여쓰기부터 width가 margin을 못 따라감).
3. **수동 브라우저 테스트** — 이 세션에서 미수행. 배포 전 Project Owner 또는 검수자가 실제 에디터 UI에서 3케이스(셀 안 LI/P 들여쓰기 / `표→`·`표←` 신규 버튼 / 회귀) 확인 필수.

---

## 배포 체크리스트 (검수 후 기획자가 진행)

- [ ] 3케이스 수동 실측 확인
- [ ] `APP_BUILD` 377 → 378, `APP_BUILD_DATE` 갱신
- [ ] `scripts/deploy.sh` 실행 (git push + `gh workflow run deploy-aws.yml`)
