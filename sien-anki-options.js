/* Shared Anki deck options; existing schedules change only on the next answer. */
(function(){
  'use strict';
  const fields=[
    ['newLimit','하루 신규 한도'],['reviewLimit','하루 최대 복습'],['learnSteps','학습 단계 (분, 공백으로 구분)','steps'],['relearnSteps','재학습 단계 (분)','steps'],
    ['graduate','졸업 간격 (일)'],['easy','쉬움 간격 (일)'],['initialEase','시작 용이도'],['hardMultiplier','어려움 간격 배율'],['easyMultiplier','쉬움 보너스'],['intervalMultiplier','간격 배율'],['maximumInterval','최대 간격 (일)'],['minimumLapseInterval','실패 후 최소 간격 (일)'],['lapseMultiplier','실패 후 간격 배율'],['leechThreshold','거머리 기준 (실패 횟수, 0은 해제)'],
    ['leechAction','거머리 처리',[[1,'태그만 달기'],[0,'일시 중단']]],
    ['newGather','신규 카드 수집 순서',[[0,'덱별 오름차순 위치'],[1,'오름차순 위치'],[2,'내림차순 위치'],[3,'무작위 노트'],[4,'무작위 카드'],[5,'덱별 무작위 노트']]],
    ['newSort','신규 카드 표시 순서',[[0,'카드 유형, 수집 순서'],[1,'수집 순서'],[2,'카드 유형, 무작위'],[3,'무작위 노트, 카드 유형'],[4,'무작위 카드']]],
    ['reviewOrder','복습 카드 순서',[[0,'예정일, 무작위'],[1,'예정일, 덱'],[2,'덱, 예정일'],[3,'간격 오름차순'],[4,'간격 내림차순'],[5,'용이도 오름차순'],[6,'용이도 내림차순'],[8,'무작위'],[9,'추가한 순서'],[10,'추가한 역순'],[12,'상대 지연도']]],
    ['newMix','신규 / 복습 순서',[[0,'복습과 섞기'],[1,'복습 뒤'],[2,'복습 앞']]],['interdayMix','날짜가 바뀐 학습 / 복습 순서',[[0,'복습과 섞기'],[1,'복습 뒤'],[2,'복습 앞']]],
    ['buryNew','신규 형제 카드 묻기','check'],['buryReview','복습 형제 카드 묻기','check'],['buryInterday','날짜가 바뀐 학습 형제 카드 묻기','check'],['newCardsIgnoreReviewLimit','신규 카드의 복습 한도 무시','check'],['applyAllParentLimits','상위 덱 한도부터 적용','check']
  ];
  openDeckOptionsModal=function(deck){
    const cfg=getDeckOptions(deck),sheet=$('ovlDeckOptions').querySelector('.sheet');
    sheet.innerHTML=`<h2>덱 학습 옵션</h2><p class="desc">${esc(deck.name)} · Anki SM-2</p>`+fields.map(([k,label,t])=>`<label class="field" style="display:block;margin:14px 0">${label}${Array.isArray(t)?`<select data-anki="${k}" style="display:block;width:100%;margin-top:6px">${t.map(([v,s])=>`<option value="${v}" ${cfg[k]===v?'selected':''}>${s}</option>`).join('')}</select>`:t==='check'?` <input data-anki="${k}" type="checkbox" ${cfg[k]?'checked':''}>`:`<input data-anki="${k}" type="${t==='steps'?'text':'number'}" ${t==='steps'?'':'min="0" step="any"'} value="${t==='steps'?cfg[k].join(' '):cfg[k]}" style="display:block;width:100%;margin-top:6px">`}</label>`).join('')+'<p class="desc">기존 일정은 유지되며 다음 답변부터 적용됩니다. 학습 미리 보기: 20분.</p><div class="btn-row"><button class="btn-ghost" id="ankiReset">기본값</button><button class="btn-ghost" id="ankiCancel">취소</button><button class="btn-primary" id="ankiSave">저장</button></div>';
    const close=()=>$('ovlDeckOptions').classList.remove('show');$('ankiCancel').onclick=close;
    $('ankiReset').onclick=()=>{delete deck.opts;saveUserDecks();SienAnkiUI.invalidate();close();renderHome();};
    $('ankiSave').onclick=()=>{
      const opts={};for(const [k,,t]of fields){const el=sheet.querySelector(`[data-anki="${k}"]`);if(t==='check')opts[k]=el.checked;else if(t==='steps'){opts[k]=el.value.trim()?el.value.trim().split(/\s+/).map(Number):[];if(opts[k].some(n=>!Number.isFinite(n)||n<=0)){toast('단계는 0보다 큰 분 단위 숫자로 입력해 주세요.');return;}}else{opts[k]=Number(el.value);if(!Number.isFinite(opts[k])||opts[k]<0){toast('옵션 값을 확인해 주세요.');return;}}}
      if(opts.initialEase<1.3||opts.maximumInterval<1||opts.graduate<1||opts.easy<1){toast('용이도는 1.3 이상, 일 단위 간격은 1 이상이어야 합니다.');return;}
      deck.opts=opts;saveUserDecks();SienAnkiUI.invalidate();close();renderHome();
    };
    $('ovlDeckOptions').classList.add('show');
  };
})();
