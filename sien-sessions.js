/* Shared preferences and deck resume. Legacy sessions are inert archived data. */
(function(){
  'use strict';
  const D=SienData,copy=x=>JSON.parse(JSON.stringify(x));let shared=D.empty(),receiving=false;
  function snapshot(){
    const out=copy(shared),set=(p,v)=>{out.values[D.key(...p)]=copy(v);};
    set(['initialized','learning'],true);set(['initialized','anki-sm2'],2);
    for(const [k,v]of Object.entries({ivShow,kbdOn,keyboard:SienKeys.settings()}))set(['setting',k],v);
    if(curSess&&$('scrSolve')?.classList.contains('on'))set(['resume','last'],{deckId:curSess.sienDeckId,card:cur()?.id||null,day:todayKey()});
    return out;
  }
  function receive(data){shared=copy(D.valid(data||D.empty()));receiving=true;try{
    sessions=[];sessTomb=[];viewSess=null;
    const setting=k=>D.get(shared,'setting',k);
    if(setting('ivShow')){ivShow=copy(setting('ivShow'));applyIv();}
    if(typeof setting('kbdOn')==='boolean')kbdOn=setting('kbdOn');
    if(setting('keyboard'))SienKeys.receive(setting('keyboard'));
    const r=D.get(shared,'resume','last');if(r?.deckId)lastPlaySid='anki:'+r.deckId;
    lsSet(K_KBD,kbdOn?'1':'0');
  }finally{receiving=false;}}
  const old=lsSet;lsSet=function(k,v){const r=old(k,v);if(!receiving&&k===K_KBD)queueMicrotask(()=>window.SienApp?.capture());return r;};
  window.SienSessions={snapshot,receive,initialize:snapshot,plan:s=>deckDailyPlan(DECKS.find(d=>d.id===s?.sienDeckId)||null).cards,commit(value,ops,e){shared=D.apply(copy(value),ops,e);return shared;},get shared(){return shared;}};
})();
