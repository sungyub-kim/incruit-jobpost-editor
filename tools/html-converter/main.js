const state = {
    showJobId: false,
    jobIdText: 'NO-2026-001',
    jobIdAlign: 'left',
    jobIdColor: '#000000',
    jobIdTop: 10,
    showDate: false,
    dateText: '2026년 0월 00일',
    institutionText: '기관명',
    dateAlign: 'left',
    dateColor: '#000000',
    dateTop: 20,
    thColor: '#f1f5f9',
    thTextColor: '#000000',
    titleStyle: 'iconNumber',
    titleColor: '#6366f1',
    iconNumber: '1',
    iconBg: '1',
    titleSub: '1',
    // 서브 타이틀 전용 속성 추가
    subTitleTextColor: '#000000',
    subTitleLineColor: '#cbd1da',
    subTitleBgColor: '#e6f2ff',
    subTitleShadowColor: '#ff460a',
    htmlSource: `<!-- 원본 HTML 소스를 여기에 입력하세요 -->
<div id="templwrap_v3">
    <div class="sec_wrap sec1">
        <!-- 타이틀 예시 구조 -->
        <div class="sec_title_wrap">
            <span class="sec_title_icon"></span>
            <div class="sec_title">
                <h3>공고 타이틀 영역</h3>
            </div>
        </div>
        
        <div class="job-notice">
            <img src="https://via.placeholder.com/800x200/ef4444/ffffff?text=TOP+BANNER+IMAGE" class="top_img_v2" style="width:100%;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr><th style="border: 1px solid #ddd; padding: 12px; text-align: left;">분류</th><th style="border: 1px solid #ddd; padding: 12px; text-align: left;">내용</th></tr>
                </thead>
                <tbody>
                    <tr><td style="border: 1px solid #ddd; padding: 12px;">직무</td><td style="border: 1px solid #ddd; padding: 12px;">AI 엔지니어</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>`
};

const titleOptions = {
    iconNumber: Array.from({ length: 12 }, (_, i) => (i + 1).toString()),
    iconBg: Array.from({ length: 18 }, (_, i) => (i + 1).toString()),
    titleSub: Array.from({ length: 8 }, (_, i) => (i + 1).toString())
};

