const KEY = 'ukulele-songs-v1';
const PREFS = 'ukulele-prefs-v1';

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : l'app reste utilisable pendant la session */
  }
}

export const loadSongs = () => read(KEY, null);
export const saveSongs = (songs) => write(KEY, songs);
export const loadPrefs = () => read(PREFS, {});
export const savePrefs = (prefs) => write(PREFS, prefs);
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
