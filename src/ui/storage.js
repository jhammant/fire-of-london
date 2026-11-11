// Safe wrapper around localStorage. Every call is wrapped so the game still works without storage.

export const SAVE_KEY = 'fire-of-london.save.v1';
export const PREFS_KEY = 'fire-of-london.prefs.v1';

/** Returns win.localStorage, or undefined when it is missing or blocked. */
export function browserStorage(win) {
  try {
    return win && win.localStorage ? win.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Creates the save and prefs store on top of a localStorage-like backing (which may be missing or throw). */
export function createStorage(backing) {
  function read(key) {
    try {
      if (!backing) return null;
      const value = backing.getItem(key);
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      if (!backing) return false;
      backing.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    try {
      if (!backing) return false;
      backing.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  return {
    loadSave: () => read(SAVE_KEY),
    saveGame: (text) => typeof text === 'string' && write(SAVE_KEY, text),
    clearSave: () => remove(SAVE_KEY),
    loadPrefs() {
      const text = read(PREFS_KEY);
      if (text === null) return null;
      try {
        const prefs = JSON.parse(text);
        if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return null;
        return { tutorialSeen: prefs.tutorialSeen === true };
      } catch {
        return null;
      }
    },
    savePrefs(prefs) {
      return write(PREFS_KEY, JSON.stringify({ tutorialSeen: Boolean(prefs && prefs.tutorialSeen) }));
    }
  };
}
