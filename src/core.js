// Ruta Loca — núcleo del juego (sin Phaser, sin DOM, sin reloj).
// Paso fijo de 1/60 s y azar con semilla: la misma semilla, el mismo vehículo
// y la misma lista de toques dan SIEMPRE la misma partida. El servidor usará
// una copia de este archivo para volver a jugar una partida (Pozo, fase 6).
// No usar Math.random, Date ni nada que cambie entre máquinas.
//
// Idea clave: la velocidad depende SOLO del tiempo (no de lo que haga el
// jugador). Así se puede calcular de antemano en qué punto de la calle
// alcanzará la combi a cada fila de tráfico, y acomodar ahí paradas, eventos
// y al Tráiler sin que nunca se forme un muro imposible.

export const W = 720;
export const H = 1280;
export const DT = 1 / 60;
export const LANES = 4;
export const ROAD_X = 60;            // orilla izquierda del asfalto
export const LANE_W = 150;           // 4 carriles = 600 px
export const PLAYER_Y = 1010;        // dónde se dibuja el vehículo en pantalla
export const PX_PER_M = 40;
export const RIGHT = LANES - 1;      // carril de las paradas
const M = PX_PER_M;

export const CFG = {
  speed0: 420, accel: 6, speedMax: 1400,
  trafficSpeed: 140,    // el tráfico avanza parejo (así las filas nunca se juntan en un muro)
  hit: 0.8,             // caja de golpe = 80 % del dibujo
  spawnAhead: 1500,
  firstRow: 620,
  jitter: 70,
  reactStart: 0.46, reactEnd: 0.25, reactTime: 70,
  startLane: 1,
  // fase 2
  stopEvery: 600 * M, stopVar: 80 * M,       // paradas cada ~600 m
  terminalEvery: 1500 * M,                   // terminal cada 1 500 m
  zone: 320,                                 // filas que llegan cerca de una parada dejan libre el carril derecho
  parkedChance: 0.35,
  nearGap: 14, nearCooldown: 2, comboWindow: 4, nearPts: 50, nearSlow: 0.35,
  paxPts: 10, paxCoins: 5, coinsPer100m: 1, coinCap: 300,
  // fase 4
  eventFrom: 500 * M, eventMin: 400 * M, eventMax: 600 * M, warn: 2,
  tianguisLen: 300 * M, rainTime: 15, rainMul: 0.6, bacheLen: 200 * M,
  bossEvery: 2000 * M, bossTime: 20, bossCoins: 200,
};

// Vehículos del Garaje (fase 3). w × l = tamaño del dibujo; lane = px/s de lado.
export const VEHICLES = {
  combi:       { name: 'Combi',             price: 0,    cap: 8,  w: 92,  l: 180, lane: 1500, coinMul: 1,   shield: 0, nearMul: 1 },
  vocho:       { name: 'Vocho',             price: 400,  cap: 4,  w: 78,  l: 148, lane: 1950, coinMul: 1,   shield: 0, nearMul: 1 },
  micro:       { name: 'Micro',             price: 900,  cap: 14, w: 100, l: 240, lane: 1400, coinMul: 1,   shield: 0, nearMul: 1 },
  taxi:        { name: 'Taxi',              price: 1500, cap: 4,  w: 88,  l: 168, lane: 1600, coinMul: 1.2, shield: 0, nearMul: 1 },
  guajolotero: { name: 'Camión guajolotero', price: 2500, cap: 20, w: 104, l: 250, lane: 1300, coinMul: 1,   shield: 1, nearMul: 1 },
  moto:        { name: 'Moto de reparto',   price: 3500, cap: 1,  w: 46,  l: 112, lane: 1700, coinMul: 1,   shield: 0, nearMul: 2 },
};
export const VEH_ORDER = ['combi', 'vocho', 'micro', 'taxi', 'guajolotero', 'moto'];
export const UPGRADES = {
  cupo:  { name: 'Cupo',     desc: (v, n) => `+${upCap(v, n)} lugares` },
  agil:  { name: 'Agilidad', desc: (v, n) => `+${n * 8} % más rápido de lado` },
  iman:  { name: 'Imán',     desc: (v, n) => `+${n * 10} % de monedas` },
};
export const UPG_COST = [150, 400, 900];
function upCap(v, n) { return n === 0 ? 0 : Math.max(n, Math.round(VEHICLES[v].cap * 0.15 * n)); }

