import {stepDuration} from './model.js';
// Owns every voice, timer and AudioContext; no network or media input.
export class AudioEngine {
  constructor({createContext, readState, onStep, onState, timers = globalThis}) {
    Object.assign(this, {createContext, readState, onStep, onState, timers});
    this.context = null; this.master = null; this.timer = null; this.nodes = new Set();
    this.generation = 0; this.phase = 'stopped';
  }
  async start() {
    if (this.phase !== 'stopped') return;
    const generation = ++this.generation;
    this.phase = 'starting'; this.onState('starting');
    let context;
    try {
      context = this.createContext(); this.context = context;
      const master = context.createGain(); this.master = master;
      master.gain.value = 0; master.connect(context.destination);
      await context.resume();
      if (generation !== this.generation) return;
      if (context.state !== 'running') throw new Error('Audio did not resume');
      this.phase = 'playing'; this.next = context.currentTime + 0.03; this.step = 0;
      context.onstatechange = () => {
        if (this.phase === 'playing' && context.state !== 'running') this.stop('interrupted');
      };
      this.onState('playing'); this.tick();
      if (this.phase === 'playing') this.timer = this.timers.setInterval(() => this.tick(), 25);
    } catch {
      if (generation === this.generation) this.stop('error');
    }
  }
  tick() {
    if (this.phase !== 'playing') return;
    try {
      const c = this.context, state = this.readState();
      this.master.gain.setValueAtTime(Math.min(60, Math.max(0, state.volume)) / 100 * 0.35, c.currentTime);
      // Never catch up a backlog after browser suspension.
      if (this.next < c.currentTime - 0.1) { this.stop('interrupted'); return; }
      while (this.next < c.currentTime + 0.08) {
        for (let row=0; row<4; row++) if (!state.muted[row] && state.pattern[row][this.step]) this.voice(row, this.next);
        this.onStep(this.step);
        this.next += stepDuration(state.bpm, state.swing, this.step);
        this.step = (this.step + 1) % 16;
      }
    } catch { this.stop('error'); }
  }
  voice(row, time) {
    const c = this.context, gain = c.createGain();
    let source, filter;
    const duration = row === 0 ? 0.18 : row === 1 ? 0.12 : row === 2 ? 0.045 : 0.09;
    if (row === 1 || row === 2) {
      source = c.createBufferSource();
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0; i<data.length; i++) data[i] = Math.random() * 2 - 1;
      source.buffer = buffer; filter = c.createBiquadFilter();
      filter.type = 'highpass'; filter.frequency.value = row === 2 ? 6500 : 1200;
      source.connect(filter); filter.connect(gain);
    } else {
      source = c.createOscillator(); source.type = row === 0 ? 'triangle' : 'sine';
      source.frequency.setValueAtTime(row === 0 ? 135 : 430, time);
      source.frequency.exponentialRampToValueAtTime(row === 0 ? 45 : 210, time + duration);
      source.connect(gain);
    }
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(this.master);
    const node = {source, gain, filter}; this.nodes.add(node);
    source.onended = () => { source.disconnect(); gain.disconnect(); filter?.disconnect(); this.nodes.delete(node); };
    source.start(time); source.stop(time + duration + 0.01);
  }
  stop(reason = 'stopped') {
    ++this.generation; this.phase = 'stopped';
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
    const c = this.context; this.context = null;
    if (this.master) { this.master.gain.value = 0; this.master.disconnect(); this.master = null; }
    for (const {source,gain,filter} of this.nodes) {
      try { source.stop(); } catch { /* Already stopped voice. */ }
      source.disconnect(); gain.disconnect(); filter?.disconnect();
    }
    this.nodes.clear();
    if (c) { c.onstatechange = null; try { Promise.resolve(c.close()).catch(() => {}); } catch { /* Already closed. */ } }
    this.onStep(-1); this.onState(reason);
  }
}
