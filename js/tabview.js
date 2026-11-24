// Affichage de la tablature, ré-agencée à la largeur de l'écran, avec curseur de lecture.
import { STRINGS } from './parser.js';

export class TabView {
  constructor(container, { onSeek } = {}) {
    this.el = container;
    this.onSeek = onSeek;
    this.colEls = [];
    this.current = -1;
    let t;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => this.render(), 120);
    }).observe(container);
  }

  setData(parsed) {
    this.parsed = parsed;
    this.lastWidth = null;
    this.render();
  }

  _charWidth() {
    const probe = document.createElement('span');
    probe.className = 'tab-probe';
    probe.textContent = 'M'.repeat(20);
    this.el.appendChild(probe);
    const w = probe.getBoundingClientRect().width / 20;
    probe.remove();
    return w || 9;
  }

  render() {
    if (!this.parsed) return;
    const width = this.el.clientWidth;
    if (width === this.lastWidth) return;
    this.lastWidth = width;

    const { columns, sections } = this.parsed;
    this.el.replaceChildren();
    this.colEls = [];
    if (!columns.length) {
      this.el.innerHTML = '<p class="hint">Aucune ligne de tablature reconnue.</p>';
      return;
    }

    const cw = this._charWidth();
    const maxChars = Math.max(16, Math.floor((width - 32) / cw) - 3);
    const sectionAt = new Map(sections.map((s) => [s.col, s.name]));

    let row = null;
    let used = Infinity;
    const newRow = () => {
      row = document.createElement('div');
      row.className = 'trow';
      const labels = document.createElement('div');
      labels.className = 'tcol tlabels';
      labels.innerHTML = STRINGS.map((s) => `<span>${s}|</span>`).join('');
      row.appendChild(labels);
      this.el.appendChild(row);
      used = 0;
    };

    columns.forEach((col, i) => {
      if (used + col.width > maxChars || (sectionAt.has(i) && used > maxChars * 0.6)) newRow();
      if (col.bar && used === 0) {
        this.colEls[i] = null;
        return;
      }
      const c = document.createElement('div');
      c.className = 'tcol' + (col.bar ? ' bar' : '');
      c.dataset.col = i;
      for (const s of STRINGS) {
        const cell = document.createElement('span');
        const txt = col.text[s];
        cell.textContent = txt;
        if (/\d/.test(txt)) cell.className = 'n';
        c.appendChild(cell);
      }
      if (sectionAt.has(i)) {
        const tag = document.createElement('em');
        tag.className = 'tsec';
        tag.textContent = sectionAt.get(i);
        c.appendChild(tag);
      }
      if (!col.bar) c.addEventListener('click', () => this.onSeek?.(i));
      row.appendChild(c);
      this.colEls[i] = c;
      used += col.width;
    });

    if (this.current >= 0) this.highlight(this.current, false);
  }

  highlight(i, scroll = true) {
    this.colEls[this.current]?.classList.remove('cur');
    this.current = i;
    const c = this.colEls[i];
    if (!c) return;
    c.classList.add('cur');
    if (scroll) {
      const row = c.parentElement;
      const top = row.offsetTop;
      const bottom = top + row.offsetHeight;
      if (top < this.el.scrollTop || bottom > this.el.scrollTop + this.el.clientHeight) {
        this.el.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' });
      }
    }
  }
}
