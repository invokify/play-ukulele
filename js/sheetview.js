// Affichage « accords au-dessus des paroles » + diagrammes d'accords.
import { chordShape } from './chordsheet.js';

const NS = 'http://www.w3.org/2000/svg';
const ORDER = ['G', 'C', 'E', 'A'];

/** Petit diagramme d'accord vertical (cordes G C E A de gauche à droite). */
export function chordDiagram(name) {
  const shape = chordShape(name);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 70 100');
  svg.setAttribute('class', 'chord-diagram');
  svg.setAttribute('role', 'img');
  if (!shape) {
    svg.setAttribute('aria-label', `${name} : forme inconnue`);
    svg.innerHTML = '<text x="35" y="50" text-anchor="middle" class="cd-unknown">?</text>';
    return svg;
  }
  const frets = ORDER.map((s) => shape[s]);
  const maxF = Math.max(...frets);
  const minF = Math.min(...frets.filter((f) => f > 0), 99);
  const base = maxF > 4 ? minF : 1; // première case affichée
  const x = (i) => 12 + i * 15;
  const y = (r) => 16 + r * 17;
  let h = '';
  h += base === 1 ? `<rect x="11" y="13" width="47" height="4" class="cd-nut"/>` : `<text x="2" y="${y(0.75)}" class="cd-base">${base}</text>`;
  for (let r = 0; r <= 4; r++) h += `<line x1="12" x2="57" y1="${y(r)}" y2="${y(r)}" class="cd-fret"/>`;
  ORDER.forEach((s, i) => {
    h += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(0)}" y2="${y(4)}" class="cd-string"/>`;
    const f = frets[i];
    if (f === 0) h += `<circle cx="${x(i)}" cy="8" r="3.6" class="cd-open"/>`;
    else h += `<circle cx="${x(i)}" cy="${y(f - base + 0.5)}" r="5.6" class="cd-dot"/>`;
    h += `<text x="${x(i)}" y="${y(4) + 12}" class="cd-str">${s}</text>`;
  });
  svg.innerHTML = h;
  svg.setAttribute('aria-label', `${name} : ${ORDER.map((s) => `${s}${shape[s]}`).join(' ')}`);
  return svg;
}

export class SheetView {
  constructor(container, { onSeek, onAudition } = {}) {
    this.el = container;
    this.onSeek = onSeek;
    this.onAudition = onAudition;
    this.chordEls = [];
    this.bankEls = new Map();
    this.current = -1;
  }

  setData(parsed) {
    this.parsed = parsed;
    this.el.replaceChildren();
    this.chordEls = [];
    this.bankEls = new Map();
    this.current = -1;

    // Banque des accords utilisés
    const bank = document.createElement('div');
    bank.className = 'chord-bank';
    for (const name of [...new Set(parsed.chords.map((c) => c.name))]) {
      if (name === 'N.C.') continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chord-card';
      b.title = `Écouter ${name}`;
      b.innerHTML = `<strong>${name}</strong>`;
      b.appendChild(chordDiagram(name));
      b.addEventListener('click', () => this.onAudition?.(name));
      bank.appendChild(b);
      this.bankEls.set(name, b);
    }
    this.el.appendChild(bank);

    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    const sectionAt = new Map(parsed.sections.map((s) => [s.col, s.name]));
    for (const it of parsed.items) {
      if (it.type === 'blank') {
        const last = sheet.lastElementChild;
        if (last && !last.classList.contains('gap')) sheet.appendChild(Object.assign(document.createElement('div'), { className: 'gap' }));
        continue;
      }
      if (it.type === 'section') {
        sheet.appendChild(Object.assign(document.createElement('h3'), { className: 'sheet-sec', textContent: it.name }));
        continue;
      }
      if (it.type === 'text') {
        sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-text', textContent: it.text }));
        continue;
      }
      // Ligne d'accords (+ paroles)
      const first = parsed.chords[it.tokens[0].chord];
      const autoSec = sectionAt.get(first.firstCol);
      if (autoSec && !parsed.items.some((x) => x.type === 'section')) {
        sheet.appendChild(Object.assign(document.createElement('h3'), { className: 'sheet-sec auto', textContent: autoSec }));
      }
      const block = document.createElement('div');
      block.className = 'sheet-line';
      const cl = document.createElement('div');
      cl.className = 'sheet-chords';
      let pos = 0;
      for (const tok of it.tokens) {
        if (tok.start > pos) cl.append(it.raw.slice(pos, tok.start));
        const span = document.createElement('span');
        span.className = 'sheet-chord';
        span.textContent = it.raw.slice(tok.start, tok.end);
        span.title = 'Jouer à partir d\'ici';
        span.addEventListener('click', () => this.onSeek?.(parsed.chords[tok.chord].firstCol));
        cl.appendChild(span);
        this.chordEls[tok.chord] = span;
        pos = tok.end;
      }
      if (pos < it.raw.length) cl.append(it.raw.slice(pos));
      block.appendChild(cl);
      if (it.lyric != null) {
        block.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-lyric', textContent: it.lyric }));
      }
      sheet.appendChild(block);
    }
    this.el.appendChild(sheet);
    this.sheetEl = sheet;
  }

  highlight(chordIdx, scroll = true) {
    if (chordIdx === this.current) return;
    this.chordEls[this.current]?.classList.remove('cur');
    const prevName = this.parsed.chords[this.current]?.name;
    if (prevName) this.bankEls.get(prevName)?.classList.remove('cur');
    this.current = chordIdx;
    const span = this.chordEls[chordIdx];
    const name = this.parsed.chords[chordIdx]?.name;
    if (name) this.bankEls.get(name)?.classList.add('cur');
    if (!span) return;
    span.classList.add('cur');
    if (scroll) {
      const block = span.closest('.sheet-line');
      const box = this.sheetEl;
      const top = block.offsetTop;
      if (top < box.scrollTop || top + block.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: 'smooth' });
      }
    }
  }
}
