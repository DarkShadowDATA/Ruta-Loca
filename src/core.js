// Ruta Loca — núcleo del juego (sin Phaser, sin DOM, sin reloj).
// Paso fijo de 1/60 s y azar con semilla: la misma semilla y la misma lista
// de toques dan SIEMPRE la misma partida. El servidor usará una copia de este
// archivo para volver a jugar una partida (Pozo, fase 6). No usar Math.random,
// Date ni nada que cambie entre máquinas.

export const W = 720;
export const H = 1280;
export const DT = 1 / 60;
export const LANES = 4;
export const ROAD_X = 60;            // orilla izquierda del asfalto
export const LANE_W = 150;           // 4 carriles = 600 px
export const PLAYER_Y = 1010;        // dónde se dibuja la combi en pantalla
export const PX_PER_M = 40;

export const CFG = {
  speed0: 420,          // px/s al empezar
  accel: 6,             // px/s que sube cada segundo
  speedMax: 1400,
  trafficSpeed: 140,    // el tráfico avanza parejo (así las filas nunca se juntan en un muro)
  laneSpeed: 1500,      // px/s de lado al cambiar de carril (0.1 s por carril)
  hit: 0.8,             // caja de golpe = 80 % del dibujo
  spawnAhead: 1500,     // qué tan adelante nace una fila (fuera de pantalla)
  firstRow: 620,        // la primera fila ya se ve al empezar
  jitter: 70,           // cada vehículo se corre hasta ±70 px dentro de su fila
  reactStart: 0.46,     // tiempo libre entre filas al empezar (s)
  reactEnd: 0.25,       // …y a partir de reactTime segundos
  reactTime: 70,
  startLane: 1,
};

// Tamaño del dibujo de cada vehículo (ancho, largo) en px.
export const VEH = {
  combi:      { w: 92,  l: 180 },
  sedan_rojo: { w: 88,  l: 168 },
  sedan_azul: { w: 88,  l: 168 },
  taxi:       { w: 88,  l: 168 },
  camioneta:  { w: 98,  l: 200 },
  camion:     { w: 108, l: 260 },
  moto:       { w: 46,  l: 112 },
};
const MAX_LEN = 260;
const TRAFFIC = [
  ['sedan_rojo', 22], ['sedan_azul', 22], ['taxi', 18],
  ['camioneta', 16], ['camion', 12], ['moto', 10],
];
const TRAFFIC_TOTAL = TRAFFIC.reduce((a, t) => a + t[1], 0);

export function laneX(lane) { return ROAD_X + LANE_W * (lane + 0.5); }

