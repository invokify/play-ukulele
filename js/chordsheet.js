// Grilles d'accords « accords au-dessus des paroles » → colonnes jouables (grattées).

const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const UKE_ORDER = ['G', 'C', 'E', 'A']; // ordre des formes d'accords (GCEA)
const OPEN_PC = { G: 7, C: 0, E: 4, A: 9 };

// Qualité d'accord → [nom canonique, intervalles]
const QUALITIES = {};
const q = (canon, iv, ...aliases) => { for (const a of [canon, ...aliases]) QUALITIES[a] = [canon, iv]; };
q('', [0, 4, 7], 'maj', 'M', 'major');
q('m', [0, 3, 7], 'min', '-', 'mi');
q('7', [0, 4, 7, 10], 'dom7');
q('maj7', [0, 4, 7, 11], 'M7', 'Δ', 'Δ7', 'ma7', 'j7');
q('m7', [0, 3, 7, 10], 'min7', '-7', 'mi7');
q('mmaj7', [0, 3, 7, 11], 'mM7', 'minmaj7', 'm(maj7)');
q('6', [0, 4, 7, 9], 'maj6');
q('m6', [0, 3, 7, 9], 'min6');
q('9', [0, 4, 7, 10, 2]);
q('maj9', [0, 4, 7, 11, 2], 'M9');
q('m9', [0, 3, 7, 10, 2], 'min9');
q('add9', [0, 4, 7, 2], 'add2', '2');
q('madd9', [0, 3, 7, 2], 'm(add9)', 'madd2');
q('sus2', [0, 2, 7]);
q('sus4', [0, 5, 7], 'sus');
q('7sus4', [0, 5, 7, 10], '7sus');
q('7sus2', [0, 2, 7, 10]);
q('dim', [0, 3, 6], '°', 'o', 'mb5');
q('dim7', [0, 3, 6, 9], '°7', 'o7');
q('m7b5', [0, 3, 6, 10], 'ø', 'ø7', 'm7(b5)', 'min7b5');
q('aug', [0, 4, 8], '+', '#5');
q('7#5', [0, 4, 8, 10], 'aug7', '+7');
q('5', [0, 7]);

const CHORD_RE = /^([A-G])([#b♯♭]?)([^/\s]*?)(?:\/([A-G][#b♯♭]?))?$/;
const IGNORED_TOKEN_RE = /^(\|+|-+|\/+|%|\.+|:?\|\|?:?|\(?[x×]\d+\)?|\d+x)$/i;
const NO_CHORD_RE = /^(N\.?C\.?|tacet)$/i;

/** Analyse un symbole d'accord (« Am7 », « F#m », « C/G »…). */
export function parseChordSymbol(token) {
  if (NO_CHORD_RE.test(token)) return { name: 'N.C.', silent: true };
  const m = token.match(CHORD_RE);
  if (!m) return null;
  const quality = QUALITIES[m[3]];
  if (!quality) return null;
  let pc = ROOTS[m[1]];
  if (m[2] === '#' || m[2] === '♯') pc += 1;
  if (m[2] === 'b' || m[2] === '♭') pc -= 1;
  pc = (pc + 12) % 12;
  return { name: token, root: pc, quality: quality[0], intervals: quality[1] };
}

// Formes usuelles (cases sur G C E A). Les autres accords sont calculés.
const SHAPES = {
  '': ['0003', '1114', '2220', '0331', '4442', '2010', '3121', '0232', '5343', '2100', '3211', '4322'],
  m: ['0333', '1104', '2210', '3321', '0432', '1013', '2120', '0231', '1342', '2000', '3111', '4222'],
  7: ['0001', '1112', '2223', '3334', '1202', '2313', '3424', '0212', '1323', '0100', '1211', '2322'],
  m7: ['3333', '1102', '2213', '3324', '0202', '1313', '2424', '0211', '1322', '0000', '1111', '2222'],
  maj7: ['0002', null, '2224', '3335', '1302', '5500', null, '0222', null, '1100', '3210', null],
};

const shapeCache = new Map();

function searchShape(root, intervals) {
  const pcs = new Set(intervals.map((i) => (root + i) % 12));
  let required = [...pcs];
  if (required.length > 4) required = required.filter((p) => p !== (root + 7) % 12); // on omet la quinte
  if (required.length > 4) required = required.slice(0, 4);
  let best = null;
  const MAX = 10;
  const f = [0, 0, 0, 0];
  for (f[0] = 0; f[0] <= MAX; f[0]++)
    for (f[1] = 0; f[1] <= MAX; f[1]++)
      for (f[2] = 0; f[2] <= MAX; f[2]++)
        for (f[3] = 0; f[3] <= MAX; f[3]++) {
          const notes = UKE_ORDER.map((s, i) => (OPEN_PC[s] + f[i]) % 12);
          if (!notes.every((n) => pcs.has(n))) continue;
          if (!required.every((p) => notes.includes(p))) continue;
          const fretted = f.filter((x) => x > 0);
          const max = fretted.length ? Math.max(...fretted) : 0;
          const min = fretted.length ? Math.min(...fretted) : 0;
          const span = max - min;
          if (span > 3) continue;
          const score = max + span * 1.5 + fretted.length * 0.4;
          if (!best || score < best.score) best = { score, frets: [...f] };
        }
  return best?.frets ?? null;
}

/** Cases à jouer pour un accord : { G, C, E, A } ou null si inconnu. */
export function chordShape(token) {
  if (shapeCache.has(token)) return shapeCache.get(token);
  const c = parseChordSymbol(token);
  let frets = null;
  if (c && !c.silent) {
    const known = SHAPES[c.quality]?.[c.root];
    frets = known ? [...known].map(Number) : searchShape(c.root, c.intervals);
  }
  const shape = frets ? Object.fromEntries(UKE_ORDER.map((s, i) => [s, frets[i]])) : null;
  shapeCache.set(token, shape);
  return shape;
}

export const STRUMS = {
  island: { label: 'Island (B · BH · HBH)', steps: { 0: 'd', 2: 'd', 3: 'u', 5: 'u', 6: 'd', 7: 'u' } },
  beats: { label: 'Un coup par temps', steps: { 0: 'd', 2: 'd', 4: 'd', 6: 'd' } },
  du: { label: 'Bas-haut en croches', steps: { 0: 'd', 1: 'u', 2: 'd', 3: 'u', 4: 'd', 5: 'u', 6: 'd', 7: 'u' } },
  single: { label: 'Un coup par accord', single: true },
};

/** Ligne composée uniquement d'accords ? Renvoie les accords avec leur position, sinon null. */
export function chordLineTokens(line) {
  const tokens = [];
  let chordCount = 0;
  for (const m of line.matchAll(/\S+/g)) {
    const t = m[0];
    if (IGNORED_TOKEN_RE.test(t)) continue;
    const c = parseChordSymbol(t.replace(/[,;]$/, ''));
    if (!c) return null;
    tokens.push({ name: c.name.replace(/[,;]$/, ''), start: m.index, end: m.index + t.length });
    chordCount++;
  }
  return chordCount ? tokens : null;
}

const SECTION_BRACKET_RE = /^\[([^\]]+)\]$/;
const SECTION_WORD_RE = /^(intro|verse|chorus|pre-?chorus|bridge|outro|refrain|couplet|pont|solo|interlude|coda|instrumental|ending|fin)(\s*\d+)?\s*:?\s*(\(.*\))?$/i;
const END_RE = /^(?:end|ends|finish|finir|fin)\s+(?:on|with|sur|par)\s+(\S+?)[.!]?$/i;
const LINK_RE = /\[([^\]]+)\]\((?:https?:)?[^)]*\)/g;