// Tráfico (tamaño del dibujo).
export const VEH = {
  sedan_rojo: { w: 88,  l: 168 }, sedan_azul: { w: 88,  l: 168 }, taxi: { w: 88, l: 168 },
  camioneta:  { w: 98,  l: 200 }, camion:     { w: 108, l: 260 }, moto: { w: 46, l: 112 },
};
const MAX_LEN = 260;
const TRAFFIC = [
  ['sedan_rojo', 22], ['sedan_azul', 22], ['taxi', 18],
  ['camioneta', 16], ['camion', 12], ['moto', 10],
];
const TRAFFIC_TOTAL = TRAFFIC.reduce((a, t) => a + t[1], 0);
const TRAILER = { l: 620 };
const DOG = { w: 54, l: 40, speed: 260 };
const BACHE = { w: 56, l: 44 };

export function laneX(lane) { return ROAD_X + LANE_W * (lane + 0.5); }

function rnd(g) {   // mulberry32
  g.rs = (g.rs + 0x6D2B79F5) | 0;
  let t = g.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rint(g, n) { return Math.floor(rnd(g) * n); }

// ---- recorrido según el tiempo (igual en cualquier partida) ----
const CUM = [0];
function speedAt(tick) { return Math.min(CFG.speedMax, CFG.speed0 + CFG.accel * tick * DT); }
function cum(n) {
  while (CUM.length <= n) { const i = CUM.length; CUM.push(CUM[i - 1] + speedAt(i) * DT); }
  return CUM[n];
}
function tickAtDist(d) {          // primer tick en que la combi ya llegó a d
  let lo = 0, hi = 64;
  while (cum(hi) < d) hi *= 2;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cum(m) < d) lo = m + 1; else hi = m; }
  return lo;
}
// tick en que la combi alcanza algo que hoy (tick n0) está en s0 y avanza adv px por tick
function meetTick(s0, n0, adv) {
  let n = Math.max(n0, tickAtDist(s0));
  while (cum(n) < s0 + adv * (n - n0)) n++;
  return n;
}

export function vehicleStats(id = 'combi', upg = {}) {
  const v = VEHICLES[id] || VEHICLES.combi;
  const key = VEHICLES[id] ? id : 'combi';
  const c = upg.cupo | 0, a = upg.agil | 0, m = upg.iman | 0;
  return {
    id: key, name: v.name, w: v.w, l: v.l,
    cap: v.cap + upCap(key, c),
    lane: v.lane * (1 + 0.08 * a),
    coinMul: v.coinMul * (1 + 0.1 * m),
    shield: v.shield, nearMul: v.nearMul,
  };
}

export function createGame(seed, opts = {}) {
  const P = vehicleStats(opts.veh, opts.upg);
  const g = {
    seed: seed >>> 0, rs: seed >>> 0, god: !!opts.god,
    P, tick: 0, t: 0, dist: 0, speed: CFG.speed0,
    lane: CFG.startLane, x: laneX(CFG.startLane), alive: true,
    vehicles: [], nextId: 1, rows: 0, safe: CFG.startLane, lastRowS: 0, plan: null,
    inputs: [], events: [], crashWith: null,
    // fase 2
    pax: 0, delivered: 0, nearPts: 0, nears: 0, combo: 0, lastNear: -99, boarded: 0,
    // fase 3/4
    shield: P.shield, invul: 0, bossCoins: 0, bossWins: 0,
    feats: [],            // paradas, terminales, eventos y jefes ya planeados (en orden de distancia)
    nextStop: 0, nextTerm: CFG.terminalEvery, nextEvent: CFG.eventFrom, lastEvent: '', nextBoss: CFG.bossEvery,
    rain: 0, boss: null, dog: null, baches: [],
  };
  g.nextStop = CFG.stopEvery + rint(g, CFG.stopVar * 2) - CFG.stopVar;
  planFeatures(g);
  spawnRow(g, CFG.firstRow, false);
  fillRows(g);
  return g;
}

