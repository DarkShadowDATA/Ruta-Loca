// Guardado en el celular (fase 5 agregará la nube con la cuenta DarkShadow).
import { VEHICLES, VEH_ORDER, UPG_COST } from './core.js';

const KEY = 'rl_save_v1';
const OLD = 'rl_save_v0';

function blank() {
  return { best: 0, bestScore: 0, runs: 0, coins: 0, owned: { combi: true }, sel: 'combi', upg: {}, sound: true, totalPax: 0, totalM: 0,
    ruta: 1, bestBy: {}, ach: {}, missions: null, paint: '', applied: {}, trialDay: '', totalNears: 0, bossWins: 0, coinsEarned: 0, fullLoads: 0, maxCombo: 0, bestM: 0, timePlayed: 0 };
}

export function loadSave() {
  let s = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = Object.assign(s, JSON.parse(raw));
    else { const o = JSON.parse(localStorage.getItem(OLD) || 'null'); if (o) { s.best = o.best | 0; s.runs = o.runs | 0; } }
  } catch { /* sin guardado: se juega igual */ }
  if (!VEHICLES[s.sel] || !s.owned[s.sel]) s.sel = 'combi';
  s.owned.combi = true;
  if (!s.bestBy[1] && s.best) s.bestBy[1] = s.best;
  if (!s.bestM) s.bestM = s.best | 0;
  for (const id of VEH_ORDER) s.upg[id] = Object.assign({ cupo: 0, agil: 0, iman: 0 }, s.upg[id] || {});
  return s;
}

let persistHook = null;
/** La nube se entera de cada guardado (para subirlo un poco después). */
export function onPersist(fn) { persistHook = fn; }
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* lleno o bloqueado */ } if (persistHook) persistHook(); }

/** Junta dos guardados (celular y nube) sin perder nada: lo mejor de cada uno. La base es el que más monedas ha ganado. */
export function mergeSaves(a, b) {
  if (!b || typeof b !== 'object') return a;
  const [base, other] = (b.coinsEarned | 0) > (a.coinsEarned | 0) ? [b, a] : [a, b];
  const m = JSON.parse(JSON.stringify(base));
  const max = (k) => { m[k] = Math.max(a[k] | 0, b[k] | 0); };
  ['best', 'bestScore', 'bestM', 'maxCombo'].forEach(max);
  m.owned = { ...(other.owned || {}), ...(base.owned || {}) };
  m.bestBy = { ...(other.bestBy || {}) }; for (const r in base.bestBy || {}) m.bestBy[r] = Math.max(m.bestBy[r] | 0, base.bestBy[r] | 0);
  m.ach = { ...(other.ach || {}) }; for (const k in base.ach || {}) m.ach[k] = Math.max(m.ach[k] | 0, base.ach[k] | 0);
  m.upg = m.upg || {}; for (const id in other.upg || {}) { m.upg[id] = m.upg[id] || {}; for (const k in other.upg[id]) m.upg[id][k] = Math.max(m.upg[id][k] | 0, other.upg[id][k] | 0); }
  m.applied = { ...(other.applied || {}), ...(base.applied || {}) };
  m.openRoutes = { ...(other.openRoutes || {}), ...(base.openRoutes || {}) };
  return m;
}
/** Cambia el contenido del guardado sin cambiar el objeto (el juego tiene la referencia). */
export function replaceSave(s, next) { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, next); }

export function buyVehicle(s, id) {
  const v = VEHICLES[id];
  if (!v || s.owned[id] || s.coins < v.price) return false;
  s.coins -= v.price; s.owned[id] = true; s.sel = id; writeSave(s); return true;
}
export function upgradeCost(s, id, key) { const n = s.upg[id][key]; return n >= 3 ? 0 : UPG_COST[n]; }
export function buyUpgrade(s, id, key) {
  const c = upgradeCost(s, id, key);
  if (!s.owned[id] || !c || s.coins < c) return false;
  s.coins -= c; s.upg[id][key]++; writeSave(s); return true;
}
