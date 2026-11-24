// Parseur de tablatures de ukulélé.
// Les cordes sont listées de haut en bas, comme dans une tablature : A, E, C, G.
export const STRINGS = ['A', 'E', 'C', 'G'];

const LABEL_RE = /^\s*([A-Ga-g])[#b]?\s*([|:])(.*)$/;
const TAB_BODY_RE = /^[-0-9|:hpbrsxv/\\~().*<>^=\s]*$/;
const SECTION_RE = /^\[([^\]]+)\]$/;

const dashes = (s) => (s.match(/-/g) || []).length;
const isDigit = (c) => c >= '0' && c <= '9';

function classify(line) {
  const raw = line.replace(/\s+$/, '');
  const t = raw.trim();
  if (!t) return { type: 'blank' };
  const m = raw.match(LABEL_RE);
  if (m && TAB_BODY_RE.test(m[3]) && dashes(m[3]) >= 2) {
    return { type: 'tab', label: m[1].toUpperCase(), body: m[3] };
  }
  if (TAB_BODY_RE.test(t) && dashes(t) >= 3) {
    return { type: 'tab', label: null, body: t.replace(/^[|:]/, '') };
  }
  const sec = t.match(SECTION_RE);
  if (sec) return { type: 'section', name: sec[1].trim() };
  return { type: 'text', text: t };
}

function appendSystem(lines, columns) {
  // Associe chaque ligne à une corde : par étiquette si les 4 sont présentes, sinon par position.
  const labels = lines.map((l) => l.label);
  const byLabel = new Set(labels).size === 4 && labels.every((l) => STRINGS.includes(l));
  const bodies = {};
  lines.forEach((l, i) => { bodies[byLabel ? l.label : STRINGS[i]] = l.body; });

  const len = Math.max(...STRINGS.map((s) => bodies[s].length));
  for (const s of STRINGS) bodies[s] = bodies[s].padEnd(len, '-');

  let i = 0;
  while (i < len) {
    const chars = STRINGS.map((s) => bodies[s][i]);
    const isSep = (c) => c === '|' || c === ':';
    if (chars.every((c) => isSep(c) || c === ' ')) {
      if (chars.some(isSep)) {
        const last = columns[columns.length - 1];
        if (last && !last.bar) {
          columns.push({ bar: true, width: 1, notes: [], text: Object.fromEntries(STRINGS.map((s) => [s, '|'])) });
        }
      }
      i++;
      continue;
    }

    // Une frette à deux chiffres (10, 12…) occupe deux colonnes de texte.
    let width = 1;
    for (const s of STRINGS) {
      const a = bodies[s][i], b = bodies[s][i + 1];
      if (isDigit(a) && b !== undefined && isDigit(b) && Number(a + b) <= 24) width = 2;
    }

    const notes = [];
    const text = {};
    for (const s of STRINGS) {
      const seg = bodies[s].slice(i, i + width).replace(/ /g, '-');
      text[s] = seg;
      const m = seg.match(/\d+/);
      if (m) {
        const fret = Number(m[0]);
        if (fret <= 24) notes.push({ string: s, fret });
      }
    }
    columns.push({ bar: false, width, notes, text });
    i += width;
  }
}

/**
 * Transforme le texte d'une tablature en une suite de colonnes temporelles.
 * @returns {{columns: Array, sections: Array<{name:string,col:number}>, totalSteps:number, noteCount:number, warnings:string[]}}
 */
export function parseTab(text) {
  const columns = [];
  const sections = [];
  const warnings = [];
  let buf = [];
  let pendingSection = null;

  const flush = () => {
    if (!buf.length) return;
    const usable = buf.length - (buf.length % 4);
    if (buf.length % 4) {
      warnings.push(
        buf.length === 6
          ? 'Un bloc de 6 lignes a été trouvé : ressemble à une tablature de guitare (ignoré).'
          : `Un bloc de ${buf.length} lignes de tablature a été ignoré (4 cordes attendues).`
      );
    }
    if (buf.length !== 6) {
      for (let k = 0; k < usable; k += 4) {
        if (pendingSection) {
          sections.push({ name: pendingSection, col: columns.length });
          pendingSection = null;
        }
        appendSystem(buf.slice(k, k + 4), columns);
      }
    }
    buf = [];
  };

  for (const line of String(text || '').replace(/\r/g, '').split('\n')) {
    const c = classify(line);
    if (c.type === 'tab') {
      buf.push(c);
      continue;
    }
    flush();
    if (c.type === 'section') pendingSection = c.name;
  }
  flush();

  // Retire une barre de mesure finale isolée et numérote les pas de temps.
  while (columns.length && columns[columns.length - 1].bar) columns.pop();
  let step = 0;
  let noteCount = 0;
  for (const col of columns) {
    col.step = step;
    if (!col.bar) step++;
    noteCount += col.notes.length;
  }
  for (const s of sections) s.col = Math.min(s.col, Math.max(0, columns.length - 1));

  return { columns, sections, totalSteps: step, noteCount, warnings };
}

/** Bornes [début, fin) de chaque section, en indices de colonnes. */
export function sectionRanges(parsed) {
  return parsed.sections.map((s, i) => ({
    name: s.name,
    from: s.col,
    to: i + 1 < parsed.sections.length ? parsed.sections[i + 1].col : parsed.columns.length,
  }));
}