// ---------- paradas, terminales, eventos y jefe ----------
function bossEnd(start) {
  const t0 = tickAtDist(start);
  return cum(t0 + Math.round((CFG.bossTime + 6) / DT)) + 300;
}
function inBoss(g, s) {
  for (const f of g.feats) if (f.type === 'boss' && s > f.s - 700 && s < f.end + 300) return true;
  return false;
}
function planFeatures(g) {
  const horizon = g.dist + 9000;
  // jefe: primero, para que lo demás lo rodee
  while (g.nextBoss < horizon + 40000) {
    const s = g.nextBoss;
    g.feats.push({ type: 'boss', s, end: bossEnd(s), warned: false, done: false });
    g.nextBoss += CFG.bossEvery;
  }
  while (g.nextEvent < horizon) {
    let s = g.nextEvent;
    if (inBoss(g, s)) s = g.feats.find((f) => f.type === 'boss' && s > f.s - 700 && s < f.end + 300).end + 800;
    const kinds = ['tianguis', 'lluvia', 'perro', 'baches'].filter((k) => k !== g.lastEvent);
    const type = kinds[rint(g, kinds.length)];
    const f = { type, s, warned: false, done: false };
    if (type === 'tianguis') {
      const n = 2 + rint(g, 2), left = rnd(g) < 0.5;
      f.blocks = []; for (let i = 0; i < n; i++) f.blocks.push(left ? i : RIGHT - i);
      f.len = CFG.tianguisLen;
      if (inBoss(g, s + f.len)) { f.type = 'lluvia'; delete f.blocks; }
    }
    if (f.type === 'baches') { f.len = CFG.bacheLen; spawnBaches(g, f); }
    if (f.type === 'perro') { f.fromLeft = rnd(g) < 0.5; f.lead = 1.0 + rnd(g) * 0.9; }
    g.feats.push(f);
    g.lastEvent = f.type;
    g.nextEvent = s + (f.len || 0) + CFG.eventMin + rint(g, CFG.eventMax - CFG.eventMin);
  }
  while (g.nextTerm < horizon) {
    let s = g.nextTerm;
    if (inBoss(g, s)) s = g.feats.find((f) => f.type === 'boss' && s > f.s - 700 && s < f.end + 300).end + 1200;
    const tg = g.feats.find((f) => f.type === 'tianguis' && f.blocks.includes(RIGHT) && s > f.s - 900 && s < f.s + f.len + 500);
    if (tg) s = tg.s + tg.len + 900;
    g.feats.push({ type: 'terminal', s, len: 520, done: false });
    g.nextTerm = s + CFG.terminalEvery;
  }
  while (g.nextStop < horizon) {
    const s = g.nextStop;
    const near = g.feats.some((f) => (f.type === 'terminal' && Math.abs(f.s - s) < 160 * M) || (f.type === 'tianguis' && s > f.s - 800 && s < f.s + f.len + 400 && f.blocks.includes(RIGHT)));
    if (!near && !inBoss(g, s)) g.feats.push({ type: 'stop', s, len: 240, done: false });
    g.nextStop = s + CFG.stopEvery + rint(g, CFG.stopVar * 2) - CFG.stopVar;
  }
  g.feats.sort((a, b) => a.s - b.s);
}
function spawnBaches(g, f) {
  for (let s = f.s; s < f.s + f.len; s += 380 + rint(g, 260)) {
    g.baches.push({ id: g.nextId++, lane: rint(g, LANES), s, hit: false });
  }
}
function featAt(g, m) {   // qué pasa en el punto m de la calle
  const r = { stop: false, free: null, dog: false, boss: false };
  for (const f of g.feats) {
    if (f.type === 'boss' && m > f.s - 700 && m < f.end + 300) r.boss = true;
    if ((f.type === 'stop' || f.type === 'terminal') && m > f.s - CFG.zone && m < f.s + f.len + CFG.zone) r.stop = true;
    if (f.type === 'tianguis' && m > f.s - 1400 && m < f.s + f.len + 250) {
      r.free = []; for (let l = 0; l < LANES; l++) if (!f.blocks.includes(l)) r.free.push(l);
    }
    if (f.type === 'perro' && Math.abs(m - f.s) < 560) r.dog = true;
  }
  return r;
}

