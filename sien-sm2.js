/* Anki-derived scheduling: Copyright Ankitects Pty Ltd and contributors.
 * SPDX-License-Identifier: AGPL-3.0-or-later. See LICENSE-ANKI.txt and ANKI-PARITY.md. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SienSM2=factory();})(globalThis,function(){
  'use strict';
  // Anki-style SM-2. The fsrs field is retained only as the existing sync wire format.
  const DAY=86400000,MAX=36500,copy=x=>JSON.parse(JSON.stringify(x)),F=Math.fround;
  const Random=typeof module==='object'&&module.exports?require('./sien-random'):globalThis.SienRandom;
  const DEFAULTS={newLimit:40,reviewLimit:400,learnSteps:[1,10],relearnSteps:[10],graduate:1,easy:4,initialEase:2.5,hardMultiplier:1.2,easyMultiplier:1.3,intervalMultiplier:1,maximumInterval:36500,minimumLapseInterval:1,lapseMultiplier:0,leechThreshold:8,leechAction:1,newMix:0,interdayMix:0,reviewOrder:0,newGather:0,newSort:0,buryNew:false,buryReview:false,buryInterday:false};
  function options(value={}){const out={...DEFAULTS,...value};for(const k of ['learnSteps','relearnSteps'])out[k]=Array.isArray(out[k])?out[k].map(Number).filter(n=>Number.isFinite(n)&&n>0):DEFAULTS[k].slice();return out;}
  const StudyDay=typeof module==='object'&&module.exports?require('./sien-day'):globalThis.SienDay||{
    // Cached pre-update HTML does not load sien-day.js yet. Keep its scheduler
    // functional until that page is refreshed, using the same Seoul boundary.
    number:value=>Math.floor((+new Date(value)+5*3600000)/DAY),
    due:(now,days)=>new Date((Math.floor((+new Date(now)+5*3600000)/DAY)+days)*DAY-5*3600000).toISOString()
  };
  function dayNumber(value){return StudyDay.number(value);}
  function dayDue(now,days){return StudyDay.due(now,days);}
  function jitter(key){let h=2166136261;for(const c of key){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
  function interval(value,min=1,factor=null,max=MAX){
    max=Math.max(1,Math.floor(max));min=Math.min(max,Math.max(1,min));value=Math.max(min,Math.min(max,F(value)));
    if(factor===null)return Math.min(max,Math.max(min,Math.round(value)));
    let delta=value<2.5?0:1;if(value>=2.5)for(const [start,end,mult]of [[2.5,7,.15],[7,20,.1],[20,Infinity,.05]])delta=F(delta+F(F(mult)*Math.max(0,F(Math.min(value,end)-start))));
    const lo=Math.max(min,Math.round(F(value-delta)));let hi=Math.min(max,Math.round(F(value+delta)));
    if(hi===lo&&hi>2&&hi<max)hi++;
    return Math.floor(F(lo+F(F(factor)*F(hi-lo+1))));
  }
  function seed(s,imported={}){
    const f=s?.fsrs;
    // The original migration encoded factor as 11 - factor/300 in the immutable
    // base. Current difficulty may have changed under FSRS and must not be used.
    const base=s?.base?.fsrs,d=base?.difficulty;
    const originalEase=[2,3].includes(base?.state)&&Number.isFinite(d)&&d>1&&d<=11-1300/300?Math.round((11-d)*300)/1000:null;
    const originEase=Math.max(1.3,imported.ease||originalEase||2.5);
    if(s?.sm2?.v===1&&f){
      const m=copy(s.sm2);
      // Upgrade the first SM-2 release's default seed using the saved answer grades.
      // Only ease is recovered; current due dates, counts and history stay untouched.
      if(m.originEase==null&&imported.grades?.length){
        m.ease=originEase;
        for(const e of imported.grades)if(e.phase===2)m.ease=Math.round(Math.max(1.3,m.ease+({1:-.2,2:-.15,3:0,4:.15}[e.grade]||0))*1000)/1000;
        m.originEase=originEase;
      }
      return m;
    }
    return {v:1,ease:originEase,originEase,step:f?.state===1?(imported.step??f.learning_steps??0):0,interval:Math.max(1,f?.scheduled_days||1)};
  }
  function next(s,grade,now,id='',imported={},fuzz=true,config={}){
    if(![1,2,3,4].includes(grade))throw new Error('Invalid grade');
    now=new Date(now);if(!Number.isFinite(+now))throw new Error('Invalid review time');
    const old=s?.fsrs||{},phase=old.state||0,m=seed(s,imported),cfg=options(config);
    if(!old.state)m.ease=m.originEase=cfg.initialEase;
    let state=phase,days=0,seconds=0,lapses=old.lapses||0;
    const elapsed=phase===2&&old.due?(old.scheduled_days||m.interval)+Math.max(0,dayNumber(now)-dayNumber(old.due)):old.last_review?Math.max(0,dayNumber(now)-dayNumber(old.last_review)):0;
    const rngId=m.ankiId||imported.cardId||id,random=fuzz?(Random?Random.factor(rngId,old.reps||0):jitter(id+':'+(old.reps||0))):null;
    const bound=(value,min=1,useFuzz=true)=>interval(F(F(value)*F(cfg.intervalMultiplier)),min,useFuzz?random:null,cfg.maximumInterval);
    const lapse=iv=>interval(F(Math.max(1,iv)*F(cfg.lapseMultiplier)),cfg.minimumLapseInterval,random,cfg.maximumInterval);
    const delay=(steps,index)=>{const a=Math.floor(F(F(steps[index])*60));return a>86400?Math.round(F(a/86400))*86400:a;};
    const hardDelay=(steps,index)=>index?delay(steps,index):steps.length>1?Math.floor((delay(steps,0)+delay(steps,1))/2):Math.min(Math.floor(delay(steps,0)*1.5),delay(steps,0)+86400);
    const leechMet=n=>cfg.leechThreshold>0&&n>=cfg.leechThreshold&&(n-cfg.leechThreshold)%Math.max(1,Math.ceil(cfg.leechThreshold/2))===0;
    let leeched=false;
    if(phase===2){
      const iv=Math.max(1,old.scheduled_days||m.interval),late=elapsed-iv;
      if(grade===1){state=3;m.step=0;m.interval=lapse(iv);m.ease=F(F(m.ease)-F(.2));lapses++;leeched=leechMet(lapses);if(cfg.relearnSteps.length)seconds=delay(cfg.relearnSteps,0);else{state=2;days=m.interval;}}
      else{
        let hard,good,easy;
        if(late<0){hard=bound(Math.max(F(elapsed*F(cfg.hardMultiplier)),F(iv*F(F(cfg.hardMultiplier)/2))),1,false);good=bound(Math.max(F(elapsed*F(m.ease)),iv),1,false);const reduced=F(F(cfg.easyMultiplier)-F(F(F(cfg.easyMultiplier)-1)/2));easy=bound(F(Math.max(F(elapsed*F(m.ease)),iv)*reduced),1,false);}
        else{hard=bound(F(iv*F(cfg.hardMultiplier)),cfg.hardMultiplier<=1?1:iv+1);good=bound(F(F(iv+F(late/2))*F(m.ease)),cfg.hardMultiplier<=1?iv+1:hard+1);easy=bound(F(F(F(iv+late)*F(m.ease))*F(cfg.easyMultiplier)),good+1);}
        days=[0,0,hard,good,easy][grade];if(grade===2)m.ease=F(F(m.ease)-F(.15));if(grade===4)m.ease=F(F(m.ease)+F(.15));
      }
    }else if(phase===3){
      const steps=cfg.relearnSteps,index=Math.min(Math.max(0,m.step||0),Math.max(0,steps.length-1));
      if(grade===1){m.step=0;if(steps.length){m.interval=lapse(m.interval);seconds=delay(steps,0);}else{state=2;days=m.interval;}}
      if(grade===2){if(steps.length)seconds=hardDelay(steps,index);else{state=2;days=m.interval;}}
      if(grade===3){if(index+1<steps.length){m.step=index+1;seconds=delay(steps,m.step);}else{state=2;days=m.interval;m.step=0;}}
      if(grade===4){state=2;days=m.interval+1;m.step=0;}
    }else{
      const steps=cfg.learnSteps;state=1;m.step=Math.min(Math.max(0,steps.length-1),Math.max(0,m.step));
      if(!steps.length||grade===4){state=2;days=interval(grade===4?cfg.easy:cfg.graduate,1,random,cfg.maximumInterval);m.step=0;}
      else if(grade===1){m.step=0;seconds=delay(steps,0);}
      else if(grade===2)seconds=hardDelay(steps,m.step);
      else if(m.step+1<steps.length){m.step++;seconds=delay(steps,m.step);}
      else{state=2;days=interval(cfg.graduate,1,random,cfg.maximumInterval);m.step=0;}
    }
    m.ease=Math.round(Math.max(1.3,m.ease)*1000)/1000;
    if(state===2)m.interval=days;
    let scheduledSeconds=seconds,queueKind=state===2?'review':'learn',due;
    if(seconds){const until=Math.ceil((Date.parse(dayDue(now,1))-(+now))/1000);if(seconds>=until){queueKind='dayLearn';due=dayDue(now,Math.floor((seconds-until)/86400)+1);}else{if(fuzz&&Random)scheduledSeconds=Random.learningDelay(rngId,old.reps||0,seconds);due=new Date(+now+scheduledSeconds*1000).toISOString();}}
    else due=dayDue(now,days);
    m.queue=queueKind;if(imported.cardId)m.ankiId=String(imported.cardId);
    const f={...old,due,stability:Math.max(.1,state===2?days:m.interval),difficulty:Math.max(1,Math.min(10,11-m.ease*1000/300)),elapsed_days:elapsed,scheduled_days:state===2?days:state===3?m.interval:0,learning_steps:m.step,reps:(old.reps||0)+1,lapses,state,last_review:now.toISOString()};
    return {fsrs:f,sm2:m,previousPhase:phase,seconds,scheduledSeconds,days,leeched,suspend:leeched&&cfg.leechAction===0};
  }
  function learning(s){return [1,3].includes(s?.fsrs?.state);}
  function due(s,now=Date.now()){const f=s?.fsrs;if(!f||s.retired)return false;return learning(s)?Date.parse(f.due)<=+now:dayNumber(f.due)<=dayNumber(now);}
  function label(result){if(result.seconds){const m=Math.floor(result.seconds/60),s=result.seconds%60;return (m?m+'분':'')+(s?' '+s+'초':'')+' 후';}return result.days<30?result.days+'일 후':result.days<365?(result.days/30.4).toFixed(1)+'개월 후':(result.days/365.25).toFixed(1)+'년 후';}
  return {next,seed,learning,due,label,interval,dayNumber,options,DEFAULTS};
});
