import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, replay, autoDir, meters, score, coins, CFG, VEH_ORDER, vehicleStats, obstacles, LANES, laneX, ROUTE_ORDER } from '../src/core.js';

function playAuto(seed, maxTicks = 60 * 240, opts = {}) {
  const g = createGame(seed, opts);
  const seen = {};
  while (g.alive && g.tick < maxTicks) {
    step(g, autoDir(g));
    for (const e of g.events) { const k = e.split(':')[0]; seen[k] = (seen[k] || 0) + 1; }
  }
  g.seen = seen;
  return g;
}

test('misma semilla + mismos toques = mismo puntaje (todos los vehículos)', () => {
  for (const veh of VEH_ORDER) for (const seed of [1, 7, 12345]) {
    const opts = { veh, upg: { cupo: 1, agil: 2, iman: 3 } };
    const g = playAuto(seed, 60 * 140, opts);
    const a = replay(seed, g.inputs, g.tick, opts);
    const b = replay(seed, g.inputs, g.tick, opts);
    assert.equal(a.ok, true);
    assert.equal(a.meters, meters(g), `${veh} ${seed}: metros`);
    assert.equal(a.score, score(g), `${veh} ${seed}: puntos`);
    assert.equal(a.coins, coins(g), `${veh} ${seed}: monedas`);
    assert.deepEqual(a, b);
  }
});

test('sin tocar nada, la partida siempre acaba igual y no choca enseguida', () => {
  const a = replay(42, []), b = replay(42, []);
  assert.deepEqual(a, b);
  assert.equal(a.alive, false);
  assert.ok(a.meters > 20);
});

test('semillas distintas dan partidas distintas', () => {
  const set = new Set();
  for (let s = 1; s <= 10; s++) set.add(replay(s, []).meters);
  assert.ok(set.size > 3);
});

test('a la altura de la combi siempre queda un carril libre (con eventos y Tráiler)', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = createGame(seed, { god: true });
    while (g.tick < 60 * 200) {
      step(g, autoDir(g));
      if (g.tick % 3) continue;
      const blocked = new Set();
      for (const o of obstacles(g)) {
        if (Math.abs(o.s - g.dist) > o.l / 2 + 60) continue;
        for (let l = 0; l < LANES; l++) if (Math.abs(o.x - laneX(l)) < o.w / 2 + 20) blocked.add(l);
      }
      assert.ok(blocked.size < LANES, `muro en semilla ${seed} t=${g.t.toFixed(1)}`);
    }
  }
});

test('el piloto automático aguanta, sube pasaje, cobra y pasa eventos y Tráiler', () => {
  let total = 0, min = 1e9; const all = {};
  const N = 30;
  for (let seed = 1; seed <= N; seed++) {
    const g = playAuto(seed, 60 * 220);
    total += g.t; min = Math.min(min, g.t);
    for (const k in g.seen) all[k] = (all[k] || 0) + g.seen[k];
    if (!g.alive && seed <= 5) console.log(`  semilla ${seed}: chocó con ${g.crashKind} a los ${g.t.toFixed(0)} s (${meters(g)} m)`);
  }
  console.log(`auto: promedio ${(total / N).toFixed(0)} s, mínimo ${min.toFixed(0)} s`, JSON.stringify(all));
  assert.ok(total / N > 110, 'promedio mayor a 110 s');
  for (const k of ['board', 'deliver', 'rain', 'boss', 'boss_win', 'warn']) assert.ok(all[k] > 0, 'pasó: ' + k);
});

test('velocidad: 420 al empezar y tope de 1400', () => {
  const g = createGame(3, { god: true });
  step(g, 0);
  assert.ok(Math.abs(g.speed - 420) < 1);
  while (g.tick < 60 * 200) step(g, 0);
  assert.equal(g.speed, CFG.speedMax);
});

test('vehículos y mejoras', () => {
  assert.equal(vehicleStats('combi').cap, 8);
  assert.equal(vehicleStats('guajolotero').shield, 1);
  assert.ok(vehicleStats('combi', { cupo: 3 }).cap > 8);
  assert.ok(vehicleStats('vocho').lane > vehicleStats('combi').lane);
  assert.equal(vehicleStats('nada').id, 'combi');
});

test('el guajolotero aguanta un choque', () => {
  const g = createGame(5, { veh: 'guajolotero' });
  let shield = 0;
  while (g.alive && g.tick < 60 * 60) { step(g, 0); if (g.events.includes('shield')) shield++; }
  assert.equal(shield, 1);
  assert.equal(g.alive, false);
});

test('tope de 300 monedas (sin contar el Tráiler)', () => {
  const g = createGame(9);
  g.delivered = 500; g.dist = 0;
  assert.equal(coins(g), 300);
  g.bossCoins = 200;
  assert.equal(coins(g), 500);
});

test('rutas: mismo replay, nunca muro, el piloto aguanta y salen sus eventos', () => {
  for (const ruta of ROUTE_ORDER) {
    let total = 0; const all = {};
    for (let seed = 1; seed <= 12; seed++) {
      const g = playAuto(seed, 60 * 200, { ruta });
      total += g.t;
      for (const k in g.seen) all[k] = (all[k] || 0) + g.seen[k];
      if (seed <= 3) {
        const a = replay(seed, g.inputs, g.tick, { ruta });
        assert.equal(a.score, score(g), `ruta ${ruta} semilla ${seed}`);
      }
      if (!g.alive && seed <= 4) console.log(`  ruta ${ruta} semilla ${seed}: chocó con ${g.crashKind} a ${meters(g)} m`);
    }
    console.log(`ruta ${ruta}: promedio ${(total / 12).toFixed(0)} s`, JSON.stringify(all));
    assert.ok(total / 12 > 90, `ruta ${ruta}: promedio mayor a 90 s`);
    // muro
    for (let seed = 1; seed <= 6; seed++) {
      const g = createGame(seed, { god: true, ruta });
      while (g.tick < 60 * 160) {
        step(g, autoDir(g));
        if (g.tick % 3) continue;
        const blocked = new Set();
        for (const o of obstacles(g)) {
          if (Math.abs(o.s - g.dist) > o.l / 2 + 60) continue;
          for (let l = 0; l < LANES; l++) if (Math.abs(o.x - laneX(l)) < o.w / 2 + 20) blocked.add(l);
        }
        assert.ok(blocked.size < LANES, `muro ruta ${ruta} semilla ${seed} t=${g.t.toFixed(1)}`);
      }
    }
  }
});
