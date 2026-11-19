export const TRACKS = ['Kick', 'Snare', 'Hat', 'Percussion'];
export const KEY = 'unity-volt-local-v1';
export const blank = () => Array.from({length:4}, () => Array(16).fill(false));
export const STYLES = [
  {id:'house', name:'House-inspired', bpm:122, swing:0, hits:[[0,4,8,12],[4,12],[2,6,10,14],[3,11]]},
  {id:'hiphop', name:'Hip-hop-inspired', bpm:88, swing:22, hits:[[0,6,8,11],[4,12],[0,2,4,6,8,10,12,14],[7,15]]},
  {id:'afrobeat', name:'Afrobeat-inspired', bpm:108, swing:8, hits:[[0,6,10],[4,12],[0,2,3,6,8,10,11,14],[1,5,9,13]]},
  {id:'broken', name:'Broken beat-inspired', bpm:116, swing:16, hits:[[0,3,10],[6,12],[0,2,5,8,10,13,15],[4,11,14]]},
  {id:'minimal', name:'Minimal pulse', bpm:100, swing:0, hits:[[0,8],[12],[2,6,10,14],[7]]},
];
export function styleState(id, volume=15) {
  const style = STYLES.find(item => item.id === id);
  if (!style) return null;
  const pattern = blank();
  style.hits.forEach((hits,row) => hits.forEach(step => { pattern[row][step] = true; }));
  return {v:1, pattern, bpm:style.bpm, swing:style.swing, volume, muted:[false,false,false,false]};
}
export function defaults() {
  return styleState('house');
}
export function parse(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.pattern) || p.pattern.length !== 4 ||
        !p.pattern.every(row => Array.isArray(row) && row.length === 16 && row.every(x => typeof x === 'boolean')) ||
        !Array.isArray(p.muted) || p.muted.length !== 4 || !p.muted.every(x => typeof x === 'boolean') ||
        !Number.isFinite(p.bpm) || p.bpm < 60 || p.bpm > 180 ||
        !Number.isFinite(p.swing) || p.swing < 0 || p.swing > 40 ||
        !Number.isFinite(p.volume) || p.volume < 0 || p.volume > 60) return null;
    return {v:1, pattern:p.pattern.map(row => row.slice()), bpm:Math.round(p.bpm), swing:Math.round(p.swing),
      volume:Math.min(20, Math.round(p.volume)), muted:p.muted.slice()};
  } catch { return null; }
}
export function load(getStorage) {
  try {
    const raw = getStorage().getItem(KEY);
    if (raw === null) return {state:defaults(), note:'Pattern saves only in this browser. Shared device? Reset before leaving.'};
    const state = parse(raw);
    return {state:state || defaults(), note:state ? 'Local pattern restored. Volume capped at 20% on return.' : 'Saved data was invalid. Using a fresh pattern; edit to replace it.'};
  } catch { return {state:defaults(), note:'Browser storage is unavailable. Your pattern will not survive closing this page.'}; }
}
export function save(getStorage, state) {
  try { getStorage().setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function erase(getStorage) {
  try { getStorage().removeItem(KEY); return true; } catch { return false; }
}
export function stepDuration(bpm, swing, step) {
  return (60 / bpm / 4) * (1 + (step % 2 === 0 ? 1 : -1) * swing / 100);
}
