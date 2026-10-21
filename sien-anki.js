/* Anki-derived queue collection, limits and display ordering.
 * Copyright Ankitects Pty Ltd and contributors. SPDX-License-Identifier: AGPL-3.0-or-later.
 * See ANKI-PARITY.md and LICENSE-ANKI.txt. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./sien-sm2'),require('./sien-queue'),require('./sien-day'));else root.SienAnki=factory(root.SienSM2,root.SienQueue,root.SienDay);})(globalThis,function(M,Q,Day){
  'use strict';
  const mask=(1n<<64n)-1n;let archive=new Map(),created=null;
  function setImport(data){if(!data||data.schema!==1||!data.cards||!Number.isFinite(data.created))throw Error('Anki 카드 순서 자료가 올바르지 않습니다.');created=data.created;archive=new Map(Object.entries(data.cards).map(([id,a])=>[id,{id:id.replace(/^anki_/,''),noteId:String(a[0]),position:a[1],ordinal:a[2],mod:a[3]}]));}
  const metadata=c=>c.anki||archive.get(c.id)||{id:c.id.replace(/^anki_/,''),noteId:c.noteId||c.id};
  function number(id){id=String(id).replace(/^anki_/,'');if(/^\d+$/.test(id))return BigInt(id);let h=14695981039346656037n;for(const c of id)h=((h^BigInt(c.codePointAt(0)))*1099511628211n)&mask;return h;}
  // Rust FnvHasher::write_i64(), SQLite signed integer order.
  function hash(...values){let h=14695981039346656037n;for(const v of values){let n=number(v)&mask;for(let i=0;i<8;i++,n>>=8n)h=((h^(n&255n))*1099511628211n)&mask;}return h>=(1n<<63n)?h-(1n<<64n):h;}
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  function kind(s){if(!s?.fsrs||!s.fsrs.state)return 'new';if(!M.learning(s))return 'review';if(s.sm2?.queue)return s.sm2.queue==='dayLearn'?'interday':'learning';return s.fsrs.last_review&&Day.number(s.fsrs.due)>Day.number(s.fsrs.last_review)?'interday':'learning';}
  function options(deck,decks){let d=deck;while(d){if(d.opts)return M.options(d.opts);const at=d.name.lastIndexOf('::');d=at<0?null:decks.find(x=>x.name===d.name.slice(0,at));}return M.options();}
  function usage(cards,logs,now){
    const out=new Map(),first=new Set(),today=Day.key(now),byId=new Map(cards.map(c=>[c.id,c]));
    const ordered=logs.every((e,i)=>!i||Day.logMs(logs[i-1])<=Day.logMs(e))?logs:[...logs].sort((a,b)=>Day.logMs(a)-Day.logMs(b));
    for(const e of ordered){const x=e[3]||{},id=e[0],introduced=x.previousPhase===0||(x.previousPhase==null&&!first.has(id)&&(x.ankiType==null||x.ankiType===0));first.add(id);if(x.re||Day.key(Day.logMs(e))!==today)continue;
      const did=x.deckId||byId.get(id)?.deckId;if(!did)continue;const d=out.get(did)||{new:0,review:0};out.set(did,d);
      if(introduced)d.new++;else if(x.previousQueue==='interday'||x.previousPhase===2||x.ankiType===1||(x.previousPhase==null&&x.ankiType==null))d.review++;
    }return out;
  }
  const belongs=(d,parent)=>d.id===parent.id||d.name.startsWith(parent.name+'::');
  function plan({cards,decks,states,logs=[],deck=null,now=Date.now(),used,eligible=()=>true}){
    const today=Day.number(now),cfg=options(deck,decks),byDeck=new Map(decks.map(d=>[d.id,d]));
    const active=decks.filter(d=>!deck||belongs(d,deck)).sort((a,b)=>cmp(a.name,b.name)),rank=new Map(active.map((d,i)=>[d.id,i]));
    used||=usage(cards,logs,now);
    const limited=decks.filter(d=>active.includes(d)||(deck&&cfg.applyAllParentLimits&&belongs(deck,d)));
    const budget=new Map(limited.map(d=>{const o=options(d,decks);let n=0,r=0;for(const [id,u]of used){const child=byDeck.get(id);if(child&&belongs(child,d)){n+=u.new;r+=u.review;}}r=Math.max(0,o.reviewLimit-r-(cfg.newCardsIgnoreReviewLimit?0:n));return[d.id,{new:Math.max(0,Math.min(o.newLimit-n,cfg.newCardsIgnoreReviewLimit?Infinity:r)),review:r}];}));
    const ancestors=c=>limited.filter(d=>{const child=byDeck.get(c.deckId);return child&&belongs(child,d);}).map(d=>budget.get(d.id));
    const selected=cards.filter(c=>rank.has(c.deckId)&&eligible(c)&&!states[c.id]?.retired&&states[c.id]?.by!==Day.key(now));
    const fresh=[],review=[],interday=[],learning=[],blocked=new Map();let totalNew=0,totalDue=0;
    for(const c of selected){const s=states[c.id],k=kind(s);if(k==='new'){fresh.push(c);totalNew++;}else if(k==='learning'){if(Date.parse(s.fsrs.due)<Date.parse(Day.due(now,1)))learning.push(c);}else if(Day.number(s.fsrs.due)<=today){(k==='interday'?interday:review).push(c);if(k==='review')totalDue++;}}
    const positions=new Map(cards.map((c,i)=>[c.id,i]));
    const salt=cfg.daySalt??(created===null?today:today-Day.number(created*1000));
    const position=c=>Number(metadata(c).position??c.position??c._i??positions.get(c.id)),ordinal=c=>Number(metadata(c).ordinal??c.ordinal??0),nid=c=>metadata(c).noteId??c.noteId??c.id;
    const due=c=>Day.number(states[c.id]?.fsrs?.due),iv=c=>states[c.id]?.fsrs?.scheduled_days||1,ease=c=>states[c.id]?.sm2?.ease||M.seed(states[c.id]).ease;
    const h=new Map(),value=c=>{if(!h.has(c.id))h.set(c.id,hash(metadata(c).id,(!states[c.id]?.sm2&&metadata(c).mod)||Math.floor((Date.parse(states[c.id]?.u||c.updatedAt||'1970-01-01')||0)/1000)));return h.get(c.id);};
    const random=(a,b)=>cmp(value(a),value(b))||cmp(a.id,b.id),deckOrder=(a,b)=>rank.get(a.deckId)-rank.get(b.deckId);
    const relative=c=>states[c.id]?.fsrs?.scheduled_days?-(1+(today-due(c)+.001)/iv(c)):-Infinity;
    const reviewCmp=(a,b)=>{let n=0;switch(cfg.reviewOrder){case 1:n=due(a)-due(b)||deckOrder(a,b);break;case 2:n=deckOrder(a,b)||due(a)-due(b);break;case 3:n=iv(a)-iv(b);break;case 4:n=iv(b)-iv(a);break;case 5:n=ease(a)-ease(b);break;case 6:n=ease(b)-ease(a);break;case 8:break;case 9:n=cmp(number(nid(a)),number(nid(b)))||ordinal(a)-ordinal(b);break;case 10:n=cmp(number(nid(b)),number(nid(a)))||ordinal(a)-ordinal(b);break;case 12:n=cmp(relative(a),relative(b));break;default:n=due(a)-due(b);}return n||random(a,b);};
    review.sort(reviewCmp);interday.sort(reviewCmp);
    const rndNotes=(a,b)=>cmp(hash(nid(a),salt),hash(nid(b),salt))||ordinal(a)-ordinal(b),rndCards=(a,b)=>cmp(hash(metadata(a).id,salt),hash(metadata(b).id,salt));
    fresh.sort((a,b)=>{switch(cfg.newGather){case 1:return position(a)-position(b)||ordinal(a)-ordinal(b);case 2:return position(b)-position(a)||ordinal(a)-ordinal(b);case 3:return rndNotes(a,b);case 4:return rndCards(a,b);case 5:return deckOrder(a,b)||rndNotes(a,b);default:return deckOrder(a,b)||position(a)-position(b)||ordinal(a)-ordinal(b);}});
    function collect(list,isNew){return list.filter(c=>{const bs=ancestors(c),k=kind(states[c.id]),b=blocked.get(nid(c));if(b?.has(k)||bs.some(x=>x[isNew?'new':'review']<=0))return false;for(const x of bs){x[isNew?'new':'review']--;if(!isNew&&!cfg.newCardsIgnoreReviewLimit)x.new=Math.min(x.new,x.review);}const o=options(byDeck.get(c.deckId),decks),bury=new Set();if(o.buryNew)bury.add('new');if(o.buryReview)bury.add('review');if(o.buryInterday)bury.add('interday');blocked.set(nid(c),new Set([...(b||[]),...bury]));return true;});}
    const dayCards=collect(interday,false),reviewCards=collect(review,false),newCards=collect(fresh,true);
    const sortCards=(a,b)=>cmp(hash(metadata(a).id,salt)&mask,hash(metadata(b).id,salt)&mask),sortNotes=(a,b)=>cmp(hash(nid(a),salt)&mask,hash(nid(b),salt)&mask)||ordinal(a)-ordinal(b);
    if(cfg.newSort===0)newCards.sort((a,b)=>ordinal(a)-ordinal(b));if(cfg.newSort===2)newCards.sort((a,b)=>ordinal(a)-ordinal(b)||sortCards(a,b));if(cfg.newSort===3)newCards.sort(sortNotes);if(cfg.newSort===4)newCards.sort(sortCards);
    const mix=(a,b,mode)=>mode===1?a.concat(b):mode===2?b.concat(a):Q.interleave(a,b);
    const main=mix(mix(reviewCards,dayCards,cfg.interdayMix),newCards,cfg.newMix);
    learning.sort((a,b)=>Number(!states[a.id]?.fsrs?.reps)-Number(!states[b.id]?.fsrs?.reps)||Date.parse(states[a.id].fsrs.due)-Date.parse(states[b.id].fsrs.due)||random(a,b));
    const learningCount=learning.filter(c=>Date.parse(states[c.id].fsrs.due)<=now+(cfg.learnAhead??1200)*1000).length;
    let studiedNew=0,studiedReview=0;for(const [id,u]of used)if(rank.has(id)){studiedNew+=u.new;studiedReview+=u.review;}
    return{deck,cards:[...learning,...main],newCards,dueCards:reviewCards,learningCards:[...learning,...dayCards],stats:{total:cards.filter(c=>rank.has(c.deckId)).length,new:newCards.length,totalNew,due:reviewCards.length,totalDue,learn:learningCount+dayCards.length,again:0,studiedNew,studiedReview,opts:cfg}};
  }
  return{plan,usage,options,kind,hash,setImport,metadata};
});
