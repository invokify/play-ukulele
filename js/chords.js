const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

export const noteName = (midi) => NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
export const pitchClass = (midi) => NAMES[((midi % 12) + 12) % 12];

// Ordre = priorité en cas d'ambiguïté.
const TEMPLATES = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
  ['dim', [0, 3, 6]],
  ['dim7', [0, 3, 6, 9]],
  ['m7b5', [0, 3, 6, 10]],
  ['aug', [0, 4, 8]],
  ['add9', [0, 2, 4, 7]],
  ['madd9', [0, 2, 3, 7]],
  ['9', [0, 2, 4, 7, 10]],
  ['7sus4', [0, 5, 7, 10]],
  // Formes sans quinte, fréquentes au ukulélé
  ['7', [0, 4, 10]],
  ['m7', [0, 3, 10]],
  ['maj7', [0, 4, 11]],
  ['5', [0, 7]],
];

export function chordName(midis) {
  const pcs = [...new Set(midis.map((m) => ((m % 12) + 12) % 12))];
  if (pcs.length < 2) return null;
  let best = null;
  for (const root of pcs) {
    const key = pcs.map((p) => (p - root + 12) % 12).sort((a, b) => a - b).join(',');
    TEMPLATES.forEach(([suffix, iv], idx) => {
      if (iv.join(',') === key && (!best || idx < best.idx)) best = { idx, name: NAMES[root] + suffix };
    });
  }
  return best ? best.name : null;
}

/** Décrit ce qui sonne : nom d'accord, ou nom(s) de note. */
export function describe(midis) {
  if (!midis.length) return { title: '—', subtitle: 'silence' };
  const notes = [...midis].sort((a, b) => a - b).map(noteName);
  if (midis.length === 1) return { title: notes[0], subtitle: 'note seule' };
  const chord = chordName(midis);
  return chord
    ? { title: chord, subtitle: `accord · ${notes.join(' ')}` }
    : { title: notes.join(' + '), subtitle: `${midis.length} notes ensemble` };
}
