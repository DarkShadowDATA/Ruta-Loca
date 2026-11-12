// Misiones diarias, logros (medallas) y estadísticas. Todo se guarda en el celular (fase 5: nube).
import { ROUTES, ROUTE_ORDER, VEH_ORDER } from './core.js';

// ---------- misiones diarias ----------
export const MISSION_POOL = [
  { id: 'entregar', text: (n) => `Entrega ${n} pasajeros`, n: 30, reward: 80 },
  { id: 'casi',     text: (n) => `Haz ${n} «¡Casi!»`, n: 10, reward: 80 },
  { id: 'metros',   text: (n) => `Llega a ${n} m en una partida`, n: 1500, reward: 100, best: true },
  { id: 'trailer',  text: () => 'Aguántale 1 vez al Tráiler', n: 1, reward: 120 },
  { id: 'partidas', text: (n) => `Juega ${n} partidas`, n: 8, reward: 60 },
  { id: 'paradas',  text: (n) => `Sube pasaje en ${n} paradas`, n: 6, reward: 60 },
  { id: 'monedas',  text: (n) => `Gana ${n} monedas`, n: 300, reward: 80 },
];

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function dailyMissions(save) {
  const day = today();
  if (!save.missions || save.missions.day !== day) {
    const pool = MISSION_POOL.map((m) => m.id);
    const picked = [];
    let h = hash('ruta-loca:' + day);
    while (picked.length < 3) { const i = h % pool.length; picked.push(pool.splice(i, 1)[0]); h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; }
    save.missions = { day, list: picked.map((id) => ({ id, p: 0, done: false, paid: false })) };
  }
  return save.missions.list.map((m) => ({ ...m, def: MISSION_POOL.find((d) => d.id === m.id) }));
}

// ---------- logros: 10 × bronce / plata / oro ----------
export const ACHIEVEMENTS = [
  { id: 'lejos',     name: 'Sin parar',        text: 'Metros en una partida',        stat: 'bestM',      lv: [1000, 2500, 5000] },
  { id: 'pasaje',    name: 'Chofer de oficio', text: 'Pasajeros entregados',         stat: 'totalPax',   lv: [100, 500, 2000] },
  { id: 'casi',      name: 'De milagro',       text: '«¡Casi!» en total',            stat: 'totalNears', lv: [25, 150, 600] },
  { id: 'combo',     name: 'Rozón maestro',    text: 'Combo más alto',               stat: 'maxCombo',   lv: [2, 3, 5] },
  { id: 'trailer',   name: 'Mata tráileres',   text: 'Tráileres aguantados',         stat: 'bossWins',   lv: [1, 10, 50] },
  { id: 'partidas',  name: 'Otra vuelta',      text: 'Partidas jugadas',             stat: 'runs',       lv: [10, 100, 500] },
  { id: 'monedas',   name: 'Alcancía',         text: 'Monedas ganadas en total',     stat: 'coinsEarned', lv: [1000, 10000, 50000] },
  { id: 'garaje',    name: 'Flotilla',         text: 'Vehículos en tu garaje',       stat: 'owned',      lv: [2, 4, 6] },
  { id: 'rutas',     name: 'Trotamundos',      text: 'Rutas abiertas',               stat: 'routes',     lv: [2, 3, 4] },
  { id: 'llena',     name: '¡Hasta el tope!',  text: 'Entregas con el vehículo lleno', stat: 'fullLoads', lv: [1, 10, 50] },
];
export const MEDAL = ['🥉', '🥈', '🥇'];
export const MEDAL_REWARD = [50, 150, 400];

export function statValue(save, stat) {
  if (stat === 'owned') return VEH_ORDER.filter((id) => save.owned[id]).length;
  if (stat === 'routes') return ROUTE_ORDER.filter((r) => routeOpen(save, r)).length;
  return save[stat] | 0;
}
export function medals(save) {
  let n = 0;
  for (const a of ACHIEVEMENTS) n += save.ach?.[a.id] | 0;
  return n;
}
/** Revisa logros nuevos, da sus monedas y regresa la lista de los que se ganaron ahora. */
export function checkAchievements(save) {
  save.ach = save.ach || {};
  const got = [];
  for (const a of ACHIEVEMENTS) {
    const v = statValue(save, a.stat);
    let have = save.ach[a.id] | 0;
    while (have < 3 && v >= a.lv[have]) { save.coins += MEDAL_REWARD[have]; got.push({ a, level: have }); have++; }
    save.ach[a.id] = have;
  }
  return got;
}

// ---------- rutas ----------
export function routeOpen(save, r) {
  if (r === 1) return true;
  const prev = ROUTE_ORDER[ROUTE_ORDER.indexOf(r) - 1];
  return (save.bestBy?.[prev] | 0) >= ROUTES[r].unlock || !!save.openRoutes?.[r];
}

/** Suma una partida terminada a misiones, estadísticas y logros. g = juego del núcleo. */
export function addRun(save, g, m, c) {
  save.runs = (save.runs | 0) + 1;
  save.totalM = (save.totalM | 0) + m;
  save.totalPax = (save.totalPax | 0) + g.delivered;
  save.totalNears = (save.totalNears | 0) + g.nears;
  save.bossWins = (save.bossWins | 0) + g.bossWins;
  save.coinsEarned = (save.coinsEarned | 0) + c;
  save.fullLoads = (save.fullLoads | 0) + g.fullLoads;
  save.maxCombo = Math.max(save.maxCombo | 0, g.maxCombo);
  save.bestM = Math.max(save.bestM | 0, m);
  save.timePlayed = (save.timePlayed | 0) + Math.round(g.t);
  save.bestBy = save.bestBy || {};
  const before = ROUTE_ORDER.filter((r) => routeOpen(save, r));
  save.bestBy[g.ruta] = Math.max(save.bestBy[g.ruta] | 0, m);
  const opened = ROUTE_ORDER.filter((r) => routeOpen(save, r) && !before.includes(r));

  const add = { entregar: g.delivered, casi: g.nears, metros: m, trailer: g.bossWins, partidas: 1, paradas: g.stopsBoarded | 0, monedas: c };
  const missionsDone = [];
  for (const mi of dailyMissions(save)) {
    const st = save.missions.list.find((x) => x.id === mi.id);
    if (st.done) continue;
    st.p = mi.def.best ? Math.max(st.p, add[mi.id]) : st.p + add[mi.id];
    if (st.p >= mi.def.n) { st.p = mi.def.n; st.done = true; st.paid = true; save.coins += mi.def.reward; missionsDone.push(mi); }
  }
  return { opened, missionsDone, medals: checkAchievements(save) };
}