// mulberry32: azar con semilla, igual en cualquier máquina.
function rnd(g) {
  g.rs = (g.rs + 0x6D2B79F5) | 0;
  let t = g.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rint(g, n) { return Math.floor(rnd(g) * n); }

export function createGame(seed, opts = {}) {
  const g = {
    seed: seed >>> 0,
    rs: seed >>> 0,
    god: !!opts.god,
    tick: 0,
    t: 0,
    dist: 0,
    speed: CFG.speed0,
    lane: CFG.startLane,          // carril al que va
    x: laneX(CFG.startLane),      // posición real (se desliza hacia el carril)
    alive: true,
    vehicles: [],                 // { id, type, lane, x, s }  s = posición a lo largo de la calle
    nextId: 1,
    rows: 0,
    safe: CFG.startLane,          // carril que la última fila dejó libre
    lastRowS: 0,
    inputs: [],                   // [tick, dir] — lo que se manda al servidor
    plan: null,
    events: [],                   // lo que pasó en este paso (para dibujar): 'lane', 'crash'
    crashWith: null,
  };
  // Primera fila a la vista; luego se llena hasta arriba de la pantalla.
  spawnRow(g, CFG.firstRow);
  fillRows(g);
  return g;
}

function relSpeed(g) { return g.speed + 30 - CFG.trafficSpeed; }

function planRow(g) {
  // Decide (una sola vez) cuál carril deja libre la siguiente fila y a qué
  // distancia nace, con el espacio justo para poder llegar a ese carril.
  const first = g.rows < 2;
  const maxShift = first ? 0 : (g.t < 18 ? 1 : (g.t < 50 ? 2 : 3));
  const shift0 = maxShift === 0 ? 0 : rint(g, maxShift * 2 + 1) - maxShift;
  let safe = g.safe + shift0;
  if (safe < 0) safe = -safe;
  if (safe > LANES - 1) safe = 2 * (LANES - 1) - safe;
  const shift = Math.abs(safe - g.safe);
  const k = Math.min(1, g.t / CFG.reactTime);
  const react = CFG.reactStart + (CFG.reactEnd - CFG.reactStart) * k;
  const laneTime = LANE_W / CFG.laneSpeed;
  const gap = 2 * CFG.jitter + MAX_LEN + VEH.combi.l
    + relSpeed(g) * (laneTime * shift + react) + rint(g, 110);
  g.plan = { safe, gap };
}

function fillRows(g) {
  for (let guard = 0; guard < 20; guard++) {
    if (!g.plan) planRow(g);
    const s = g.lastRowS + g.plan.gap;
    if (s - g.dist > CFG.spawnAhead) return;
    g.safe = g.plan.safe;
    g.plan = null;
    spawnRow(g, s);
  }
}

function spawnRow(g, s) {
  const t = g.t;
  let n = 1;
  if (g.rows >= 2) {
    const p3 = Math.max(0, Math.min(0.45, (t - 20) / 80));
    const p2 = Math.max(0.3, Math.min(0.85, 0.3 + t / 55));
    if (rnd(g) < p3) n = 3; else if (rnd(g) < p2) n = 2;
  }
  const lanes = [];
  for (let i = 0; i < LANES; i++) if (i !== g.safe) lanes.push(i);
  // quitar carriles al azar hasta que queden n
  while (lanes.length > n) lanes.splice(rint(g, lanes.length), 1);
  for (const lane of lanes) {
    let r = rint(g, TRAFFIC_TOTAL), type = TRAFFIC[0][0];
    for (const [name, wgt] of TRAFFIC) { if (r < wgt) { type = name; break; } r -= wgt; }
    const jit = rint(g, CFG.jitter * 2 + 1) - CFG.jitter;
    g.vehicles.push({ id: g.nextId++, type, lane, x: laneX(lane), s: s + jit });
  }
  g.lastRowS = s;
  g.rows++;
}

// Un paso de 1/60 s. dir: -1 (izquierda), 0 (nada), 1 (derecha).
export function step(g, dir) {
  g.events.length = 0;
  if (!g.alive) return g;

  if (dir === -1 || dir === 1) {
    const nl = g.lane + dir;
    if (nl >= 0 && nl < LANES) {
      g.lane = nl;
      g.inputs.push([g.tick, dir]);
      g.events.push('lane');
    }
  }

  g.tick++;
  g.t = g.tick * DT;
  g.speed = Math.min(CFG.speedMax, CFG.speed0 + CFG.accel * g.t);
  g.dist += g.speed * DT;

  // deslizarse hacia el carril
  const tx = laneX(g.lane);
  const dx = CFG.laneSpeed * DT;
  if (g.x < tx) g.x = Math.min(tx, g.x + dx);
  else if (g.x > tx) g.x = Math.max(tx, g.x - dx);

  // tráfico
  const adv = CFG.trafficSpeed * DT;
  g.lastRowS += adv;
  const vs = g.vehicles;
  for (let i = 0; i < vs.length; i++) vs[i].s += adv;
  let w = 0;
  for (let i = 0; i < vs.length; i++) if (vs[i].s >= g.dist - 420) vs[w++] = vs[i];
  vs.length = w;

  fillRows(g);

  // choque
  if (!g.god) {
    const p = VEH.combi;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], d = VEH[v.type];
      if (Math.abs(v.x - g.x) < (p.w + d.w) * 0.5 * CFG.hit &&
          Math.abs(v.s - g.dist) < (p.l + d.l) * 0.5 * CFG.hit) {
        g.alive = false;
        g.crashWith = v.id;
        g.events.push('crash');
        break;
      }
    }
  }
  return g;
}

export function meters(g) { return Math.floor(g.dist / PX_PER_M); }
export function score(g) { return meters(g); }   // fase 0: puntos = metros

// Vuelve a jugar una partida completa. inputs = [[tick, dir], …].
// maxTicks corta la partida (por si la lista viene incompleta o es tramposa).
export function replay(seed, inputs, maxTicks = 60 * 60 * 30) {
  const g = createGame(seed);
  let i = 0;
  while (g.alive && g.tick < maxTicks) {
    let dir = 0;
    if (i < inputs.length && inputs[i][0] === g.tick) { dir = inputs[i][1]; i++; }
    else if (i < inputs.length && inputs[i][0] < g.tick) return { ok: false, why: 'toques fuera de orden' };
    step(g, dir);
  }
  return { ok: true, alive: g.alive, ticks: g.tick, meters: meters(g), score: score(g), used: i };
}

// Piloto automático (para pruebas y para grabar video). No cambia las reglas:
// solo decide un toque, que queda grabado igual que el de un jugador.
export function autoDir(g) {
  const look = relSpeed(g) * 0.55 + 330;
  const p = VEH.combi;
  const clear = [];   // distancia libre hacia adelante por carril
  const side = [];    // ¿hay alguien a un lado ahora mismo?
  for (let l = 0; l < LANES; l++) { clear.push(1e9); side.push(false); }
  for (const v of g.vehicles) {
    const d = VEH[v.type];
    const ds = v.s - g.dist;
    const half = (p.l + d.l) * 0.5;
    if (ds > -half - 30 && ds < half + 60) side[v.lane] = true;
    if (ds > -half && ds < clear[v.lane]) clear[v.lane] = Math.max(0, ds - half);
  }
  if (Math.abs(g.x - laneX(g.lane)) > 1) return 0;      // termina el cambio primero
  if (clear[g.lane] > look) return 0;
  let best = g.lane, bestC = clear[g.lane];
  for (let l = 0; l < LANES; l++) {
    // solo sirve un carril al que se pueda llegar sin pegarle a nadie
    let ok = true;
    const stepDir = l > g.lane ? 1 : -1;
    for (let m = g.lane + stepDir; m !== l + stepDir; m += stepDir) if (side[m]) { ok = false; break; }
    if (ok && clear[l] > bestC + 1) { best = l; bestC = clear[l]; }
  }
  if (best === g.lane) return 0;
  return best > g.lane ? 1 : -1;
}
