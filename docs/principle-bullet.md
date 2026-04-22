1. 순서 없는 리스트 (ulist)

middle dot(·, ∙, \2219): <ul class="ulist">

대시(-): <ul class="ulist dash">

※ (\203B, ※): <ul class="ulist noti">

스타(*): <ul class="ulist star">

체크(✓, &#10003;, \2713, \u2713, 0x2713, \u{2713}, \x{2713}, U+2713): 
<ul class="ulist check">

삼각형(▸, &#9656;, \25B8, \u25B8, 0x25B8, \u{25B8}, \x{25B8}, U+25B8): 
<ul class="ulist stri">

화살표(→, &#8594;, \2192 \u2192, 0x2192, \u{2192}, \x{2192}, U+2192): 
<ul class="ulist rarro">

손가락(☞, &#9758;, \261E, \u261E, 0x261E, \u{261E}, \x{261E}, U+261E): 
<ul class="ulist finger">

원형(○, &#9675;, \25CB, \u25CB, 0x25CB, \u{25CB}, \x{25CB}, U+25CB): 
<ul class="ulist cir">

검은 원(●, &#9679;, \25CF, \u25CF, 0x25CF, \u{25CF}, \x{25CF}, U+25CF): 
<ul class="ulist bcir">

작은 흰 원(◦, &#9676;, \25E6, \u25E6, 0x25E6, \u{25E6}, \x{25E6}, U+25E6): 
<ul class="ulist scir">

불렛(•, &#8901;, \2022, \u2022, 0x2022, \u{2022}, \x{2022}, U+2022): 
<ul class="ulist bull">

이중 원(◉, \25C9, \u25C9, 0x25C9, \u{25C9}, \x{25C9}, U+25C9): 
<ul class="ulist dbcir">

불스아이(◎, \25CE, \ u25CE, 0x25CE, \u{25CE}, \x{25CE}, U+25CE): 
<ul class="ulist ecir">

그림자 원(❍, &#9678;, \274D, \u274D, 0x274D, \u{274D}, \x{274D}, U+274D): 
<ul class="ulist wcc">

흰 사각형(□, &#9674;, \25A1, \u25A1, 0x25A1, \u{25A1}, \x{25A1}, U+25A1): 
<ul class="ulist sq">

검은 사각형(■, &#9673;, \25A0, \u25A0, 0x25A0, \u{25A0}, \x{25A0}, U+25A0): 
<ul class="ulist bsq">

그림자 사각형(❏, &#9677;, \274F, \u274F, 0x274F, \u{274F}, \x{274F}, U+274F): 
<ul class="ulist wsq">

이중 사각형(▣, &#9679;, \25A3, \u25A3, 0x25A3, \u{25A3}, \x{25A3}, U+25A3): 
<ul class="ulist dbsq">

흰 다이아(◇, &#9677;, \25C7, \u25C7, 0x25C7, \u{25C7}, \x{25C7}, U+25C7): 
<ul class="ulist dia">

검은 다이아(◆, &#9676;, \25C6, \u25C6, 0x25C6, \u{25C6}, \x{25C6}, U+25C6): 
<ul class="ulist bkdia">

이중 다이아(◈, &#9678;, \25C8, \u25C8, 0x25C8, \u{25C8}, \x{25C8}, U+25C8): 
<ul class="ulist dbdia">

2. 순서 있는 리스트 (olist)

1., 2. : <ol class="olist olnum">

1), 2) : <ol class="olist olhbrac">

(1), (2) : <ol class="olist olbracket">

①, ② (\2460~): <ol class="olist olcir">

가., 나. : <ol class="olist kolist">

가), 나) : <ol class="olist kohbrac">

(가), (나) : <ol class="olist kofbrac">

㉮, ㉯ (\326E~): <ol class="olist kofcir">

㉠, ㉡ (\3270~): <ol class="olist kocir">

㈀, ㈁ (\3200~): <ol class="olist kobrac">

ⓐ, ⓑ (\24D0~): <ol class="olist encir">

⒜, ⒝ (\249C~): <ol class="olist enbrac">

3. 리스트 연속성 유지 (OL Continuity):
ol 리스트 중간에 테이블이나 다른 요소가 삽입되어 번호가 끊길 경우:
다음 <ol> 태그에 set="N" (N = 이전 마지막 번호) 속성 부여.
<i></i><li> 태그 앞에 부족한 개수만큼 <i></i> 추가하여 번호 연속성을 강제로 일치시킴.