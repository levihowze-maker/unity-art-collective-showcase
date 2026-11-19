// Analytical oscillator/AudioParam/graph approximation, NOT browser-rendered Web Audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioEngine} from '../music-studio/volt/audio.js';
import {defaults, blank} from '../music-studio/volt/model.js';
class Param {
  constructor(value) { this.value=value; this.events=[]; }
  setValueAtTime(value,time) { this.events.push({kind:'set',value,time}); }
  exponentialRampToValueAtTime(value,time) { this.events.push({kind:'exp',value,time}); }
  at(time) {
    const events=this.events.toSorted((a,b)=>a.time-b.time);
    let previous={value:this.value,time:0};
    for (const next of events) {
      if (time < next.time) {
        if(next.kind==='exp' && time>=previous.time) return previous.value * (next.value/previous.value)**((time-previous.time)/(next.time-previous.time));
        return previous.value;
      }
      previous=next;
    }
    return previous.value;
  }
}
function graph(state) {
  const sources=[];
  const node=()=>({connections:[],connect(other){this.connections.push(other);},disconnect(){this.connections=[];}});
  const context={state:'running',currentTime:0,destination:node(),resume:async()=>{},close:async()=>{},
    createGain(){return {...node(),gain:new Param(1)};},
    createOscillator(){const source={...node(),frequency:new Param(440),type:'sine',start(time){this.startTime=time;},stop(time=0){this.stopTime=time;}};sources.push(source);return source;}};
  const engine=new AudioEngine({createContext:()=>context,readState:()=>state,onStep(){},onState(){},timers:{setInterval:()=>1,clearInterval(){}}});
  function pcm({forceSine=false}={}) {
    const rate=48000, result=new Float64Array(rate*0.35);
    for(const source of sources) {
      let phase=0;
      for(let i=0;i<result.length;i++) {
        const time=i/rate;
        if(time<source.startTime || time>=source.stopTime)continue;
        phase+=2*Math.PI*source.frequency.at(time)/rate;
        let sample=Math.sin(phase);
        if(source.type==='triangle' && !forceSine) {
          sample=0;
          for(let k=0;k<15;k++)sample+=8/Math.PI**2*(-1)**k*Math.sin((2*k+1)*phase)/(2*k+1)**2;
        }
        let gain=1, current=source;
        while(current!==context.destination) {
          if(current.connections.length!==1){gain=0;break;}
          current=current.connections[0];if(current.gain)gain*=current.gain.at(time);
        }
        result[i]+=sample*gain;
      }
    }
    return result;
  }
  return {engine,pcm,sources};
}
function isolated(row,volume=15) {const state=defaults();state.pattern=blank();state.pattern[row][0]=true;state.volume=volume;return state;}
const rms=pcm=>Math.sqrt(pcm.reduce((sum,x)=>sum+x*x,0)/pcm.length);
function smallSpeakerApprox(pcm) {
  // Four cascaded one-pole highpasses at 250 Hz; illustrative, not a real device model.
  let result=Float64Array.from(pcm);const a=1/(1+2*Math.PI*250/48000);
  for(let stage=0;stage<4;stage++) {
    let previousX=0,previousY=0;
    result=result.map(x=>{const y=a*(previousY+x-previousX);previousX=x;previousY=y;return y;});
  }
  return result;
}
test('AudioParam timeline respects scheduled set/ramp despite intrinsic value',()=>{
 const p=new Param(0);p.setValueAtTime(.05,0);assert.equal(p.at(.04),.05);
 const q=new Param(1);q.setValueAtTime(.65,.03);q.exponentialRampToValueAtTime(.0001,.21);
 assert.ok(Math.abs(q.at(.12)-Math.sqrt(.65*.0001))<1e-10);
});
for(const [row,name] of [[0,'kick'],[3,'percussion']])test(`${name} produces nonzero destination PCM with scheduled gain and frequency ramps`,async()=>{
 const h=graph(isolated(row));await h.engine.start();const pcm=h.pcm();
 const energy=rms(pcm),peak=Math.max(...pcm.map(Math.abs));
 assert.ok(energy>.0001);assert.ok(peak>.001 && peak<.04);assert.ok(pcm.every(Number.isFinite));
 console.log(`${name}: analytical RMS=${energy.toFixed(6)}, peak=${peak.toFixed(6)}`);h.engine.stop();
});
test('mute and zero-volume suppress destination output; stop disconnects scheduled voices',async()=>{
 const muted=isolated(3);muted.muted[3]=true;
 for(const state of [muted,isolated(0,0)]){const h=graph(state);await h.engine.start();assert.equal(rms(h.pcm()),0);h.engine.stop();}
 const h=graph(isolated(0));await h.engine.start();h.engine.stop();assert.equal(rms(h.pcm()),0);
});
test('fresh example includes audible-by-pattern percussion hits (not just an empty row)',()=>{
 assert.ok(defaults().pattern[3].some(Boolean));assert.ok(defaults().muted.every(x=>!x));
});
test('kick harmonic variant retains gain but increases illustrative small-speaker-band energy',async()=>{
 const h=graph(isolated(0));await h.engine.start();const actual=rms(smallSpeakerApprox(h.pcm()));const sine=rms(smallSpeakerApprox(h.pcm({forceSine:true})));
 console.log(`illustrative highpass RMS: selected=${actual.toFixed(7)}, sine=${sine.toFixed(7)}`);
 assert.ok(actual>sine*1.05);h.engine.stop();
});