export const stripLinks = (text) => String(text || '').replace(LINK_RE, '$1');

function sectionName(t) {
  const b = t.match(SECTION_BRACKET_RE);
  if (b && !parseChordSymbol(b[1].trim())) return b[1].trim();
  if (SECTION_WORD_RE.test(t)) return t.replace(/:$/, '').trim();
  return null;
}

const shorten = (s, n = 30) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/**
 * @returns {{kind:'chords', columns, sections, totalSteps, noteCount, warnings, items, chords, cpb:number}}
 */
export function parseChordSheet(text, { beatsPerChord = 4, strum = 'island' } = {}) {
  const lines = stripLinks(text).replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
  const pattern = STRUMS[strum] || STRUMS.island;
  const hasExplicit = lines.some((l) => sectionName(l.trim()));
  const items = [];
  const chords = [];
  const columns = [];
  const sections = [];
  const unknown = new Set();
  let pendingSection = null;
  let blankRun = 2; // le début du texte compte comme une nouvelle strophe
  const usedNames = new Map();

  const addChord = (name, beats, single = false) => {
    const shape = chordShape(name);
    if (!shape && name !== 'N.C.') unknown.add(name);
    const notes = shape ? UKE_ORDER.map((s) => ({ string: s, fret: shape[s] })) : [];
    const idx = chords.length;
    chords.push({ name, notes, firstCol: columns.length });
    const steps = beats * 2; // une colonne = une croche
    for (let k = 0; k < steps; k++) {
      const dir = single || pattern.single ? (k === 0 ? 'd' : null) : pattern.steps[k % 8] ?? null;
      columns.push({ bar: false, width: 1, notes: dir ? notes : [], text: {}, dir, chord: idx });
    }
    chords[idx].lastCol = columns.length - 1;
    return idx;
  };

  const startSection = (name) => {
    const n = (usedNames.get(name) || 0) + 1;
    usedNames.set(name, n);
    sections.push({ name: n > 1 ? `${name} (${n})` : name, col: columns.length });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      blankRun++;
      items.push({ type: 'blank' });
      continue;
    }
    const newStanza = blankRun >= 2;
    blankRun = 0;

    const sec = sectionName(t);
    if (sec) {
      pendingSection = sec;
      items.push({ type: 'section', name: sec });
      continue;
    }

    const end = t.match(END_RE);
    if (end && chordShape(end[1])) {
      const start = line.indexOf(end[1]);
      const idx = addChord(end[1], 4, true);
      items.push({ type: 'line', raw: line, tokens: [{ name: end[1], start, end: start + end[1].length, chord: idx }], lyric: null });
      continue;
    }

    const tokens = chordLineTokens(line);
    if (!tokens) {
      items.push({ type: 'text', text: line });
      continue;
    }

    let lyric = null;
    const next = lines[i + 1];
    if (next && next.trim() && !sectionName(next.trim()) && !chordLineTokens(next) && !END_RE.test(next.trim())) {
      lyric = next;
      i++;
    }

    if (pendingSection) {
      startSection(pendingSection);
      pendingSection = null;
    } else if (!hasExplicit && newStanza) {
      startSection(shorten((lyric || tokens.map((x) => x.name).join(' ')).trim()));
    }

    for (const tok of tokens) tok.chord = addChord(tok.name, beatsPerChord);
    items.push({ type: 'line', raw: line, tokens, lyric });
  }

  let noteCount = 0;
  columns.forEach((c, k) => {
    c.step = k;
    noteCount += c.notes.length;
  });
  const warnings = unknown.size ? [`Accord(s) non reconnu(s), joué(s) en silence : ${[...unknown].join(', ')}.`] : [];

  return { kind: 'chords', columns, sections, totalSteps: columns.length, noteCount, warnings, items, chords, cpb: 2 };
}