// ---------- tráfico ----------
function laneSpeedNow(g) { return g.P.lane * (g.rain > 0 ? CFG.rainMul : 1); }
function relSpeed(g) { return g.speed + 30 - CFG.trafficSpeed; }

function planRow(g) {
  const first = g.rows < 2;
  const maxShift = first ? 0 : (g.t < 18 ? 1 : (g.t < 50 ? 2 : 3));
  const shift0 = maxShift === 0 ? 0 : rint(g, maxShift * 2 + 1) - maxShift;
  let safe = g.safe + shift0;
  if (safe < 0) safe = -safe;
  if (safe > LANES - 1) safe = 2 * (LANES - 1) - safe;
  g.plan = { safe, extra: rint(g, 110) };
}
function rowGap(g, shift) {
  const k = Math.min(1, g.t / CFG.reactTime);
  const react = CFG.reactStart + (CFG.reactEnd - CFG.reactStart) * k;
  // si llueve (o va a llover) se calcula con el cambio de carril lento
  const rainSoon = g.rain > 0 || g.feats.some((f) => f.type === 'lluvia' && !f.done && f.s - g.dist < 4000);
  const laneTime = LANE_W / (g.P.lane * (rainSoon ? CFG.rainMul : 1));
  return 2 * CFG.jitter + MAX_LEN + g.P.l + relSpeed(g) * (laneTime * shift + react) + g.plan.extra;
}
function fillRows(g) {
  for (let guard = 0; guard < 20; guard++) {
    if (!g.plan) planRow(g);
    let safe = g.plan.safe;
    let s = g.lastRowS + rowGap(g, Math.abs(safe - g.safe));
    if (s - g.dist > CFG.spawnAhead) return;
    const m = cum(meetTick(s, g.tick, CFG.trafficSpeed * DT));
    const f = featAt(g, m);
    if (f.free && !f.free.includes(safe)) safe = f.free.reduce((a, b) => (Math.abs(b - g.safe) < Math.abs(a - g.safe) ? b : a));
    if (f.stop && (!f.free || f.free.includes(RIGHT))) safe = RIGHT;
    if (safe !== g.plan.safe) {
      s = g.lastRowS + rowGap(g, Math.abs(safe - g.safe));
      if (s - g.dist > CFG.spawnAhead) { g.plan.safe = safe; return; }
    }
    g.plan = null;
    if (f.boss || f.dog) { g.lastRowS = s; g.rows++; continue; }   // aquí no sale tráfico
    g.safe = safe;
    spawnRow(g, s, true, m, f);
  }
}

