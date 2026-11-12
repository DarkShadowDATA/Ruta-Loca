// Guardado en el celular (fase 5 agregará la nube con la cuenta DarkShadow).
import { VEHICLES, VEH_ORDER, UPG_COST } from './core.js';

const KEY = 'rl_save_v1';
const OLD = 'rl_save_v0';

function blank() {
  return { best: 0, bestScore: 0, runs: 0, coins: 0, owned: { combi: true }, sel: 'combi', upg: {}, sound: true, totalPax: 0, totalM: 0 };
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
  for (const id of VEH_ORDER) s.upg[id] = Object.assign({ cupo: 0, agil: 0, iman: 0 }, s.upg[id] || {});
  return s;
}

export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* lleno o bloqueado */ } }

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
