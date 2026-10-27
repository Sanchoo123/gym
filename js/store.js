// Persistência local (localStorage). Tudo fica no iPhone.
const KEY = 'gym.v1';

const empty = () => ({
  workouts: [],
  active: null,
  routines: [],
  chat: [],
  settings: { rest: 120, increment: 2.5, apiKey: '' },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw);
    return { ...empty(), ...s, settings: { ...empty().settings, ...s.settings } };
  } catch {
    return empty();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Falha a guardar', e);
  }
}

export const store = () => state;

export function replaceAll(next) {
  state = { ...empty(), ...next, settings: { ...empty().settings, ...next.settings } };
  save();
}

export function resetAll() {
  state = empty();
  save();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