function pickType(g) {
  let r = rint(g, TRAFFIC_TOTAL), type = TRAFFIC[0][0];
  for (const [name, wgt] of TRAFFIC) { if (r < wgt) { type = name; break; } r -= wgt; }
  return type;
}
function spawnRow(g, s, useFeat, meet = 0, f = null) {
  const t = g.t;
  let n = 1;
  if (g.rows >= 2) {
    const p3 = Math.max(0, Math.min(0.45, (t - 20) / 80));
    const p2 = Math.max(0.3, Math.min(0.85, 0.3 + t / 55));
    if (rnd(g) < p3) n = 3; else if (rnd(g) < p2) n = 2;
  }
  const lanes = [];
  for (let i = 0; i < LANES; i++) {
    if (i === g.safe) continue;
    if (f && f.free && !f.free.includes(i)) continue;   // ahí está el tianguis
    lanes.push(i);
  }
  while (lanes.length > n) lanes.splice(rint(g, lanes.length), 1);
  const adv = CFG.trafficSpeed * DT;
  for (const lane of lanes) {
    const type = pickType(g);
    const jit = rint(g, CFG.jitter * 2 + 1) - CFG.jitter;
    g.vehicles.push({ id: g.nextId++, type, lane, x: laneX(lane), s: s + jit, adv, parked: false });
  }
  // carril derecho: coches estacionados (quietos; se acomodan para quedar en su fila al llegar la combi)
  if (useFeat && g.rows >= 3 && g.safe !== RIGHT && !lanes.includes(RIGHT) && !(f && (f.stop || f.free)) && rnd(g) < CFG.parkedChance) {
    const jit = rint(g, CFG.jitter * 2 + 1) - CFG.jitter;
    g.vehicles.push({ id: g.nextId++, type: pickType(g), lane: RIGHT, x: laneX(RIGHT) + 8, s: meet + jit, adv: 0, parked: true });
  }
  g.lastRowS = s;
  g.rows++;
}

// ---------- obstáculos (para choques y para el piloto automático) ----------
export function obstacles(g) {
  const out = [];
  for (const v of g.vehicles) {
    if (v.gone) continue;
    const d = VEH[v.type];
    out.push({ kind: 'veh', id: v.id, ref: v, x: v.x, s: v.s, w: d.w * CFG.hit, l: d.l * CFG.hit });
  }
  for (const f of g.feats) {
    if (f.type === 'tianguis' && f.s + f.len > g.dist - 300 && f.s < g.dist + 2200) {
      const lo = Math.min(...f.blocks), hi = Math.max(...f.blocks);
      const x0 = ROAD_X + LANE_W * lo + 6, x1 = ROAD_X + LANE_W * (hi + 1) - 6;
      out.push({ kind: 'tianguis', id: -1, x: (x0 + x1) / 2, s: f.s + f.len / 2, w: x1 - x0, l: f.len });
    }
  }
  if (g.boss && g.boss.phase !== 'gone') {
    const b = g.boss;
    out.push({ kind: 'trailer', id: -2, x: b.x, s: g.dist + b.off, w: LANE_W * 3 - 10, l: TRAILER.l * CFG.hit });
  }
  if (g.dog && g.dog.active) out.push({ kind: 'dog', id: -3, x: g.dog.x, s: g.dog.s, w: DOG.w * CFG.hit, l: DOG.l * CFG.hit });
  return out;
}

// ---------- un paso de 1/60 s ----------  dir: -1 izquierda, 0 nada, 1 derecha
export function step(g, dir) {
  g.events.length = 0;
  if (!g.alive) return g;

  if (dir === -1 || dir === 1) {
    const nl = g.lane + dir;
    if (nl >= 0 && nl < LANES) { g.lane = nl; g.inputs.push([g.tick, dir]); g.events.push('lane'); }
  }

  g.tick++;
  g.t = g.tick * DT;
  const prev = g.dist;
  g.speed = speedAt(g.tick);
  g.dist = cum(g.tick);
  if (g.invul > 0) g.invul -= DT;
  if (g.rain > 0) { g.rain -= DT; if (g.rain <= 0) g.events.push('rain_end'); }

  const tx = laneX(g.lane), dx = laneSpeedNow(g) * DT;
  if (g.x < tx) g.x = Math.min(tx, g.x + dx); else if (g.x > tx) g.x = Math.max(tx, g.x - dx);

  // tráfico
  g.lastRowS += CFG.trafficSpeed * DT;
  const vs = g.vehicles;
  let w = 0;
  for (let i = 0; i < vs.length; i++) { const v = vs[i]; v.s += v.adv; if (v.s >= g.dist - 420) vs[w++] = v; }
  vs.length = w;
  if (g.baches.length && g.baches[0].s < g.dist - 400) g.baches = g.baches.filter((b) => b.s >= g.dist - 400);

  planFeatures(g);
  features(g, prev);
  fillRows(g);
  nearMisses(g);

  // choque
  if (!g.god && g.invul <= 0) {
    const pw = g.P.w * CFG.hit, pl = g.P.l * CFG.hit;
    for (const o of obstacles(g)) {
      if (Math.abs(o.x - g.x) < (pw + o.w) / 2 && Math.abs(o.s - g.dist) < (pl + o.l) / 2) {
        if (g.shield > 0) {
          g.shield--; g.invul = 1.2; g.events.push('shield');
          if (o.ref) { o.ref.gone = true; g.knocked = o.ref; }
          break;
        }
        g.alive = false; g.crashWith = o.id; g.crashKind = o.kind; g.events.push('crash');
        break;
      }
    }
  }
  return g;
}

