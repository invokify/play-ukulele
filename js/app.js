import { parseTab, sectionRanges, STRINGS } from './parser.js';
import { UkeAudio } from './audio.js';
import { Player } from './player.js';
import { Fretboard } from './fretboard.js';
import { TabView } from './tabview.js';
import { describe, noteName, pitchClass } from './chords.js';
import * as store from './storage.js';

const TUNINGS = {
  high: { G: 67, C: 60, E: 64, A: 69 }, // G4 C4 E4 A4 (accordage « rentrant »)
  low: { G: 55, C: 60, E: 64, A: 69 }, // G3 C4 E4 A4
};

const EXAMPLE_TAB = `[Intro]

A|------0----0----0----0----0----0----0---
E|----0----0----0----0----0----0----0-----
C|----------------------------------------
G|--5----5----5----5----5----5----5-----5-
----------------|
----------------|
----------------|
----------------|

[Accords : C – Am – F – G]

A|3-------3-------0-------0-------0-------0-------2-------2-------|
E|0-------0-------0-------0-------1-------1-------3-------3-------|
C|0-------0-------0-------0-------0-------0-------2-------2-------|
G|0-------0-------2-------2-------2-------2-------0-------0-------|

[Mélodie]

A|----------------0---2---3-------3-2-0-----------|
E|--0---1---3---------------------------3---1---0-|
C|0-----------------------------------------------|
G|------------------------------------------------|`;

const $ = (id) => document.getElementById(id);

// ---------- État ----------
let songs = store.loadSongs();
if (!Array.isArray(songs)) {
  songs = [{ id: store.newId(), title: 'Exemple – Intro & accords', tab: EXAMPLE_TAB, bpm: 80, cpb: 4, createdAt: Date.now() }];
  store.saveSongs(songs);
}
const prefs = { tuning: 'high', speed: 100, metronome: false, loop: false, ...store.loadPrefs() };
let current = null; // chanson affichée
let parsed = null;
let editingId = null;
let shownCol = -1; // dernière colonne contenant des notes affichée sur le manche

const audio = new UkeAudio();
const player = new Player(audio, {
  onColumn: (i) => showColumn(i, { pluck: true, scroll: true }),
  onState: (playing) => {
    $('btn-play').textContent = playing ? '⏸' : '▶';
    $('btn-play').setAttribute('aria-label', playing ? 'Pause' : 'Lecture');
  },
  onEnd: () => updateTime(),
});

const fretboard = new Fretboard($('fretboard'), {
  onPick: (string, fret) => {
    const midi = tuning()[string] + fret;
    audio.playNote(midi, 0, string);
    fretboard.show([{ string, fret, label: pitchClass(midi) }], []);
    fretboard.pluck([string]);
    setNow(describe([midi]), [{ string, fret }]);
  },
});
const tabView = new TabView($('tab'), { onSeek: (i) => seek(i, true) });

const tuning = () => TUNINGS[prefs.tuning] || TUNINGS.high;

// ---------- Liste ----------
function renderList() {
  const ul = $('song-list');
  ul.replaceChildren();
  for (const s of songs) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.textContent = s.title;
    b.title = s.title;
    if (current && s.id === current.id && !$('view-song').hidden) b.classList.add('active');
    b.addEventListener('click', () => {
      openSong(s.id);
      $('sidebar').classList.remove('open');
    });
    li.appendChild(b);
    ul.appendChild(li);
  }
}

function showView(name) {
  for (const v of ['view-editor', 'view-song', 'view-empty']) $(v).hidden = v !== name;
  renderList();
}

// ---------- Éditeur ----------
function openEditor(song = null) {
  player.stop();
  editingId = song?.id ?? null;
  $('editor-heading').textContent = song ? 'Modifier la chanson' : 'Nouvelle chanson';
  $('f-title').value = song?.title ?? '';
  $('f-bpm').value = song?.bpm ?? 90;
  $('f-cpb').value = song?.cpb ?? 4;
  $('f-tab').value = song?.tab ?? '';
  updatePreview();
  showView('view-editor');
  $('f-title').focus();
}

function updatePreview() {
  const p = parseTab($('f-tab').value);
  const out = $('f-preview');
  if (!$('f-tab').value.trim()) {
    out.textContent = 'Les lignes A|, E|, C|, G| sont reconnues ; les titres entre crochets ([Intro], [Refrain]…) deviennent des parties.';
    return;
  }
  const parts = [`${p.noteCount} note(s) sur ${p.totalSteps} pas de temps`];
  if (p.sections.length) parts.push(`parties : ${p.sections.map((s) => s.name).join(', ')}`);
  out.textContent = '✓ ' + parts.join(' · ') + (p.warnings.length ? ' — ⚠ ' + p.warnings.join(' ') : '');
}

