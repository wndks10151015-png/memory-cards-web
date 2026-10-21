/* One deck queue for every learning entry point. Custom sessions are not active. */
(function(){
  'use strict';
  let usageLog=null,usageLength=-1,used=null,plans=new Map(),signature='';
  function invalidate(){plans.clear();signature='';usageLog=null;}
  function plan(deck,children=true){
    const sig=[DATA.length,state.log.length,Date.now()/1000|0,JSON.stringify(DECKS)].join('|');
    if(sig!==signature){plans.clear();signature=sig;}
    if(usageLog!==state.log||usageLength!==state.log.length){used=SienAnki.usage(DATA,state.log,Date.now());usageLog=state.log;usageLength=state.log.length;}
    const key=(deck?.id||'*')+':'+children;if(plans.has(key))return plans.get(key);
    const p=SienAnki.plan({cards:DATA,decks:children?DECKS:DECKS.filter(d=>d.id===deck?.id),states:state.cards,logs:state.log,deck,used,eligible:c=>!offed(c)});plans.set(key,p);return p;
  }
  getDeckOptions=deck=>SienAnki.options(deck,DECKS);deckDailyPlan=plan;
  getTodayStudiedCounts=deck=>{const s=plan(deck).stats;return{studiedNew:s.studiedNew,studiedReview:s.studiedReview};};
  getDeckStats=(deck,children=true)=>plan(deck,children).stats;
  const oldDirty=setDirty;setDirty=function(v){if(v)invalidate();return oldDirty(v);};
  playDeck=function(deck){
    invalidate();const p=plan(deck);if(!p.cards.length){toast('오늘 이 덱의 학습을 마쳤습니다.');return;}
    curSess={id:'anki:'+(deck?.id||'all'),sienDeckId:deck?.id||null,name:deck?.name||'모든 덱',q:[],how:{status:['all'],order:'anki'},scope:{},mode:'anki',pg:{day:todayKey(),n:0}};
    viewSess=null;curPreset=asPreset(curSess);lastPlaySid=curSess.id;queue=p.cards.slice();qPos=0;
    sessionDone=0;doneCredited=0;newServed=0;undoSnap=null;undoRun++;updateUndo();sessReset();lastAction=null;curTopic=null;
    go('scrSolve');showCard();window.SienApp?.capture();
  };
  playSess=s=>playDeck(DECKS.find(d=>d.id===s?.sienDeckId)||null);
  startAdHoc=cards=>playDeck(DECKS.find(d=>d.id===cards?.[0]?.deckId)||null);playDeckAgain=playDeck;
  finishSess=function(){clearResume();lastAction=null;push();go('scrHome');};
  creditDone=function(){};pgBump=function(){};syncSessQueue=function(){};
  saveSessions=function(){};saveSessionsSoon=function(){};saveSessionsFlush=function(){};
  normalizeSessions=function(){sessions=[];};coalesceDeckSessions=function(){};cleanupTempSessions=function(){};
  refillSess=function(){};resyncQueues=()=>({add:0,del:0});sessRemain=s=>plan(DECKS.find(d=>d.id===s?.sienDeckId)||null).cards.length;
  renderSessRows=function(){if($('sessList'))$('sessList').replaceChildren();};
  renderTodayAgainSection=function(){if($('todayAgainBox'))$('todayAgainBox').replaceChildren();};
  renderPlanWarn=function(){};basisCheck=function(){};isRestDay=()=>false;
  renderHelpToc=function(){};
  todayTileCount=()=>dailyStudyPlans().reduce((n,p)=>n+p.stats.new+p.stats.learn+p.stats.due,0);
  dueTodayCount=()=>dailyStudyPlans().reduce((n,p)=>n+p.stats.learn+p.stats.due,0);
  tomorrowCount=()=>DATA.filter(c=>!retired(c)&&!offed(c)&&state.cards[c.id]?.fsrs&&SienSM2.dayNumber(state.cards[c.id].fsrs.due)===SienSM2.dayNumber(Date.now())+1).length;
  hintLocks=()=>false;renderHintBox=function(){if($('hintBox'))$('hintBox').classList.remove('on');};
  clampDue=date=>date;
  forgetCard=function(c){const s=st(c.id);delete s.sm2;setBase(s,null,c.id);};
  offCard=function(c,value){const s=st(c.id);s.retired=value;if(!value&&s.ann)s.ann=s.ann.filter(x=>x!=='끄기');touch(s);cacheState();setDirty(true);};
  $('rOff').onclick=()=>{const c=cur();if(!c)return;const sn=dropSnap(c);offCard(c,true);dropFromQueue(c.id);removeCurFromQueue(sn);toast('카드를 일시 중단했습니다. 되돌릴 수 있습니다.');};
  syncGradeButtons=function(){for(const id of ['gAgain','gHard','gGood','gEasy'])$(id)?.classList.remove('dim');};
  isLeech=c=>!!state.cards[c.id]?.sm2?.leech;
  whyNow=function(c){const s=state.cards[c.id],k=SienAnki.kind(s);if(k==='new')return '신규 카드';if(k==='learning'||k==='interday')return SienLearning.ahead(c)?'학습 미리 보기':'학습 카드';return '복습일 '+mdY(s.fsrs.due);};
  counts=function(){
    let n=0,l=0,r=0;for(const c of queue.slice(qPos).filter(c=>SienLearning.queued(c))){const k=SienAnki.kind(state.cards[c.id]);if(k==='new')n++;else if(k==='review')r++;else if(k==='interday'||Date.parse(state.cards[c.id].fsrs.due)<=Date.now()+1200000)l++;}
    $('tbSess').textContent=curSess?.name||'';$('tbCounts').innerHTML=`<span style="color:var(--c-blue)">${n}</span> + <span style="color:var(--c-orange)">${l}</span> + <span style="color:var(--c-green)">${r}</span>`;
    $('tbCounts').title='신규 + 학습 + 복습';$('tbBar').style.width='0%';$('tbReCount').hidden=true;
  };
  renderHero=function(){
    const p=dailyStudyPlans().find(p=>p.stats.new+p.stats.due+p.stats.learn>0),box=$('hHero');
    if(!p){box.innerHTML='<section class="hero done"><div class="hero-b"><span class="hero-t">오늘 학습을 마쳤습니다</span><span class="hero-s">예정된 학습·복습 시각에 다시 확인해 주세요.</span></div></section>';return;}
    const s=p.stats;box.innerHTML=`<section class="hero"><div class="hero-b"><span class="hero-k">학습 대기</span><span class="hero-t">${esc(p.deck.name)}</span><span class="hero-s">신규 ${s.new} · 학습 ${s.learn} · 복습 ${s.due}</span></div><button class="hero-go" id="heroGo">학습 시작</button></section>`;
    $('heroGo').onclick=()=>playDeck(p.deck);
  };
  const oldGo=go;go=function(id){return oldGo(['scrSession','scrWeak','scrYm'].includes(id)?'scrHome':id);};tryResume=function(){return false;};
  // Remove the custom learning controls. Legacy anchors remain hidden for old UI handlers.
  $('btnNewSess')?.parentElement.setAttribute('hidden','');$('sessList')?.setAttribute('hidden','');
  for(const id of ['todayAgainBox','scrSession','scrWeak','scrYm','smNew','rHint','rNextNew','restToday','rOffAll'])$(id)?.setAttribute('hidden','');
  for(const id of ['tglReshow','restDow','restDate','intakeCap','retRange','cretRange','xretRange','fwBox'])$(id)?.closest('.field,.tgl-row')?.setAttribute('hidden','');
  for(const el of document.querySelectorAll('[data-go="scrWeak"],[data-go="scrYm"],[data-go="scrSession"]'))el.remove();
  const help=$('scrHelp')?.querySelector('.sub-inner');if(help)help.innerHTML='<h2>Anki SM-2 학습</h2><p>신규 카드와 복습 카드를 덱 옵션의 순서로 섞습니다. 시간이 된 학습 카드가 먼저 나오며, 다른 카드가 끝나면 20분 이내의 학습 카드를 미리 보여 줍니다.</p><p>정답을 공개한 뒤 다시·어려움·알맞음·쉬움으로 답변합니다. 버튼에 표시되는 간격과 실제 다음 복습 일정은 같은 계산을 사용합니다.</p><p>단계·간격·하루 한도·수집 및 표시 순서는 덱 메뉴의 학습 옵션에서 바꿉니다. 카드 일시 중단·내일로 묻기·되돌리기를 지원합니다.</p><p>새로 고침이나 기기 변경으로 기존 복습 일정이 다시 계산되지는 않습니다. 기록은 기존 GitHub 동기화를 사용합니다.</p>';
  window.SienAnkiUI={invalidate,plan};
})();