function inRight(g) { return Math.abs(g.x - laneX(RIGHT)) < 40; }

function features(g, prev) {
  for (const f of g.feats) {
    if (f.done) continue;
    if (f.s - g.dist > 4000) break;
    // aviso 2 s antes (eventos y jefe)
    if (!f.warned && f.type !== 'stop' && f.type !== 'terminal' && g.tick >= tickAtDist(f.s) - Math.round(CFG.warn / DT)) {
      f.warned = true; g.events.push('warn:' + f.type);
    }
    if (f.type === 'stop') {
      if (prev < f.s + f.len / 2 && g.dist >= f.s + f.len / 2) {
        f.done = true;
        if (inRight(g) && g.pax < g.P.cap) {
          const k = Math.min(g.P.cap - g.pax, 2 + rint(g, 3));
          g.pax += k; g.boarded += k; g.events.push('board:' + k);
        } else g.events.push('stop_miss');
      }
    } else if (f.type === 'terminal') {
      if (prev < f.s + f.len / 2 && g.dist >= f.s + f.len / 2) {
        f.done = true;
        if (inRight(g) && g.pax > 0) { const k = g.pax; g.delivered += k; g.pax = 0; g.events.push('deliver:' + k); }
        else g.events.push('term_miss');
      }
    } else if (f.type === 'lluvia') {
      if (g.dist >= f.s) { f.done = true; g.rain = CFG.rainTime; g.events.push('rain'); }
    } else if (f.type === 'perro') {
      if (!g.dog && g.tick >= tickAtDist(f.s) - Math.round(f.lead / DT)) {
        const x0 = f.fromLeft ? 20 : W - 20;
        g.dog = { active: true, s: f.s, x: x0, vx: (f.fromLeft ? 1 : -1) * DOG.speed, f };
      }
      if (g.dog && g.dog.f === f) {
        g.dog.x += g.dog.vx * DT;
        if (g.dog.x < -60 || g.dog.x > W + 60 || g.dog.s < g.dist - 500) { g.dog = null; f.done = true; }
      }
    } else if (f.type === 'tianguis' || f.type === 'baches') {
      if (g.dist > f.s + f.len + 400) f.done = true;
    } else if (f.type === 'boss') {
      bossStep(g, f);
    }
  }
  // baches: se cae un pasajero
  for (const b of g.baches) {
    if (b.hit) continue;
    if (Math.abs(laneX(b.lane) - g.x) < (g.P.w * 0.5 + BACHE.w * 0.3) && Math.abs(b.s - g.dist) < (g.P.l * 0.4 + BACHE.l * 0.3)) {
      b.hit = true;
      if (g.pax > 0) { g.pax--; g.events.push('bache:1'); } else g.events.push('bache:0');
    }
  }
}

