import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults, parse, blank, load, save, erase, KEY, stepDuration} from '../music-studio/volt/model.js';
import {AudioEngine} from '../music-studio/volt/audio.js';
const denied = () => {throw new Error('denied');};
test('fresh patterns are independent and exactly four by sixteen booleans', () => {
 const a=defaults(), b=defaults(); a.pattern[0][0]=false;
 assert.equal(b.pattern[0][0],true);assert.equal(blank().flat().filter(Boolean).length,0);
 assert.equal(parse(JSON.stringify(b)).pattern.flat().length,64);
});
test('save parser rejects corrupt, wrong version, missing rows, nonbooleans and unsafe numeric ranges', () => {
 for(const raw of ['null','[]','{','{"v":2}',JSON.stringify({...defaults(),pattern:[[true]]}),JSON.stringify({...defaults(),volume:100}),JSON.stringify({...defaults(),bpm:'110'}),JSON.stringify({...defaults(),swing:-1}),JSON.stringify({...defaults(),muted:[0,0,0,0]})]) assert.equal(parse(raw),null);
 const p=defaults();p.pattern[1][4]='true';assert.equal(parse(JSON.stringify(p)),null);
});
test('restore is conservative and never turns on audio', () => {
 const p=defaults();p.volume=60;
 assert.equal(parse(JSON.stringify(p)).volume,20);
 assert.equal('playing' in load(() => ({getItem:()=>JSON.stringify(p)})).state,false);
});
test('storage read/write/remove denial is safe and described', () => {
 assert.match(load(denied).note,/unavailable/);assert.equal(save(denied,defaults()),false);assert.equal(erase(denied),false);
 assert.match(load(()=>({getItem:()=>'{'})).note,/invalid/);
});
test('persistence roundtrip and shared device deletion affect only owned key', () => {
 const map=new Map([['other-site-data','keep']]);const storage=()=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const state=defaults();state.pattern[3][2]=true;assert.equal(save(storage,state),true);
 assert.deepEqual(load(storage).state,state);assert.equal(erase(storage),true);
 assert.equal(map.has(KEY),false);assert.equal(map.get('other-site-data'),'keep');
});
test('swing preserves pair duration at extreme tempos', () => {
 for(const bpm of [60,110,180]) for(const swing of [0,40]){
  assert.ok(stepDuration(bpm,swing,1)>0);
  assert.ok(Math.abs(stepDuration(bpm,swing,0)+stepDuration(bpm,swing,1)-60/bpm/2)<1e-10);
 }
});
function harness({resumeError=false,pending=false,brokenVoice=false}={}) {
 let resolve;const closed=[],voices=[],states=[],steps=[];const jobs=new Set();
 const makeParam=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:makeParam(),frequency:makeParam(),connect(){},disconnect(){this.disconnected=true;},start(){},stop(){this.stopped=true;}});
 const context={state:'running',currentTime:0,sampleRate:1000,destination:{},
  createGain:node, createOscillator(){if(brokenVoice) throw Error('voice failed');const n=node();voices.push(n);return n;},
  createBufferSource(){const n=node();voices.push(n);return n;},createBiquadFilter:node,
  createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)}),
  resume(){return resumeError?Promise.reject(Error('blocked')):pending?new Promise(r=>resolve=r):Promise.resolve();},
  close(){closed.push(true);this.state='closed';return Promise.resolve();}};
 const engine=new AudioEngine({createContext:()=>context,readState:defaults,onState:s=>states.push(s),onStep:s=>steps.push(s),
  timers:{setInterval:f=>{jobs.add(f);return f;},clearInterval:f=>jobs.delete(f)}});
 return {engine,context,closed,voices,states,steps,jobs,resolve:()=>resolve()};
}
test('explicit start schedules; stop silences and closes all scheduled voices and timers',async()=>{
 const h=harness();assert.equal(h.voices.length,0);await h.engine.start();assert.ok(h.voices.length>0);assert.equal(h.jobs.size,1);
 h.engine.stop();assert.equal(h.jobs.size,0);assert.ok(h.voices.every(n=>n.stopped&&n.disconnected));assert.equal(h.closed.length,1);assert.equal(h.engine.nodes.size,0);assert.equal(h.steps.at(-1),-1);
 h.engine.stop();assert.equal(h.closed.length,1);
});
test('stop while resume is pending prevents late audio or timer startup',async()=>{
 const h=harness({pending:true});const task=h.engine.start();h.engine.stop();h.resolve();await task;
 assert.equal(h.voices.length,0);assert.equal(h.jobs.size,0);assert.equal(h.engine.phase,'stopped');
});
test('blocked resume closes context and reports recoverable error',async()=>{
 const h=harness({resumeError:true});await h.engine.start();assert.equal(h.states.at(-1),'error');assert.equal(h.closed.length,1);assert.equal(h.jobs.size,0);
});
test('unsupported Web Audio reports error without throwing',async()=>{
 const states=[];const engine=new AudioEngine({createContext:()=>{throw Error('unsupported');},readState:defaults,onStep(){},onState:s=>states.push(s)});
 await engine.start();assert.equal(states.at(-1),'error');
});
test('audio interruption stops rather than auto-resuming',async()=>{
 const h=harness();await h.engine.start();h.context.state='suspended';h.context.onstatechange();assert.equal(h.states.at(-1),'interrupted');assert.equal(h.jobs.size,0);
});
test('scheduler lag does not create a catch-up burst',async()=>{
 const h=harness();await h.engine.start();const count=h.voices.length;h.context.currentTime=10;h.engine.tick();assert.equal(h.voices.length,count);assert.equal(h.states.at(-1),'interrupted');
});
test('initial voice failure does not leave a scheduler interval',async()=>{
 const h=harness({brokenVoice:true});await h.engine.start();assert.equal(h.states.at(-1),'error');assert.equal(h.jobs.size,0);
});
test('repeated Start while playing does not allocate another context',async()=>{
 const h=harness();await h.engine.start();await h.engine.start();assert.equal(h.jobs.size,1);h.engine.stop();
});
