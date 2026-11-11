import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, replay, autoDir, meters, LANES, VEH, CFG } from '../src/core.js';

function playAuto(seed, maxTicks = 60 * 240, god = false) {
  const g = createGame(seed, { god });
  while (g.alive && g.tick < maxTicks) step(g, autoDir(g));
  return g;
}

test('misma semilla + mismos toques = mismo puntaje', () => {
  for (const seed of [1, 7, 12345, 987654321]) {
    const g = playAuto(seed, 60 * 60);
    const a = replay(seed, g.inputs, g.tick);
    const b = replay(seed, g.inputs, g.tick);
    assert.equal(a.ok, true);
    assert.equal(a.meters, meters(g), 'el replay da los mismos metros que la partida');
    assert.equal(a.ticks, g.tick);
    assert.deepEqual(a, b);
  }
});

test('sin tocar nada, la partida siempre acaba igual', () => {
  const a = replay(42, []), b = replay(42, []);
  assert.deepEqual(a, b);
  assert.equal(a.alive, false);
  assert.ok(a.meters > 20, 'el primer tramo no trae tráfico en tu carril');
});

test('semillas distintas dan partidas distintas', () => {
  const set = new Set();
  for (let s = 1; s <= 10; s++) set.add(replay(s, []).meters);
  assert.ok(set.size > 3);
});

test('nunca hay un muro: cada fila deja un carril libre', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = createGame(seed, { god: true });
    const rows = new Map();
    const seen = new Set();
    while (g.tick < 60 * 150) {
      step(g, 0);
      for (const v of g.vehicles) if (!seen.has(v.id)) { seen.add(v.id); }
    }
    // revisar por bandas: en ningún momento los 4 carriles están tapados a la misma altura
    const g2 = createGame(seed, { god: true });
    while (g2.tick < 60 * 150) {
      step(g2, 0);
      if (g2.tick % 6) continue;
      for (const v of g2.vehicles) {
        const lanes = new Set([v.lane]);
        for (const o of g2.vehicles) {
          if (o !== v && Math.abs(o.s - v.s) < (VEH[o.type].l + VEH[v.type].l) / 2 + VEH.combi.l) lanes.add(o.lane);
        }
        assert.ok(lanes.size < LANES, `muro en semilla ${seed} t=${g2.t.toFixed(1)}`);
      }
    }
  }
});

test('el piloto automático aguanta (el camino libre sí se puede manejar)', () => {
  let total = 0, min = 1e9;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const g = playAuto(seed, 60 * 200);
    total += g.t; min = Math.min(min, g.t);
  }
  console.log(`auto: promedio ${(total / N).toFixed(0)} s, mínimo ${min.toFixed(0)} s`);
  assert.ok(total / N > 120, 'promedio mayor a 2 minutos');
});

test('velocidad: 420 al empezar y tope de 1400', () => {
  const g = createGame(3, { god: true });
  step(g, 0);
  assert.ok(Math.abs(g.speed - 420) < 1);
  while (g.tick < 60 * 200) step(g, 0);
  assert.equal(g.speed, CFG.speedMax);
});