// El Tráiler: ocupa 3 carriles. Se pone a tu lado, se adelanta, se cambia de lado y regresa.
function bossStep(g, f) {
  if (!g.boss) {
    if (g.dist < f.s) return;
    const freeRight = g.lane >= 2;           // deja libre el lado donde vas
    g.boss = { f, t: 0, phase: 'in', side: freeRight ? 0 : 1, off: 1500, x: 0, from: 0, to: 0, k: 0, laps: 0 };
    g.boss.x = trailerX(g.boss.side);
    g.events.push('boss');
  }
  const b = g.boss;
  if (b.f !== f) return;
  b.t += DT; b.k += DT;
  const hold = Math.max(1.3, 2.2 - b.laps * 0.15);
  if (b.phase === 'in') {
    b.off = 1500 + (150 - 1500) * ease(Math.min(1, b.k / 1.6));
    if (b.k >= 1.6) { b.phase = 'hold'; b.k = 0; }
  } else if (b.phase === 'hold') {
    b.off = 150;
    if (b.t >= CFG.bossTime) { b.phase = 'out'; b.k = 0; }
    else if (b.k >= hold) { b.phase = 'ahead'; b.k = 0; }
  } else if (b.phase === 'ahead') {
    b.off = 150 + 900 * ease(Math.min(1, b.k / 0.7));
    if (b.k >= 0.7) { b.phase = 'shift'; b.k = 0; b.from = b.x; b.side = 1 - b.side; b.to = trailerX(b.side); g.events.push('boss_shift'); }
  } else if (b.phase === 'shift') {
    b.x = b.from + (b.to - b.from) * ease(Math.min(1, b.k / 0.5));
    if (b.k >= 0.5) { b.phase = 'back'; b.k = 0; }
  } else if (b.phase === 'back') {
    b.off = 1050 - 900 * ease(Math.min(1, b.k / 1.1));
    if (b.k >= 1.1) { b.phase = 'hold'; b.k = 0; b.laps++; }
  } else if (b.phase === 'out') {
    b.off = 150 + 2400 * ease(Math.min(1, b.k / 1.5));
    if (b.k >= 1.5) {
      b.phase = 'gone'; f.done = true; g.boss = null;
      g.bossCoins += CFG.bossCoins; g.bossWins++; g.events.push('boss_win');
    }
  }
}
function trailerX(side) { return side === 0 ? laneX(1) : laneX(2); }   // 0 = carriles 0-2 · 1 = carriles 1-3
function ease(k) { return k * k * (3 - 2 * k); }

// «¡Casi!»: pasar a menos de 14 px de otro vehículo sin tocarlo.
function nearMisses(g) {
  const pw = g.P.w * CFG.hit, pl = g.P.l * CFG.hit;
  for (const v of g.vehicles) {
    if (v.gone || v.nearDone) continue;
    const d = VEH[v.type], ow = d.w * CFG.hit, ol = d.l * CFG.hit;
    const ds = v.s - g.dist;
    if (ds < -(pl + ol) / 2 - 6) {
      v.nearDone = true;
      if (v.near && g.alive) {
        if (g.t - g.lastNear >= CFG.nearCooldown) {      // máximo uno cada 2 s
          g.combo = g.t - g.lastNear < CFG.comboWindow ? Math.min(5, g.combo + 1) : 1;
          g.lastNear = g.t;
          const pts = CFG.nearPts * g.combo * g.P.nearMul;
          g.nearPts += pts; g.nears++;
          g.events.push('near:' + g.combo + ':' + pts);
        }
      }
      continue;
    }
    if (Math.abs(ds) > (pl + ol) / 2 + 40) continue;
    const gx = Math.abs(v.x - g.x) - (pw + ow) / 2;
    const gy = Math.abs(ds) - (pl + ol) / 2;
    const gap = gx > 0 && gy > 0 ? Math.hypot(gx, gy) : Math.max(gx, gy);
    if (gap >= 0 && gap < CFG.nearGap) v.near = true;
  }
}

// ---------- resultados ----------
export function meters(g) { return Math.floor(g.dist / PX_PER_M); }
export function score(g) { return meters(g) + g.nearPts + g.delivered * CFG.paxPts; }
export function coins(g) {
  const base = Math.floor((g.delivered * CFG.paxCoins + Math.floor(meters(g) / 100) * CFG.coinsPer100m) * g.P.coinMul);
  return Math.min(CFG.coinCap, base) + g.bossCoins;
}