$('f-tab').addEventListener('input', updatePreview);
$('btn-example').addEventListener('click', () => {
  $('f-tab').value = EXAMPLE_TAB;
  if (!$('f-title').value) $('f-title').value = 'Exemple – Intro & accords';
  updatePreview();
});
$('btn-cancel').addEventListener('click', () => (current ? openSong(current.id) : showView(songs.length ? 'view-song' : 'view-empty')));

$('editor-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    title: $('f-title').value.trim() || 'Sans titre',
    tab: $('f-tab').value,
    bpm: clamp(+$('f-bpm').value || 90, 30, 240),
    cpb: clamp(+$('f-cpb').value || 4, 1, 16),
  };
  if (!parseTab(data.tab).noteCount) {
    $('f-preview').textContent = '⚠ Aucune note reconnue : vérifiez que la tablature contient des lignes A|, E|, C|, G|.';
    $('f-tab').focus();
    return;
  }
  let id = editingId;
  if (id) {
    Object.assign(songs.find((s) => s.id === id), data);
  } else {
    id = store.newId();
    songs.unshift({ id, createdAt: Date.now(), ...data });
  }
  store.saveSongs(songs);
  openSong(id);
});

// ---------- Lecteur ----------
function openSong(id) {
  const song = songs.find((s) => s.id === id);
  if (!song) return;
  player.stop();
  current = song;
  parsed = parseTab(song.tab);
  player.load(parsed);
  player.tuning = tuning();
  player.bpm = song.bpm;
  player.cpb = song.cpb;

  $('song-title').textContent = song.title;
  $('bpm').value = song.bpm;
  $('cpb').value = song.cpb;

  const sel = $('section');
  sel.replaceChildren(new Option('Toute la chanson', ''));
  sectionRanges(parsed).forEach((r, i) => sel.appendChild(new Option(r.name, String(i))));
  sel.value = '';

  const w = $('warnings');
  w.hidden = !parsed.warnings.length;
  w.textContent = parsed.warnings.map((x) => '⚠ ' + x).join(' ');

  $('seek').max = Math.max(0, parsed.totalSteps - 1);
  showView('view-song');
  tabView.setData(parsed);
  shownCol = -1;
  updateSettings();
  const first = noteCol(0, 1);
  if (first >= 0) {
    player.position = first;
    showColumn(first, { pluck: false, scroll: false });
  }
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

const noteCol = (i, dir) => {
  for (let k = i; k >= 0 && k < parsed.columns.length; k += dir) if (parsed.columns[k].notes.length) return k;
  return -1;
};

function midisOf(col) {
  return col.notes.map((n) => tuning()[n.string] + n.fret);
}

function setNow(desc, notes) {
  $('now-title').textContent = desc.title;
  $('now-sub').textContent = desc.subtitle;
  const box = $('now-strings');
  box.replaceChildren();
  for (const s of ['G', 'C', 'E', 'A']) {
    const n = notes.find((x) => x.string === s);
    const d = document.createElement('div');
    if (n) d.className = 'on';
    d.innerHTML = `<small>${s}</small><b>${n ? n.fret : '·'}</b><small>${n ? noteName(tuning()[s] + n.fret) : '&nbsp;'}</small>`;
    d.title = n ? `Corde ${s} : case ${n.fret}` : `Corde ${s} : non jouée`;
    box.appendChild(d);
  }
}

/** Met à jour tout l'affichage pour la colonne i. */
function showColumn(i, { pluck = false, scroll = true } = {}) {
  const col = parsed.columns[i];
  if (!col) return;
  tabView.highlight(i, scroll);
  $('seek').value = col.step;
  updateBeat(col.step);
  updateTime(col.step);

  const nc = col.notes.length ? i : noteCol(i, -1);
  if (nc >= 0 && (nc !== shownCol || pluck)) {
    const c = parsed.columns[nc];
    const nextIdx = noteCol(nc + 1, 1);
    const ghost = nextIdx >= 0 ? parsed.columns[nextIdx].notes : [];
    fretboard.show(
      c.notes.map((n) => ({ ...n, label: n.fret })),
      ghost
    );
    if (pluck && col.notes.length) fretboard.pluck(col.notes.map((n) => n.string));
    setNow(describe(midisOf(c)), c.notes);
    shownCol = nc;
  }
}

function updateBeat(step) {
  const beat = Math.floor(step / player.cpb) % 4;
  const onBeat = step % player.cpb === 0;
  [...$('beat-dots').children].forEach((d, k) => d.classList.toggle('on', k === beat && (onBeat || player.playing)));
}

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function updateTime(step = +$('seek').value) {
  if (!parsed) return;
  $('time').textContent = `${fmt(step * player.sps)} / ${fmt(parsed.totalSteps * player.sps)}`;
}

function seek(i, audition = false) {
  if (!parsed?.columns[i] || parsed.columns[i].bar) return;
  const wasPlaying = player.playing;
  player.pause();
  player.position = i;
  showColumn(i, { pluck: audition, scroll: true });
  if (wasPlaying) player.play(i);
  else if (audition && parsed.columns[i].notes.length) {
    audio.playColumn(parsed.columns[i].notes.map((n) => ({ string: n.string, midi: tuning()[n.string] + n.fret })), 0);
  }
}

function step(dir) {
  if (!parsed) return;
  player.pause();
  let i = player.position < 0 ? 0 : player.position + dir;
  // Saute jusqu'à la prochaine colonne contenant des notes.
  while (i >= 0 && i < parsed.columns.length && !parsed.columns[i].notes.length) i += dir;
  if (i >= 0 && i < parsed.columns.length) seek(i, true);
}

function updateSettings() {
  if (!current) return;
  player.bpm = clamp(+$('bpm').value, 30, 240);
  player.cpb = clamp(+$('cpb').value || 4, 1, 16);
  player.speed = prefs.speed / 100;
  player.metronome = prefs.metronome;
  player.loop = prefs.loop;
  player.tuning = tuning();

  $('bpm-out').textContent = player.bpm;
  $('speed').value = prefs.speed;
  $('speed-out').textContent = `${prefs.speed} %`;
  $('metro').checked = prefs.metronome;
  $('loop').checked = prefs.loop;
  $('tuning').value = prefs.tuning;
  fretboard.setTuningLabels(Object.fromEntries(STRINGS.map((s) => [s, noteName(tuning()[s])])));

  const eff = Math.round(player.bpm * player.speed);
  const noteDur = Math.round(player.sps * 1000);
  $('effective').textContent =
    `Tempo effectif : ${eff} BPM · 1 tiret = ${noteDur} ms · 1 temps = ${player.cpb} tirets`;
  updateTime();
}

function persistSong() {
  if (!current) return;
  current.bpm = player.bpm;
  current.cpb = player.cpb;
  store.saveSongs(songs);
}

$('bpm').addEventListener('input', () => { updateSettings(); persistSong(); });
$('cpb').addEventListener('change', () => { updateSettings(); persistSong(); });
$('speed').addEventListener('input', (e) => { prefs.speed = +e.target.value; store.savePrefs(prefs); updateSettings(); });
$('metro').addEventListener('change', (e) => { prefs.metronome = e.target.checked; store.savePrefs(prefs); updateSettings(); });
$('loop').addEventListener('change', (e) => { prefs.loop = e.target.checked; store.savePrefs(prefs); updateSettings(); });
$('tuning').addEventListener('change', (e) => {
  prefs.tuning = e.target.value;
  store.savePrefs(prefs);
  updateSettings();
  if (player.position >= 0) { shownCol = -1; showColumn(player.position, { scroll: false }); }
});

$('section').addEventListener('change', (e) => {
  const wasPlaying = player.playing;
  player.pause();
  const ranges = sectionRanges(parsed);
  const r = e.target.value === '' ? { from: 0, to: parsed.columns.length } : ranges[+e.target.value];
  player.region = [r.from, r.to];
  const first = parsed.columns.findIndex((c, k) => k >= r.from && !c.bar);
  if (first >= 0 && first < r.to) {
    player.position = first;
    showColumn(first, { scroll: true });
  }
  if (wasPlaying) player.play();
});

$('seek').addEventListener('input', (e) => {
  const target = +e.target.value;
  const i = parsed.columns.findIndex((c) => !c.bar && c.step === target);
  if (i >= 0) seek(i, false);
});

function togglePlay() {
  if (!parsed) return;
  if (player.playing) player.pause();
  else player.play();
}

$('btn-play').addEventListener('click', togglePlay);
$('btn-stop').addEventListener('click', () => {
  player.stop();
  const i = parsed.columns.findIndex((c, k) => k >= player.region[0] && !c.bar);
  if (i >= 0) showColumn(i, { scroll: true });
});
$('btn-prev').addEventListener('click', () => step(-1));
$('btn-next').addEventListener('click', () => step(1));

$('btn-edit').addEventListener('click', () => openEditor(current));
$('btn-delete').addEventListener('click', () => {
  if (!current || !confirm(`Supprimer « ${current.title} » ?`)) return;
  player.stop();
  songs = songs.filter((s) => s.id !== current.id);
  store.saveSongs(songs);
  current = null;
  if (songs.length) openSong(songs[0].id);
  else showView('view-empty');
});

$('btn-new').addEventListener('click', () => openEditor());
$('btn-new-2').addEventListener('click', () => openEditor());
$('btn-menu').addEventListener('click', () => $('sidebar').classList.toggle('open'));

document.addEventListener('keydown', (e) => {
  if ($('view-song').hidden || e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.code === 'Space') {
    if (e.target.closest('button')) return; // laisse le bouton focalisé réagir normalement
    e.preventDefault();
    togglePlay();
  }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
});

// ---------- Démarrage ----------
if (songs.length) openSong(songs[0].id);
else showView('view-empty');
