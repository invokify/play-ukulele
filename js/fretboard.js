// Manche de ukulélé en SVG : cordes qui vibrent, doigts posés, aperçu de la note suivante.
import { STRINGS } from './parser.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 1000;
const NUT_X = 104;
const END_X = 985;
const TOP = 34;
const GAP = 42;
const H = TOP + GAP * 3 + 58;

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

export class Fretboard {
  constructor(container, { frets = 15, onPick } = {}) {
    this.frets = frets;
    this.onPick = onPick;
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fretboard-svg', role: 'img', 'aria-label': 'Manche du ukulélé' });
    container.appendChild(this.svg);
    this._draw();
  }

  fretX(n) {
    const k = (1 - 2 ** (-n / 12)) / (1 - 2 ** (-this.frets / 12));
    return NUT_X + (END_X - NUT_X) * k;
  }

  noteX(fret) {
    return fret === 0 ? NUT_X - 26 : (this.fretX(fret - 1) + this.fretX(fret)) / 2;
  }

  stringY(s) {
    return TOP + STRINGS.indexOf(s) * GAP;
  }

  _draw() {
    const s = this.svg;
    const yTop = TOP - 16;
    const yBot = TOP + GAP * 3 + 16;
    el('rect', { x: NUT_X, y: yTop, width: END_X - NUT_X, height: yBot - yTop, rx: 4, class: 'fb-wood' }, s);

    // Repères
    const midY = (TOP + TOP + GAP * 3) / 2;
    for (const f of [5, 7, 10, 15]) {
      if (f <= this.frets) el('circle', { cx: this.noteX(f), cy: midY, r: 7, class: 'fb-inlay' }, s);
    }
    if (this.frets >= 12) {
      el('circle', { cx: this.noteX(12), cy: TOP + GAP * 0.5, r: 7, class: 'fb-inlay' }, s);
      el('circle', { cx: this.noteX(12), cy: TOP + GAP * 2.5, r: 7, class: 'fb-inlay' }, s);
    }

    // Frettes + numéros
    for (let f = 1; f <= this.frets; f++) {
      el('line', { x1: this.fretX(f), x2: this.fretX(f), y1: yTop, y2: yBot, class: 'fb-fret' }, s);
      const t = el('text', { x: this.noteX(f), y: yBot + 22, class: 'fb-fretnum' }, s);
      t.textContent = f;
    }
    el('rect', { x: NUT_X - 5, y: yTop, width: 8, height: yBot - yTop, rx: 2, class: 'fb-nut' }, s);

    // Cordes
    this.stringEls = {};
    this.labelEls = {};
    const thickness = { A: 1.8, E: 2.4, C: 3, G: 2.1 };
    for (const name of STRINGS) {
      const y = this.stringY(name);
      const lbl = el('text', { x: 6, y: y + 5, class: 'fb-label' }, s);
      lbl.textContent = name;
      this.labelEls[name] = lbl;
      const g = el('g', { class: 'fb-string' }, s);
      el('line', { x1: NUT_X - 4, x2: END_X, y1: y, y2: y, 'stroke-width': thickness[name] }, g);
      this.stringEls[name] = g;
    }

    // Zones cliquables
    const hit = el('g', { class: 'fb-hit' }, s);
    for (const name of STRINGS) {
      for (let f = 0; f <= this.frets; f++) {
        const x0 = f === 0 ? 48 : this.fretX(f - 1);
        const x1 = f === 0 ? NUT_X : this.fretX(f);
        const r = el('rect', { x: x0, y: this.stringY(name) - GAP / 2, width: x1 - x0, height: GAP }, hit);
        r.addEventListener('click', () => this.onPick?.(name, f));
        const tip = el('title', {}, r);
        tip.textContent = `Corde ${name}, case ${f}`;
      }
    }
    this.layer = el('g', { class: 'fb-notes' }, s);
  }

  setTuningLabels(labels) {
    for (const name of STRINGS) this.labelEls[name].textContent = labels[name];
  }

  /**
   * @param {Array<{string,fret,label}>} notes notes jouées
   * @param {Array<{string,fret}>} ghost notes à venir
   */
  show(notes = [], ghost = []) {
    this.layer.replaceChildren();
    const draw = (n, cls) => {
      const x = this.noteX(n.fret);
      const y = this.stringY(n.string);
      const g = el('g', { class: cls }, this.layer);
      el('circle', { cx: x, cy: y, r: n.fret === 0 ? 13 : 15 }, g);
      const t = el('text', { x, y: y + 5 }, g);
      t.textContent = cls === 'fb-ghost' ? n.fret : (n.label ?? n.fret);
    };
    const playedKeys = new Set(notes.map((n) => n.string + n.fret));
    ghost.filter((n) => !playedKeys.has(n.string + n.fret)).forEach((n) => draw(n, 'fb-ghost'));
    notes.forEach((n) => draw(n, n.fret === 0 ? 'fb-open' : 'fb-dot'));
  }

  pluck(strings) {
    for (const s of strings) {
      const g = this.stringEls[s];
      g.classList.remove('vibrate');
      void g.getBoundingClientRect();
      g.classList.add('vibrate');
    }
  }
}
