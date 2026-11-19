import {TRACKS, STYLES, styleState, defaults, blank, load, save, erase} from './model.js';
import {AudioEngine} from './audio.js';
const storage = () => window.localStorage;
let {state, note} = load(storage);
const byId = id => document.getElementById(id);
const status = byId('status'), storageNote = byId('storage-note');
storageNote.textContent = note;
const pads = [], mutes = [];
function persist() {
  storageNote.textContent = save(storage, state) ? 'Saved on this browser only. Reset before leaving a shared device.' : 'Cannot save in this browser. Changes are temporary.';
}
const engine = new AudioEngine({
  createContext: () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio unsupported');
    return new Context();
  }, readState: () => state,
  onStep: step => {
    pads.forEach((row) => row.forEach((pad,i) => pad.classList.toggle('current', step === i)));
  },
  onState: phase => {
    byId('start').disabled = phase === 'starting' || phase === 'playing';
    byId('stop').disabled = phase !== 'starting' && phase !== 'playing';
    status.textContent = ({starting:'Starting audio…', playing:'Playing. Stop before removing headphones.', stopped:'Stopped.', interrupted:'Audio paused or interrupted. Press Start to resume.', error:'Audio unavailable or blocked. Check browser sound settings, then try Start again.'})[phase];
  }
});
TRACKS.forEach((name,row) => {
  const section = document.createElement('section'); section.className = 'track';
  const h = document.createElement('h2'); h.textContent = name; section.append(h);
  const mute = document.createElement('button'); mute.type = 'button'; mute.textContent = `Mute ${name}`;
  mute.addEventListener('click', () => { state.muted[row] = !state.muted[row]; sync(); persist(); });
  section.append(mute); mutes.push(mute);
  const group = document.createElement('div'); group.className = 'steps'; group.setAttribute('role','group'); group.setAttribute('aria-label',`${name}, 16 steps`);
  pads[row] = [];
  for (let step=0; step<16; step++) {
    const pad = document.createElement('button'); pad.type = 'button'; pad.textContent = String(step+1);
    pad.setAttribute('aria-label',`${name}, beat ${Math.floor(step/4)+1}, subdivision ${step%4+1}, step ${step+1}`);
    pad.addEventListener('click', () => { state.pattern[row][step] = !state.pattern[row][step]; sync(); persist(); });
    pad.addEventListener('keydown', event => {
      const offset = {ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]}[event.key];
      if (offset) { event.preventDefault(); pads[(row+offset[0]+4)%4][(step+offset[1]+16)%16].focus(); }
    });
    group.append(pad); pads[row].push(pad);
  }
  section.append(group); byId('tracks').append(section);
});
function sync() {
  ['bpm','swing','volume'].forEach(key => { byId(key).value = String(state[key]); byId(`${key}-value`).textContent = String(state[key]); });
  pads.forEach((row,r) => row.forEach((pad,i) => pad.setAttribute('aria-pressed',String(state.pattern[r][i]))));
  mutes.forEach((mute,r) => mute.setAttribute('aria-pressed',String(state.muted[r])));
}
['bpm','swing','volume'].forEach(key => byId(key).addEventListener('input', e => { state[key] = Number(e.target.value); sync(); persist(); }));
byId('start').addEventListener('click', () => engine.start());
byId('stop').addEventListener('click', () => engine.stop());
byId('clear').addEventListener('click', () => { engine.stop(); state.pattern = blank(); sync(); persist(); });
STYLES.forEach(style => {
  const option = document.createElement('option'); option.value = style.id;
  option.textContent = `${style.name} · ${style.bpm} BPM`; byId('style').append(option);
});
byId('style').value = STYLES[0].id;
byId('load-style').addEventListener('click', () => {
  const next = styleState(byId('style').value, state.volume);
  if (!next) return;
  engine.stop(); state = next; sync(); persist();
  status.textContent = 'Style loaded. Current pattern replaced and all tracks unmuted. Press Start when ready.';
});
byId('reset').addEventListener('click', () => {
  if (!window.confirm('Erase the VOLT pattern and settings saved by this page on this browser?')) return;
  engine.stop(); const removed = erase(storage); state = defaults(); state.pattern = blank(); sync();
  storageNote.textContent = removed ? 'Saved VOLT data erased. Empty pattern. Future edits save again.' : 'Reset in memory, but browser blocked deletion. Clear site data in browser settings before sharing this device.';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) engine.stop('interrupted'); });
window.addEventListener('pagehide', () => engine.stop());
sync();
byId('start').disabled = false;