function init() {
    const controlsContainer = document.querySelector('.controls');
    const previewBox = document.getElementById('preview');
    const codeDisplay = document.getElementById('code-display');
    const copyBtn = document.getElementById('copy-btn');

    if (!controlsContainer || !previewBox || !codeDisplay || !copyBtn) {
        return;
    }

    function renderControls() {
        controlsContainer.innerHTML = '';
        
        // 1. 공고번호
        controlsContainer.appendChild(createGroup('1. 이미지에 공고번호 노출', 'checkbox', 'showJobId'));
        if (state.showJobId) {
            const sub = document.createElement('div');
            sub.className = 'sub-group';
            sub.appendChild(createGroup('공고번호 입력', 'text', 'jobIdText'));
            sub.appendChild(createGroup('상단 위치 (%)', 'range', 'jobIdTop', { min: 0, max: 100 }));
            sub.appendChild(createGroup('정렬', 'radio', 'jobIdAlign', ['left', 'center']));
            sub.appendChild(createGroup('텍스트 색상', 'color', 'jobIdColor'));
            controlsContainer.appendChild(sub);
        }

        // 2. 날짜
        controlsContainer.appendChild(createGroup('2. 이미지에 날짜 노출', 'checkbox', 'showDate'));
        if (state.showDate) {
            const sub = document.createElement('div');
            sub.className = 'sub-group';
            sub.appendChild(createGroup('날짜 입력', 'text', 'dateText'));
            sub.appendChild(createGroup('기관명 입력', 'text', 'institutionText'));
            sub.appendChild(createGroup('상단 위치 (%)', 'range', 'dateTop', { min: 0, max: 100 }));
            sub.appendChild(createGroup('정렬', 'radio', 'dateAlign', ['left', 'center']));
            sub.appendChild(createGroup('텍스트 색상', 'color', 'dateColor'));
            controlsContainer.appendChild(sub);
        }

        // 3. 테이블 th 색상
        controlsContainer.appendChild(createGroup('3. 테이블 배경 색상 (th)', 'color', 'thColor'));
        controlsContainer.appendChild(createGroup('테이블 텍스트 색상 (th)', 'color', 'thTextColor'));

        // 4. 타이틀 스타일
        controlsContainer.appendChild(createGroup('4. 타이틀 스타일 타입', 'select', 'titleStyle', ['iconNumber', 'iconBg', 'titleSub']));
        const sub4 = document.createElement('div');
        sub4.className = 'sub-group';
        
        if (state.titleStyle !== 'titleSub') {
            sub4.appendChild(createGroup('아이콘 색상', 'color', 'titleColor'));
        }

        if (state.titleStyle === 'iconNumber') {
            sub4.appendChild(createGroup('아이콘 숫자 선택', 'select', 'iconNumber', titleOptions.iconNumber));
        } else if (state.titleStyle === 'iconBg') {
            sub4.appendChild(createGroup('아이콘 BG 선택', 'select', 'iconBg', titleOptions.iconBg));
        } else if (state.titleStyle === 'titleSub') {
            sub4.appendChild(createGroup('타이틀 선택', 'select', 'titleSub', titleOptions.titleSub));
            
            // 타이틀 선택 세부 옵션
            if (state.titleSub === '1') {
                sub4.appendChild(createGroup('글자 색상', 'color', 'subTitleTextColor'));
                sub4.appendChild(createGroup('하단 라인 색상', 'color', 'subTitleLineColor'));
            } else if (state.titleSub === '2') {
                sub4.appendChild(createGroup('배경 색상', 'color', 'subTitleBgColor'));
                sub4.appendChild(createGroup('글자 색상', 'color', 'subTitleTextColor'));
                sub4.appendChild(createGroup('라인 색상', 'color', 'subTitleLineColor'));
            } else if (state.titleSub === '3') {
                sub4.appendChild(createGroup('글자 색상', 'color', 'subTitleTextColor'));
                sub4.appendChild(createGroup('라인 색상', 'color', 'subTitleLineColor'));
                sub4.appendChild(createGroup('그림자 색상', 'color', 'subTitleShadowColor'));
            } else if (state.titleSub === '4') {
                sub4.appendChild(createGroup('숫자 배경 색상', 'color', 'subTitleBgColor'));
                sub4.appendChild(createGroup('숫자 글자 색상', 'color', 'subTitleTextColor'));
            } else if (state.titleSub === '5') {
                sub4.appendChild(createGroup('배경 색상', 'color', 'subTitleBgColor'));
                sub4.appendChild(createGroup('글자 색상', 'color', 'subTitleTextColor'));
            } else if (state.titleSub === '6') {
                sub4.appendChild(createGroup('숫자 배경 색상', 'color', 'subTitleBgColor'));
                sub4.appendChild(createGroup('라인 색상', 'color', 'subTitleLineColor'));
            } else if (state.titleSub === '7') {
                sub4.appendChild(createGroup('배경 색상', 'color', 'subTitleBgColor'));
            } else if (state.titleSub === '8') {
                sub4.appendChild(createGroup('배경 색상', 'color', 'subTitleBgColor'));
                sub4.appendChild(createGroup('블릿 색상', 'color', 'subTitleLineColor'));
            }
        }
        controlsContainer.appendChild(sub4);

        // 5. HTML 소스 입력
        controlsContainer.appendChild(createGroup('5. HTML 소스 입력', 'textarea', 'htmlSource'));
    }

    function createGroup(label, type, key, options) {
        const div = document.createElement('div');
        div.className = 'control-group';
        
        if (type === 'checkbox') {
            const item = document.createElement('label');
            item.className = 'checkbox-item';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = state[key];
            input.onchange = (e) => { state[key] = e.target.checked; renderControls(); update(); };
            item.appendChild(input);
            item.appendChild(document.createTextNode(' ' + label));
            div.appendChild(item);
        } else if (type === 'radio') {
            const lbl = document.createElement('label');
            lbl.textContent = label;
            div.appendChild(lbl);
            const rg = document.createElement('div');
            rg.className = 'radio-group';
            options.forEach(opt => {
                const item = document.createElement('label');
                item.className = 'radio-item';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = key; 
                input.value = opt;
                input.checked = state[key] === opt;
                input.onchange = (e) => { state[key] = e.target.value; update(); };
                item.appendChild(input);
                item.appendChild(document.createTextNode(opt === 'left' ? '왼쪽' : '가운데'));
                rg.appendChild(item);
            });
            div.appendChild(rg);
        } else if (type === 'color') {
            const lbl = document.createElement('label');
            lbl.textContent = label;
            div.appendChild(lbl);
            const input = document.createElement('input');
            input.type = 'color';
            input.value = state[key];
            input.oninput = (e) => { state[key] = e.target.value; update(); };
            div.appendChild(input);
        } else if (type === 'range') {
            const lbl = document.createElement('label');
            lbl.textContent = `${label} (${state[key]}%)`;
            div.appendChild(lbl);
            const input = document.createElement('input');
            input.type = 'range';
            input.min = options.min || 0;
            input.max = options.max || 100;
            input.value = state[key];
            input.oninput = (e) => { 
                state[key] = e.target.value; 
                lbl.textContent = `${label} (${state[key]}%)`;
                update(); 
            };
            div.appendChild(input);
        } else if (type === 'select') {
            const lbl = document.createElement('label');
            lbl.textContent = label;
            div.appendChild(lbl);
            const select = document.createElement('select');
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt === 'iconNumber' ? '아이콘 숫자' : 
                              opt === 'iconBg' ? '아이콘 BG' : 
                              opt === 'titleSub' ? '숫자 + 타이틀' : opt;
                select.appendChild(o);
            });
            select.value = state[key];
            select.onchange = (e) => { state[key] = e.target.value; renderControls(); update(); };
            div.appendChild(select);
        } else if (type === 'text') {
            const lbl = document.createElement('label');
            lbl.textContent = label;
            div.appendChild(lbl);
            const input = document.createElement('input');
            input.type = 'text';
            input.value = state[key];
            input.oninput = (e) => { state[key] = e.target.value; update(); };
            div.appendChild(input);
        } else if (type === 'textarea') {
            const lbl = document.createElement('label');
            lbl.textContent = label;
            div.appendChild(lbl);
            const textarea = document.createElement('textarea');
            textarea.value = state[key];
            textarea.oninput = (e) => { state[key] = e.target.value; update(); };
            div.appendChild(textarea);
        }
        return div;
    }

    function update() {
        const parser = new DOMParser();
        const doc = parser.parseFromString(state.htmlSource, 'text/html');
        
        // 이미지 래핑 로직
        const topImg = doc.querySelector('.top_img_v2');
        if (topImg) {
            const header = doc.createElement('div');
            header.className = 'templ_header';
            header.style.position = 'relative'; 
            topImg.parentNode.insertBefore(header, topImg);
            header.appendChild(topImg);

            if (state.showJobId) {
                const pNum = doc.createElement('p');
                pNum.className = 'templ_num';
                pNum.textContent = state.jobIdText;
                pNum.style.textAlign = state.jobIdAlign;
                pNum.style.color = state.jobIdColor;
                header.insertBefore(pNum, topImg);
            }

            if (state.showDate) {
                const pDate = doc.createElement('p');
                pDate.className = 'templ_date';
                pDate.innerHTML = `${state.dateText} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ㅣ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${state.institutionText}`;
                pDate.style.textAlign = state.dateAlign;
                pDate.style.color = state.dateColor;
                header.insertBefore(pDate, topImg);
            }
        }

        // sec_wrap > sec_title_wrap 처리 로직
        const secTitleWraps = doc.querySelectorAll('.sec_wrap .sec_title_wrap');
        secTitleWraps.forEach(wrap => {
            const iconWrap = wrap.querySelector('.sec_title_icon');
            
            if (state.titleStyle === 'iconNumber') {
                wrap.className = 'sec_title_wrap title_bg title_num';
                if (iconWrap) {
                    iconWrap.innerHTML = ''; 
                    const spanNum = doc.createElement('span');
                    spanNum.className = `num${state.iconNumber}`;
                    iconWrap.appendChild(spanNum);
                }
                const h3 = wrap.querySelector('h3');
                if (h3) {
                    h3.textContent = h3.textContent.trim().replace(/^[\d\.\s]+/, '');
                }
            } else if (state.titleStyle === 'iconBg') {
                wrap.className = 'sec_title_wrap title_bg';
                if (iconWrap) {
                    iconWrap.innerHTML = '';
                    const spanBul = doc.createElement('span');
                    spanBul.className = `bul_${state.iconBg}`;
                    iconWrap.appendChild(spanBul);
                }
                const h3 = wrap.querySelector('h3');
                if (h3) {
                    h3.textContent = h3.textContent.trim().replace(/^[\d\.\s]+/, '');
                }
            } else if (state.titleStyle === 'titleSub') {
                wrap.className = `sec_title_wrap c_title_wrap c_title_${state.titleSub}`;
                if (iconWrap) {
                    iconWrap.innerHTML = '';
                }

                // 부모 .sec_wrap의 클래스(sec1, sec2...)에서 숫자 추출하여 h3에 적용
                const parentSec = wrap.closest('.sec_wrap');
                if (parentSec) {
                    const secClass = Array.from(parentSec.classList).find(c => /^sec\d+$/.test(c));
                    if (secClass) {
                        const num = secClass.replace('sec', '');
                        const h3 = wrap.querySelector('h3');
                        if (h3) {
                            const cleanText = h3.textContent.trim().replace(/^[\d\.\s]+/, '');
                            if (['4', '6'].includes(state.titleSub)) {
                                h3.innerHTML = `<span class="title_num">${num}</span>${cleanText}`;
                            } else {
                                h3.textContent = `${num}. ${cleanText}`;
                            }
                        }
                    }
                }
            }
        });
        
        // CSS 생성 - 활성화된 스타일만 포함하도록 수정
        let dynamicStyles = `
            #templwrap_v3 th { 
                background-color: ${state.thColor} !important; 
                color: ${state.thTextColor} !important;
            }
        `;

        if (state.showJobId || state.showDate) {
            dynamicStyles += `
                #templwrap_v3 .templ_header {
                    padding: 0;
                    position: relative;
                    line-height: 0;
                }
            `;
            
            if (state.showJobId) {
                dynamicStyles += `
                    #templwrap_v3 .templ_header .templ_num {
                        padding: 0 4.444%;
                        font-size: 15px;
                        font-weight: 400;
                        color: ${state.jobIdColor};
                        position: absolute;
                        top: ${state.jobIdTop}%;
                        left: 0;
                        right: 0;
                        text-align: ${state.jobIdAlign};
                        margin: 0;
                        line-height: 1.5;
                    }
                `;
            }

            if (state.showDate) {
                dynamicStyles += `
                    #templwrap_v3 .templ_header .templ_date {
                        padding: 0 4.444%;
                        font-size: 15px;
                        font-weight: 700;
                        color: ${state.dateColor};
                        position: absolute;
                        top: ${state.dateTop}%;
                        left: 0;
                        right: 0;
                        text-align: ${state.dateAlign};
                        margin: 0;
                        line-height: 1.5;
                    }
                `;
            }
        }

        if (state.titleStyle === 'iconNumber' || state.titleStyle === 'iconBg') {
            dynamicStyles += `
                #templwrap_v3 .sec_title_icon span[class^="num"],
                #templwrap_v3 .sec_title_icon span[class^="bul"] {
                    background-color: ${state.titleColor} !important;
                    display: block;
                }
            `;
        }

        if (state.titleStyle === 'titleSub') {
            if (state.titleSub === '1') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_1 h3 {
                        border-bottom: 3px solid ${state.subTitleLineColor};
                        color: ${state.subTitleTextColor};
                        padding: 0 10px 5px 10px;
                        display: inline-block;
                    }
                `;
            } else if (state.titleSub === '2') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_2 h3 {
                        background: ${state.subTitleBgColor};
                        color: ${state.subTitleTextColor};
                        border-top: solid 1px ${state.subTitleLineColor};
                        border-bottom: solid 1px ${state.subTitleLineColor};
                        padding: 10px;
                        display: block;
                    }
                `;
            } else if (state.titleSub === '3') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_3 h3 {
                        padding: 0 10px;
                        border: 1px solid ${state.subTitleLineColor};
                        color: ${state.subTitleTextColor};
                        box-shadow: 4px 4px 0 ${state.subTitleShadowColor};
                        display: inline-block;
                    }
                `;
            } else if (state.titleSub === '4') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_4 h3 .title_num {
                        background: ${state.subTitleBgColor};
                        color: ${state.subTitleTextColor};
                        display: inline-block;
                        padding: 0 14px 0 12px;
                        margin-right: 10px;
                    }
                `;
            } else if (state.titleSub === '5') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_5 h3 {
                        background: ${state.subTitleBgColor};
                        padding: 0 30px 0 10px;
                        position: relative;
                        color: ${state.subTitleTextColor};
                        display: inline-block;
                        line-height: 40px;
                    }
                    #templwrap_v3 .c_title_5 h3:before {
                        content: "";
                        position: absolute;
                        right: -14px;
                        top: 6px;
                        height: 28px;
                        width: 28px;
                        background: ${state.subTitleBgColor};
                        transform: rotate(-45deg);
                        z-index: 1;
                    }
                `;
            } else if (state.titleSub === '6') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_6 h3 {
                        border-bottom-color: ${state.subTitleLineColor};
                    }
                    #templwrap_v3 .c_title_6 h3 .title_num {
                        background: ${state.subTitleBgColor};
                    }
                    #templwrap_v3 .c_title_6 h3 .title_num:after {
                        border-right-color: ${state.subTitleLineColor};
                        border-left-color: ${state.subTitleBgColor};
                    }
                `;
            } else if (state.titleSub === '7') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_7 h3:before {
                        background: ${state.subTitleBgColor};
                    }
                `;
            } else if (state.titleSub === '8') {
                dynamicStyles += `
                    #templwrap_v3 .c_title_8 h3 {
                        background: ${state.subTitleBgColor};
                    }
                    #templwrap_v3 .c_title_8 h3:before {
                        background: ${state.subTitleLineColor};
                    }
                `;
            }
        }

        const finalHtml = `
<div id="templwrap_v3">
    <div class="generated-wrapper" style="padding: 20px; background: white;">
        ${doc.body.innerHTML}
    </div>
    <style>${dynamicStyles.trim().replace(/\s+/g, ' ')}</style>
</div>`.trim();
        
        previewBox.innerHTML = finalHtml;
        codeDisplay.textContent = finalHtml;
    }

    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(codeDisplay.textContent);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '복사 성공!';
            copyBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);
        } catch (err) {
            alert('복사 실패: ' + err);
        }
    };

    renderControls();
    update();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
