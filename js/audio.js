// Synthèse d'une corde pincée (algorithme de Karplus-Strong) avec Web Audio.

const STRUM_ORDER = ['G', 'C', 'E', 'A']; // ordre physique d'un coup vers le bas

export const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

export function pluckedString(freq, sr) {
  const dur = Math.min(3, 1.4 + 150 / freq);
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);

  // Délai total = N (ligne) + 0,5 (moyenne) + fraction (passe-tout) pour un accord juste.
  const D = sr / freq - 0.5;
  const N = Math.max(2, Math.floor(D - 0.1));
  const frac = D - N;
  const C = (1 - frac) / (1 + frac);

  // Excitation : bruit adouci (corde nylon, pincée au doigt).
  const line = new Float32Array(N);
  let prev = 0, mean = 0;
  for (let i = 0; i < N; i++) {
    prev = prev * 0.55 + (Math.random() * 2 - 1) * 0.45;
    line[i] = prev;
    mean += prev;
  }
  mean /= N;
  for (let i = 0; i < N; i++) line[i] -= mean;

  const t60 = Math.max(0.7, Math.min(2.4, 2.2 * Math.sqrt(262 / freq)));
  const rho = Math.pow(0.001, 1 / (t60 * freq));

  let ptr = 0, lastV = 0, apX = 0, apY = 0, peak = 0;
  for (let t = 0; t < len; t++) {
    const v = line[ptr];
    out[t] = v;
    const lp = rho * 0.5 * (v + lastV);
    lastV = v;
    const ap = C * lp + apX - C * apY;
    apX = lp;
    apY = ap;
    line[ptr] = ap;
    ptr = ptr + 1 === N ? 0 : ptr + 1;
    if (t < sr * 0.1) peak = Math.max(peak, Math.abs(v));
  }

  const gain = peak > 0 ? 0.6 / peak : 1;
  const attack = Math.floor(sr * 0.002);
  const release = Math.floor(sr * 0.08);
  for (let t = 0; t < len; t++) {
    let g = gain;
    if (t < attack) g *= t / attack;
    if (t > len - release) g *= (len - t) / release;
    out[t] *= g;
  }
  return out;
}

export class UkeAudio {
  constructor() {
    this.ctx = null;
    this.cache = new Map();
    this.active = new Map(); // source -> gain
    this.ringing = {}; // corde -> { src, g }
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      const body = c.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 380;
      body.Q.value = 1.2;
      body.gain.value = 4;
      const air = c.createBiquadFilter();
      air.type = 'lowpass';
      air.frequency.value = 5500;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 3;
      this.master.connect(body).connect(air).connect(comp).connect(c.destination);
      this.clickOut = c.createGain();
      this.clickOut.gain.value = 0.35;
      this.clickOut.connect(c.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _buffer(midi) {
    let b = this.cache.get(midi);
    if (!b) {
      const sr = this.ctx.sampleRate;
      const data = pluckedString(midiToFreq(midi), sr);
      b = this.ctx.createBuffer(1, data.length, sr);
      b.copyToChannel(data, 0);
      this.cache.set(midi, b);
    }
    return b;
  }

  /** Joue une note ; une nouvelle note sur la même corde étouffe la précédente. */
  playNote(midi, when = 0, string = null, velocity = 0.8) {
    const c = this.ensure();
    when = Math.max(when, c.currentTime);
    const src = c.createBufferSource();
    src.buffer = this._buffer(midi);
    const g = c.createGain();
    g.gain.value = velocity;
    src.connect(g).connect(this.master);

    if (string) {
      const prev = this.ringing[string];
      if (prev) {
        prev.g.gain.setTargetAtTime(0, when, 0.015);
        try { prev.src.stop(when + 0.15); } catch { /* déjà arrêtée */ }
      }
      this.ringing[string] = { src, g };
    }
    src.start(when);
    this.active.set(src, g);
    src.onended = () => {
      this.active.delete(src);
      if (string && this.ringing[string]?.src === src) delete this.ringing[string];
    };
  }

  /**
   * notes : [{ string, midi }] — au-delà de 2 notes, l'accord est gratté :
   * de G vers A (vers le bas, « d ») ou de A vers G (vers le haut, « u », plus léger).
   */
  playColumn(notes, when, dir = 'd') {
    const sorted = [...notes].sort((a, b) => STRUM_ORDER.indexOf(a.string) - STRUM_ORDER.indexOf(b.string));
    if (dir === 'u') sorted.reverse();
    const strum = sorted.length >= 3 ? (dir === 'u' ? 0.011 : 0.014) : 0;
    const base = dir === 'u' ? 0.5 : 0.72;
    sorted.forEach((n, i) => this.playNote(n.midi, when + i * strum, n.string, base + Math.random() * 0.1));
  }

  click(when, accent = false) {
    const c = this.ensure();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.value = accent ? 1760 : 1100;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.5, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(this.clickOut);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [src, g] of this.active) {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.02);
      try { src.stop(now + 0.12); } catch { /* ignore */ }
    }
    this.ringing = {};
  }
}
