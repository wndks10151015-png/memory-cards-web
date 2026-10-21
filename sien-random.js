/* ChaCha12/PCG seed expansion used by Rust rand's StdRng.
 * Algorithm references: rust-random/rand (MIT OR Apache-2.0); see ANKI-PARITY.md. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SienRandom=factory();})(globalThis,function(){
  'use strict';
  const MASK=(1n<<64n)-1n,rot=(x,n)=>(x<<n)|(x>>>(32-n));
  function numericId(id){id=String(id).replace(/^anki_/,'');try{if(/^\d+$/.test(id))return BigInt(id)&MASK;}catch{}
    let h=14695981039346656037n;for(const c of String(id)){h=((h^BigInt(c.codePointAt(0)))*1099511628211n)&MASK;}return h;
  }
  function rng(seed){
    let pcg=BigInt(seed)&MASK;const key=[];
    for(let i=0;i<8;i++){pcg=(pcg*6364136223846793005n+11634580027462260723n)&MASK;const x=Number((((pcg>>18n)^pcg)>>27n)&0xffffffffn),r=Number(pcg>>59n);key.push(((x>>>r)|(x<<((-r)&31)))>>>0);}
    let counter=0,index=16,block=[];
    const round=(x,a,b,c,d)=>{x[a]=(x[a]+x[b])>>>0;x[d]=rot(x[d]^x[a],16)>>>0;x[c]=(x[c]+x[d])>>>0;x[b]=rot(x[b]^x[c],12)>>>0;x[a]=(x[a]+x[b])>>>0;x[d]=rot(x[d]^x[a],8)>>>0;x[c]=(x[c]+x[d])>>>0;x[b]=rot(x[b]^x[c],7)>>>0;};
    function next(){if(index===16){const initial=[0x61707865,0x3320646e,0x79622d32,0x6b206574,...key,counter++,0,0,0],x=initial.slice();for(let i=0;i<6;i++){round(x,0,4,8,12);round(x,1,5,9,13);round(x,2,6,10,14);round(x,3,7,11,15);round(x,0,5,10,15);round(x,1,6,11,12);round(x,2,7,8,13);round(x,3,4,9,14);}block=x.map((v,i)=>(v+initial[i])>>>0);index=0;}return block[index++];}
    return {next,float:()=>Math.fround((next()>>>9)/8388608),below(n){if(!(n>0))return 0;const range=BigInt(n),threshold=(4294967296n-range)%range;for(;;){const product=BigInt(next())*range;if((product&0xffffffffn)>=threshold)return Number(product>>32n);}}};
  }
  const seed=(id,reps)=>(numericId(id)+BigInt(reps||0))&MASK;
  return {rng,seed,factor:(id,reps)=>rng(seed(id,reps)).float(),learningDelay(id,reps,seconds){const extra=Math.floor(Math.min(Math.fround(seconds*.25),300));return seconds+(extra>0?rng(seed(id,reps)).below(extra):0);}};
});
