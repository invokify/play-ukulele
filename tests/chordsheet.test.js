import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChordSheet, chordShape, parseChordSymbol, chordLineTokens, stripLinks } from '../js/chordsheet.js';

const OPEN = { G: 7, C: 0, E: 4, A: 9 };
const pcsOf = (shape) => new Set(Object.entries(shape).map(([s, f]) => (OPEN[s] + f) % 12));

test('chaque forme contient exactement les notes de l\'accord', () => {
  const roots = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'G#', 'A', 'Bb', 'B'];
  const quals = ['', 'm', '7', 'm7', 'maj7', '6', 'm6', 'sus2', 'sus4', 'dim', 'dim7', 'aug', 'add9', '9', 'm7b5', '7sus4'];
  for (const r of roots) for (const q of quals) {
    const name = r + q;
    const c = parseChordSymbol(name);
    const shape = chordShape(name);
    assert.ok(shape, `forme manquante pour ${name}`);
    const want = new Set(c.intervals.map((i) => (c.root + i) % 12));
    const got = pcsOf(shape);
    for (const p of got) assert.ok(want.has(p), `${name} : note étrangère dans ${JSON.stringify(shape)}`);
    const required = [...want].filter((p) => want.size <= 4 || p !== (c.root + 7) % 12);
    for (const p of required) assert.ok(got.has(p), `${name} : note manquante dans ${JSON.stringify(shape)}`);
  }
});

test('formes usuelles du ukulélé', () => {
  const f = (n) => ['G', 'C', 'E', 'A'].map((s) => chordShape(n)[s]).join('');
  assert.equal(f('C'), '0003');
  assert.equal(f('Em'), '0432');
  assert.equal(f('F'), '2010');
  assert.equal(f('G'), '0232');
  assert.equal(f('Am'), '2000');
  assert.equal(f('G7'), '0212');
  assert.equal(f('C/G'), '0003');
});

test('détection des lignes d\'accords', () => {
  assert.deepEqual(chordLineTokens('G Am F').map((t) => t.name), ['G', 'Am', 'F']);
  assert.deepEqual(chordLineTokens('  C   |  G7  (x2)').map((t) => t.name), ['C', 'G7']);
  assert.equal(chordLineTokens('A day in the life'), null);
  assert.equal(chordLineTokens('Am I dreaming'), null);
  assert.equal(chordLineTokens('Source: www.example.com'), null);
});

test('liens Markdown retirés', () => {
  assert.equal(stripLinks('oh why can\'t [I](https://x.com/I.html)?'), "oh why can't I?");
});

const SHEET = `C Em
First line of the song

F C
[Second line](https://example.com/song.html)


G Am F
Another stanza here


End on C

Source: www.example.com`;

test('grille d\'accords complète', () => {
  const p = parseChordSheet(SHEET, { beatsPerChord: 4, strum: 'island' });
  assert.equal(p.kind, 'chords');
  assert.deepEqual(p.chords.map((c) => c.name), ['C', 'Em', 'F', 'C', 'G', 'Am', 'F', 'C']);
  // 7 accords de 4 temps (8 croches) + accord final de 4 temps
  assert.equal(p.totalSteps, 8 * 8);
  // strophes séparées par 2 lignes vides → parties
  assert.deepEqual(p.sections.map((s) => s.name), ['First line of the song', 'Another stanza here']);
  const lyrics = p.items.filter((i) => i.type === 'line').map((i) => i.lyric);
  assert.deepEqual(lyrics, ['First line of the song', 'Second line', 'Another stanza here', null]);
  // rythme Island sur la 1re mesure : B - B H - H B H
  const dirs = p.columns.slice(0, 8).map((c) => c.dir ?? '-').join('');
  assert.equal(dirs, 'd-du-udu');
  // accord final : un seul coup
  assert.equal(p.columns.slice(-8).filter((c) => c.notes.length).length, 1);
  assert.deepEqual(p.warnings, []);
});

test('sections explicites et accords inconnus', () => {
  const p = parseChordSheet('[Verse]\nC Xyz\nla la\nAm\nla\nChorus:\nG\nho', { beatsPerChord: 2, strum: 'beats' });
  assert.deepEqual(p.sections.map((s) => s.name), ['Verse', 'Chorus']);
  assert.deepEqual(p.chords.map((c) => c.name), ['Am', 'G']); // « Xyz » rend la ligne non-accord
  assert.equal(p.totalSteps, 8);
  assert.equal(p.items.find((i) => i.type === 'text').text, 'C Xyz');
});