// Vuelve a jugar una partida completa. inputs = [[tick, dir], …].
export function replay(seed, inputs, maxTicks = 60 * 60 * 30, opts = {}) {
  const g = createGame(seed, opts);
  let i = 0;
  while (g.alive && g.tick < maxTicks) {
    let dir = 0;
    if (i < inputs.length && inputs[i][0] === g.tick) { dir = inputs[i][1]; i++; }
    else if (i < inputs.length && inputs[i][0] < g.tick) return { ok: false, why: 'toques fuera de orden' };
    step(g, dir);
  }
  return { ok: true, alive: g.alive, ticks: g.tick, meters: meters(g), score: score(g), coins: coins(g), used: i };
}

// ---------- piloto automático (pruebas y video; no cambia las reglas) ----------
export function autoDir(g) {
  const look = relSpeed(g) * 0.6 + 360;
  const pw = g.P.w * CFG.hit, pl = g.P.l * CFG.hit;
  const clear = [], side = [];
  for (let l = 0; l < LANES; l++) { clear.push(1e9); side.push(false); }
  for (const o of obstacles(g)) {
    const ds = o.s - g.dist;
    const half = (pl + o.l) / 2;
    for (let l = 0; l < LANES; l++) {
      if (Math.abs(o.x - laneX(l)) >= (pw + o.w) / 2) continue;
      if (ds > -half - 40 && ds < half + 70) side[l] = true;
      if (ds > -half && Math.max(0, ds - half) < clear[l]) clear[l] = Math.max(0, ds - half);
    }
  }
  // el perro cruza: ver en qué carril va a estar cuando lleguemos
  if (g.dog && g.dog.active) {
    const ds = g.dog.s - g.dist;
    if (ds > -60) {
      const ta = Math.max(0, ds / g.speed);
      for (const dt of [0, ta * 0.5, ta, ta + 0.15]) {
        const px = g.dog.x + g.dog.vx * dt;
        for (let l = 0; l < LANES; l++) if (Math.abs(px - laneX(l)) < (pw + DOG.w) / 2 + 10) clear[l] = Math.min(clear[l], Math.max(0, ds - 60));
      }
    }
  }
  // el Tráiler se adelanta y regresa: ir al carril que va a dejar libre
  if (g.boss && (g.boss.phase === 'shift' || g.boss.phase === 'back' || g.boss.phase === 'ahead')) {
    const freeLane = g.boss.phase === 'ahead' ? (g.boss.side === 0 ? 0 : RIGHT) : (g.boss.side === 0 ? RIGHT : 0);
    for (let l = 0; l < LANES; l++) if (l !== freeLane) clear[l] = Math.min(clear[l], 300);
  }
  const want = wantRight(g);
  if (Math.abs(g.x - laneX(g.lane)) > 1) return 0;
  let best = g.lane, bestC = clear[g.lane] + (want && g.lane === RIGHT ? 600 : 0);
  if (clear[g.lane] > look && !(want && g.lane !== RIGHT)) return 0;
  for (let l = 0; l < LANES; l++) {
    let ok = true;
    const st = l > g.lane ? 1 : -1;
    for (let m = g.lane + st; m !== l + st; m += st) if (side[m]) { ok = false; break; }
    const c = clear[l] + (want && l === RIGHT ? 600 : 0);
    if (ok && c > bestC + 1 && clear[l] > Math.min(look, clear[g.lane] + 1)) { best = l; bestC = c; }
  }
  if (best === g.lane) return 0;
  return best > g.lane ? 1 : -1;
}
function wantRight(g) {
  for (const f of g.feats) {
    if (f.done) continue;
    if (f.s - g.dist > 1400) break;
    if (f.type === 'stop' && g.pax < g.P.cap && f.s - g.dist > -f.len) return true;
    if (f.type === 'terminal' && g.pax > 0 && f.s - g.dist > -f.len) return true;
  }
  return false;
}

// Para dibujar: lo que hay en la calle cerca.
export function visibleFeatures(g, from, to) {
  return g.feats.filter((f) => f.s + (f.len || 0) > from && f.s < to);
}
export { TRAILER, DOG, BACHE };
