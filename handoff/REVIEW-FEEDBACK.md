# Review Feedback — Step 22: 테이블 들여쓰기 분리 (버그 수정)
Date: 2026-04-20
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
없음.

## Escalate to 기획자
- **버튼 배치 (정렬 근처 vs 너비 뒤)** — 개발자가 2행 맨 끝(너비 컨트롤 뒤)에 toolbar-divider와 함께 배치. 셀 단위 조작군과 테이블 단위 조작군의 시각적 분리는 타당하나, 사용자 학습성 측면에서 "정렬 근처"가 발견성이 더 나을 가능성도 있음. UX 결정 사항. 이동은 index.html 1888–1891 블록 위치 이동만으로 가능(1줄 범위).
- **width 보정 미세 개선 (`calc(100%` 재진입 처리)** — 개발자가 원본 로직의 미세 버그(2회째 들여쓰기부터 width가 margin을 못 따라감)를 고치면서 `startsWith('calc(100%')` 조건을 추가. 오버플로우 방지 의도에 부합하며, 사용자 지정 `500px` 같은 고정 너비는 해당 조건이 false라 그대로 보존됨을 코드상 확인. 다만 "기존 동작 100% 복제" 정책이 우선이라면 롤백 1줄. 기획자 승인 권장.

## Cleared

검수 범위 및 결과:

1. **`handleIndent` (8695–8758)** — `tableWrappers` 선언·수집·forEach 블록이 완전히 제거되고 2줄 주석(8707–8708)으로 대체됨. `previewContent.querySelectorAll('table')` 스캔 경로 소멸 확인. LI/P/H 블록 처리(8710–8755)는 diff상 무변경. 스트레이 참조 없음(`grep tableWrappers`는 js/app.js에서 0건, handoff MD 문서에만 잔존).
2. **`indentTable` / `outdentTable` (9842–9880)** — `this.activeTable` 널 가드(`if (!table) return;`) 정상. `.table_x` closest 폴백(`table.closest('.table_x') || table`) 정상. margin-left 누적(+18/-18), 0이 되면 `removeProperty` 처리 정상. `saveInlineEdits` / `updateHtmlCode`는 `typeof === 'function'` 방어 호출.
3. **width 보정 안전성** — 조건 `!wrapper.style.width || wrapper.style.width === '100%' || wrapper.style.width.startsWith('calc(100%')`에서 사용자 지정 `500px` 등의 고정 너비는 세 조건 모두 false이므로 건드리지 않음. outdent에서 margin이 0이 될 때의 width 제거도 `startsWith('calc(100%')`로만 제거하므로 사용자 지정 width 보존 확인.
4. **`executeCommand` switch (9804–9834)** — 신규 2 case(`indentTable` → 9832, `outdentTable` → 9833)가 기존 case 뒤에 올바르게 추가. `editHistory.pushMajor()`(9805)가 switch 진입 직후 1회 호출되므로 Undo 스냅샷 자동 포함.
5. **`index.html` 1888–1891** — `<span class="toolbar-divider">` + 2 버튼이 `ttb-row` 행 2(1788–1892) 내부, 닫는 `</div>` 바로 앞에 위치. `data-tbl="outdentTable"`(표←) / `data-tbl="indentTable"`(표→) 속성명이 switch case와 일치. 툴팁 한국어 확인("현재 표 전체를 왼쪽으로 내어쓰기" / "현재 표 전체를 오른쪽으로 들여쓰기"). `button[data-tbl]` 범용 디스패처(9058)가 자동으로 클릭을 `executeCommand`로 라우팅.
6. **스코프 / 회귀 방지** — `git diff`상 변경은 `js/app.js`와 `index.html` 2개 파일만. `handleHangingIndent`·`hanging-indent-wrap` 관련 라인은 diff에 0건. `APP_BUILD` 377 유지. `cors-proxy.py`·`convert-server.py`·`scripts/deploy.sh` 무변경.
7. **Known gap** — 브라우저 수동 3케이스 실측(셀 안 LI/P 들여쓰기 / 표→·표← 신규 버튼 / 회귀)은 개발자 세션에서 미수행 상태. 배포 전 기획자/Project Owner가 실제 에디터 UI에서 반드시 확인해야 함.

Step 22 is clear.
