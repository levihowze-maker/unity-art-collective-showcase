import test from 'node:test';
import assert from 'node:assert/strict';
import {STYLES, styleState, defaults, KEY, parse} from '../music-studio/volt/model.js';

test('five distinct editable original style sketches have valid tempos and all four tracks',()=>{
 assert.equal(STYLES.length,5);assert.equal(new Set(STYLES.map(x=>x.id)).size,5);
 const patterns=STYLES.map(style=>styleState(style.id));
 assert.equal(new Set(patterns.map(x=>JSON.stringify(x.pattern))).size,5);
 for(const state of patterns){assert.ok(parse(JSON.stringify(state)));assert.ok(state.pattern.every(row=>row.some(Boolean)));}
 assert.ok(STYLES.some(x=>x.name==='Afrobeat-inspired'));
});
test('loading a style clones patterns, preserves requested level and unmutes tracks',()=>{
 const a=styleState('hiphop',12), b=styleState('hiphop',12);a.pattern[0][0]=false;
 assert.equal(b.pattern[0][0],true);assert.equal(b.volume,12);assert.ok(b.muted.every(x=>!x));
 assert.equal(styleState('not-a-style'),null);
});

test('actual app leaves selected style unapplied until explicit Load; loaded hits stay editable and reset remains safe',async()=>{
 class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.attrs={};this.value='';this.classList={toggle(){}};}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,f){(this.events[k]??=[]).push(f);}
  fire(k){for(const f of this.events[k]||[])f({target:this,preventDefault(){}});}
  focus(){}
 }
 const ids=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
 const custom=defaults();custom.pattern[0][1]=true;custom.bpm=95;custom.volume=12;custom.muted[3]=true;
 const values=new Map([[KEY,JSON.stringify(custom)]]);let contexts=0,confirmed=false;
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  addEventListener(){},confirm:()=>confirmed,AudioContext:class{constructor(){contexts++;throw Error('not expected');}}};
 globalThis.document={getElementById:get,createElement:tag=>new Element(tag),addEventListener(){},hidden:false};
 try {
  await import('../music-studio/volt/app.js?style-control-regression');
  assert.equal(get('style').children.length,5);
  const saved=values.get(KEY);const beforePads=get('tracks').children.map(track=>track.children[2].children.map(p=>p.attrs['aria-pressed']));
  get('style').value='broken';get('style').fire('change');
  assert.equal(values.get(KEY),saved);
  assert.deepEqual(get('tracks').children.map(track=>track.children[2].children.map(p=>p.attrs['aria-pressed'])),beforePads);
  assert.equal(get('bpm').value,'95');
  get('load-style').fire('click');assert.deepEqual(JSON.parse(values.get(KEY)),styleState('broken',12));
  assert.equal(contexts,0);assert.match(get('status').textContent,/replaced/);
  const pad=get('tracks').children[0].children[2].children[0];const previous=JSON.parse(values.get(KEY)).pattern[0][0];pad.fire('click');
  assert.equal(JSON.parse(values.get(KEY)).pattern[0][0],!previous);
  const beforeReset=values.get(KEY);get('reset').fire('click');assert.equal(values.get(KEY),beforeReset);
  confirmed=true;get('reset').fire('click');assert.equal(values.has(KEY),false);
 } finally {globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
