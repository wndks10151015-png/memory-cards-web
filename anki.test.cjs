const test=require('node:test'),assert=require('node:assert/strict'),M=require('./sien-sm2'),A=require('./sien-anki'),Day=require('./sien-day');
const oracle=require('./anki-oracle-cases.json'),qOracle=require('./anki-queue-oracle.json');
test('144 next-state results match installed Anki 26.09.3, including its real fuzz RNG',()=>{
 const now=Date.parse('2026-10-21T03:00:00Z');
 for(const c of oracle.cases){const phase={new:0,learn:1,review:2,relearn:3}[c.kind],s={fsrs:{state:phase,reps:c.reps,lapses:c.lapses,scheduled_days:c.iv,due:Day.due(now,-c.late),last_review:new Date(now-c.iv*86400000).toISOString()},sm2:{v:1,ease:2.5,originEase:2.5,step:c.step,interval:Math.max(1,c.iv)}};
  for(const [g,k]of [[1,'again'],[2,'hard'],[3,'good'],[4,'easy']]){const r=M.next(s,g,now,c.id,{},true,c.options),n=c.states[k].normal;if(n.review){assert.equal(r.fsrs.state,2);assert.equal(r.days,n.review.scheduled_days);assert.equal(r.sm2.ease,n.review.ease_factor);assert.equal(r.fsrs.lapses,n.review.lapses||0);}else{assert.equal(r.fsrs.state,n.relearning?3:1);assert.equal(r.seconds,(n.learning||n.relearning.learning).scheduled_secs);if(n.relearning){assert.equal(r.sm2.interval,n.relearning.review.scheduled_days);assert.equal(r.fsrs.lapses,n.relearning.review.lapses||0);}}}
 }
});
test('twenty-five full queue orders match installed Anki including due tie-break, mixing and caps',()=>{
 const now=Date.parse(Object.values(qOracle.states)[0].fsrs.due);
 for(const c of qOracle.cases){const deck={id:'1',name:'Default',opts:c.options},p=A.plan({cards:qOracle.cards,states:qOracle.states,decks:[deck],deck,now});assert.deepEqual(p.cards.map(c=>c.id),c.expected,JSON.stringify(c.options));}
});
const now=Date.parse('2026-10-21T03:00:00Z'),decks=[{id:'p',name:'Parent',opts:{newLimit:4,reviewLimit:6}},{id:'c',name:'Parent::Child',opts:{newLimit:2,reviewLimit:3}}];
const cards=Array.from({length:8},(_,i)=>({id:String(i+1),deckId:'c',position:i}));
const states=Object.fromEntries(cards.slice(0,4).map((c,i)=>[c.id,{fsrs:{state:2,due:Day.due(now,-i),scheduled_days:10}}]));
test('child limits and oldest-due gathering apply when studying the parent',()=>{const p=A.plan({cards,decks,states,deck:decks[0],now});assert.deepEqual(p.dueCards.map(c=>c.id),['4','3','2']);assert.equal(p.newCards.length,0);});
test('intraday learning is outside daily caps; interday learning consumes review quota first',()=>{
 const s={...states,'7':{fsrs:{state:1,due:new Date(now+600000).toISOString()},sm2:{queue:'learn'}},'8':{fsrs:{state:1,due:Day.due(now,0)},sm2:{queue:'dayLearn'}}};
 const p=A.plan({cards,decks,states:s,deck:decks[0],now});assert.equal(p.dueCards.length,2);assert.ok(p.learningCards.some(c=>c.id==='8'));assert.ok(p.cards.some(c=>c.id==='7'));
});
test('every review answer consumes a daily review slot; learning repeats consume neither quota',()=>{
 const logs=[[cards[0].id,now/1000,3,{previousPhase:2}],[cards[0].id,now/1000+10,1,{previousPhase:2}],['7',now/1000+11,3,{previousPhase:1}],['8',now/1000+12,3,{previousPhase:1,previousQueue:'interday'}]];
 assert.deepEqual(A.usage(cards,logs,now).get('c'),{new:0,review:3});
});
test('new card position is independent of the downloaded array order',()=>{const p=A.plan({cards:[...cards].reverse(),states:{},decks,deck:decks[0],now});assert.deepEqual(p.newCards.map(c=>c.id),['1','2']);});
test('review lapses alone trigger leech handling; original Anki setting is tag only',()=>{
 const s={fsrs:{state:2,scheduled_days:10,reps:20,lapses:7,due:Day.due(now,0)},sm2:{v:1,ease:2.5,step:0,interval:10}};
 const r=M.next(s,1,now,'100');assert.equal(r.leeched,true);assert.equal(r.suspend,false);assert.equal(M.next(s,1,now,'100',{},true,{leechAction:0}).suspend,true);
 assert.equal(M.next({fsrs:{state:1,reps:20,lapses:7}},1,now,'100').leeched,false);
});
test('learning that crosses 04:00 becomes day learning without leaking through the quota',()=>{const t=Date.parse('2026-10-21T18:59:30Z'),r=M.next({},1,t,'100');assert.equal(r.sm2.queue,'dayLearn');assert.equal(r.fsrs.due,'2026-10-21T19:00:00.000Z');assert.equal(A.kind({fsrs:r.fsrs,sm2:r.sm2}),'interday');});
test('migrated Anki IDs use the original numeric random seed',()=>{assert.equal(M.next({},4,now,'anki_12345').days,M.next({},4,now,'12345').days);});
test('twelve actual Anki answer timestamps use the same learning fuzz',()=>{const R=require('./sien-random');for(const x of require('./anki-learning-fuzz.json')){const delay=R.learningDelay(x.id,0,x.seconds);assert.ok(x.due>=x.start+delay&&x.due<=x.end+delay);}});
test('private imported positions override downloaded order without changing the cards',()=>{const before=JSON.stringify(cards);A.setImport({schema:1,created:1790708400,cards:{'1':[101,8,0,1000],'2':[102,1,0,1000]}});const p=A.plan({cards:cards.slice(0,2),decks,states:{},deck:decks[0],now});assert.deepEqual(p.newCards.map(c=>c.id),['2','1']);assert.equal(JSON.stringify(cards),before);A.setImport({schema:1,created:0,cards:{}});});
