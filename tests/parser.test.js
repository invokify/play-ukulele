import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTab, sectionRanges } from '../js/parser.js';
import { chordName } from '../js/chords.js';

const INTRO = `[Intro]

A|------0----0----0----0----0----0----0---
E|----0----0----0----0----0----0----0-----
C|----------------------------------------
G|--5----5----5----5----5----5----5-----5-
----------------|
----------------|
----------------|
----------------|`;

test("parse l'exemple de l'intro", () => {
  const p = parseTab(INTRO);
  assert.equal(p.sections.length, 1);
  assert.equal(p.sections[0].name, 'Intro');
  assert.equal(p.noteCount, 22);
  const withNotes = p.columns.filter((c) => c.notes.length);
  assert.deepEqual(withNotes[0].notes, [{ string: 'G', fret: 5 }]);
  assert.deepEqual(withNotes[1].notes, [{ string: 'E', fret: 0 }]);
  assert.deepEqual(withNotes[2].notes, [{ string: 'A', fret: 0 }]);
  // Les 4 lignes sans étiquette prolongent le système précédent.
  assert.equal(p.totalSteps, 40 + 16);
  assert.deepEqual(p.warnings, []);
});

test('accords, frettes à deux chiffres et barres de mesure', () => {
  const p = parseTab(`A|3---|10--|
E|0---|12--|
C|0---|----|
G|0---|----|`);
  const notes = p.columns.filter((c) => c.notes.length);
  assert.equal(notes[0].notes.length, 4);
  assert.deepEqual(notes[1].notes, [{ string: 'A', fret: 10 }, { string: 'E', fret: 12 }]);
  assert.equal(p.columns.filter((c) => c.bar).length, 1);
});

test('ordre des cordes respecté via les étiquettes', () => {
  const p = parseTab(`G|2---
C|0---
E|1---
A|0---`);
  const n = p.columns[0].notes;
  assert.deepEqual(n.find((x) => x.string === 'G'), { string: 'G', fret: 2 });
  assert.deepEqual(n.find((x) => x.string === 'E'), { string: 'E', fret: 1 });
});

test('sections multiples et tablature de guitare ignorée', () => {
  const p = parseTab(`[Couplet]
A|0---
E|----
C|----
G|----
[Refrain]
A|----
E|1---
C|----
G|----
e|----
B|----
G|----
D|----
A|----
E|----`);
  const r = sectionRanges(p);
  assert.deepEqual(r.map((x) => x.name), ['Couplet', 'Refrain']);
  assert.equal(r[1].from, 4);
  assert.equal(p.warnings.length, 1);
});

test('reconnaissance des accords', () => {
  assert.equal(chordName([67, 60, 64, 72]), 'C'); // C : 0003
  assert.equal(chordName([69, 60, 64, 69]), 'Am'); // Am : 2000
  assert.equal(chordName([69, 60, 65, 69]), 'F'); // F : 2010
  assert.equal(chordName([67, 62, 67, 71]), 'G'); // G : 0232
  assert.equal(chordName([67, 64, 67, 71]), 'Em'); // Em : 0432
  assert.equal(chordName([67, 60, 64, 70]), 'C7'); // C7 : 0001
});
