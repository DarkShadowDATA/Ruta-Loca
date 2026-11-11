// Ruta Loca — fase 0 (prototipo). El juego solo dibuja lo que calcula src/core.js.
// Todo el dibujo de aquí es de código (relleno): en la fase 1 entra el arte final.
import Phaser from 'phaser';
import {
  W, H, DT, LANES, ROAD_X, LANE_W, PLAYER_Y, VEH, CFG,
  createGame, step, meters, autoDir, laneX,
} from './core.js';

const VERSION = '0.0.1';
let Q;
try { Q = new URLSearchParams(location.search); } catch { Q = new URLSearchParams(''); }
const P = {
  go: Q.has('go'), auto: Q.has('auto'), god: Q.has('god'), dev: Q.has('dev'),
  seed: Q.has('seed') ? (parseInt(Q.get('seed'), 10) >>> 0) : null,
  t: parseFloat(Q.get('t') || '0') || 0,
  speed: Math.max(1, parseFloat(Q.get('speed') || '1') || 1),
};

const SAVE_KEY = 'rl_save_v0';
function loadSave() {
  try { return Object.assign({ best: 0, runs: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
  catch { return { best: 0, runs: 0 }; }
}
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* sin guardado */ } }

const COLORS = {
  combi: 0xf4f1e6, sedan_rojo: 0xd8432e, sedan_azul: 0x2f76d2, taxi: 0xf2c230,
  camioneta: 0x4a9a52, camion: 0x9a9fa8, moto: 0x30343c,
};
const FONT = '"Arial Black", "Arial Bold", Impact, system-ui, sans-serif';

class Juego extends Phaser.Scene {
  constructor() { super('juego'); }

  create() {
    this.save = loadSave();
    this.gfx = this.add.graphics();
    this.fx = this.add.graphics().setDepth(5);
    const txt = (x, y, size, color = '#ffffff') => this.add.text(x, y, '', {
      fontFamily: FONT, fontSize: size + 'px', color, stroke: '#1b1410', strokeThickness: Math.round(size / 6),
      align: 'center',
    }).setOrigin(0.5).setDepth(10);
    this.tMeters = txt(W / 2, 92, 84);
    this.tBest = txt(W / 2, 162, 30, '#ffd84a');
    this.tTitle = txt(W / 2, 330, 108, '#ffd84a');
    this.tSub = txt(W / 2, 880, 44);
    this.tEnd = txt(W / 2, 420, 70, '#ff6b4a');
    this.tEnd2 = txt(W / 2, 560, 120);
    this.tEnd3 = txt(W / 2, 668, 38, '#ffd84a');
    this.tBtn = txt(W / 2, 880, 64, '#1b1410').setDepth(11);
    this.tBtn.setStroke('#ffffff', 0);
    this.tVer = this.add.text(W - 12, H - 10, 'prototipo ' + VERSION, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff',
    }).setOrigin(1, 1).setAlpha(0.45).setDepth(10);

    this.queue = [];
    this.acc = 0;
    this.sparks = [];
    this.mode = 'menu';
    this.modeT = 0;
    this.touched = false;
    this.newGame();

    // Controles: deslizar = un carril; tocar la mitad izq./der. = un carril; flechas o A/D.
    let sx = 0, st = 0, swiped = false, down = false;
    this.input.on('pointerdown', (p) => { down = true; sx = p.x; st = this.time.now; swiped = false; });
    this.input.on('pointermove', (p) => {
      if (!down || this.mode !== 'play') return;
      // distancia en px de pantalla (no del lienzo): 22 px para el primer carril;
      // si sigue deslizando sin levantar el dedo, otros 64 px para el siguiente.
      const dx = (p.x - sx) / this.scale.displayScale.x;
      if (Math.abs(dx) > (swiped ? 64 : 22)) { this.push(dx > 0 ? 1 : -1); sx = p.x; swiped = true; }
    });
    this.input.on('pointerup', (p) => {
      if (!down) return; down = false;
      if (this.mode === 'menu') { this.start(); return; }
      if (this.mode === 'dead') { if (this.modeT > 0.55) this.start(); return; }
      if (!swiped && this.time.now - st < 350) this.push(p.x < W / 2 ? -1 : 1);
    });
    this.input.keyboard?.on('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (this.mode !== 'play') {
        if (k === ' ' || k === 'enter' || k.startsWith('arrow') || k === 'a' || k === 'd') {
          if (this.mode === 'menu' || this.modeT > 0.55) this.start();
        }
        return;
      }
      if (k === 'arrowleft' || k === 'a') this.push(-1);
      if (k === 'arrowright' || k === 'd') this.push(1);
    });

    if (P.go) this.start();
    if (P.dev) window.__rl = this;
  }

  newGame() {
    const seed = P.seed != null ? P.seed : ((Math.random() * 4294967296) >>> 0);
    this.g = createGame(seed, { god: P.god });
    this.queue.length = 0;
    this.acc = 0;
    this.sparks.length = 0;
    this.crash = null;
    this.tilt = 0;
  }

  start() {
    this.newGame();
    this.mode = 'play';
    this.modeT = 0;
    if (P.t > 0) {            // saltar al segundo t (para pruebas y video)
      const god = this.g.god; this.g.god = true;
      while (this.g.t < P.t) step(this.g, autoDir(this.g));
      this.g.god = god;
    }
  }

  push(dir) {
    this.touched = true;
    if (this.queue.length < 3) this.queue.push(dir);
  }

  update(_, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.modeT += dt;
    const g = this.g;

    if (this.mode === 'play') {
      this.acc += dt * P.speed;
      let n = 0;
      while (this.acc >= DT && n < 40 && g.alive) {
        this.acc -= DT; n++;
        let dir = 0;
        if (P.auto) dir = autoDir(g);
        else if (this.queue.length) dir = this.queue.shift();
        step(g, dir);
        if (g.events.includes('crash')) this.onCrash();
      }
    } else if (this.mode === 'menu') {
      // la calle se mueve sola detrás del título
      this.menuDist = (this.menuDist || 0) + 300 * dt;
    }

    // inclinación de la combi al cambiar de carril
    const want = Phaser.Math.Clamp((laneX(g.lane) - g.x) / LANE_W, -1, 1) * 0.22;
    this.tilt += (want - this.tilt) * Math.min(1, dt * 22);

    this.draw(dt);
  }

  onCrash() {
    const g = this.g;
    this.mode = 'dead';
    this.modeT = 0;
    const v = g.vehicles.find((o) => o.id === g.crashWith);
    const side = v ? Math.sign(g.x - v.x) || 1 : 1;
    this.crash = { x: g.x, y: PLAYER_Y, vx: side * 260, vy: -g.speed * 0.35, rot: 0, vr: side * 13, other: v ? v.id : 0, ox: 0, oy: 0, orot: 0 };
    const cx = v ? (g.x + v.x) / 2 : g.x;
    const cy = v ? (PLAYER_Y + (PLAYER_Y - (v.s - g.dist))) / 2 : PLAYER_Y - 60;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, sp = 250 + Math.random() * 900;
      this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, life: 0.35 + Math.random() * 0.55, c: Math.random() < 0.5 ? 0xffe066 : 0xff8a3c });
    }
    this.cameras.main.shake(420, 0.028);
    this.cameras.main.flash(120, 255, 255, 255);
    try { navigator.vibrate?.(120); } catch { /* sin vibración */ }
    const m = meters(g);
    this.isRecord = m > this.save.best;
    this.save.runs++;
    if (this.isRecord) this.save.best = m;
    writeSave(this.save);
  }

  // ---------- dibujo ----------
  draw(dt) {
    const g = this.g, gf = this.gfx;
    const dist = this.mode === 'menu' ? (this.menuDist || 0) : g.dist;
    gf.clear();

    // banquetas
    gf.fillStyle(0x8f8a80); gf.fillRect(0, 0, W, H);
    gf.fillStyle(0x7d786f);
    const slab = 160, off = dist % slab;
    for (let y = -slab + off; y < H; y += slab) { gf.fillRect(0, y, ROAD_X, 4); gf.fillRect(W - ROAD_X, y, ROAD_X, 4); }
    // árboles en la banqueta (para sentir la velocidad)
    const treeGap = 520, toff = dist % treeGap;
    for (let y = -treeGap + toff; y < H + 80; y += treeGap) {
      this.tree(gf, 28, y); this.tree(gf, W - 28, y + treeGap / 2);
      this.tree(gf, W - 28, y + treeGap / 2 - treeGap);
    }
    // asfalto
    gf.fillStyle(0x3a3d44); gf.fillRect(ROAD_X, 0, LANE_W * LANES, H);
    gf.fillStyle(0xf2c230); gf.fillRect(ROAD_X, 0, 8, H); gf.fillRect(ROAD_X + LANE_W * LANES - 8, 0, 8, H);
    // rayas de carril
    gf.fillStyle(0xe9e6dc);
    const dash = 150, doff = dist % dash;
    for (let i = 1; i < LANES; i++) {
      const x = ROAD_X + LANE_W * i - 5;
      for (let y = -dash + doff; y < H; y += dash) gf.fillRect(x, y, 10, 70);
    }

    // tráfico
    if (this.mode !== 'menu') {
      for (const v of g.vehicles) {
        let y = PLAYER_Y - (v.s - g.dist), x = v.x, rot = 0;
        if (this.crash && v.id === this.crash.other) {
          const c = this.crash;
          c.ox += -Math.sign(c.vx) * 120 * dt * Math.max(0, 1 - this.modeT); c.orot += -Math.sign(c.vx) * 2.2 * dt * Math.max(0, 1 - this.modeT);
          x += c.ox; rot = c.orot;
        }
        if (y < -200 || y > H + 200) continue;
        this.vehicle(gf, v.type, x, y, rot);
      }
    }

    // la combi
    if (this.crash) {
      const c = this.crash, k = Math.max(0, 1 - this.modeT / 1.1);
      c.x += c.vx * dt * k; c.y += c.vy * dt * k; c.rot += c.vr * dt * k;
      c.x = Phaser.Math.Clamp(c.x, 40, W - 40);
      this.vehicle(gf, 'combi', c.x, c.y, c.rot);
    } else {
      this.vehicle(gf, 'combi', this.mode === 'menu' ? W / 2 : g.x, PLAYER_Y, this.tilt);
    }

    // chispas
    const fx = this.fx; fx.clear();
    for (const s of this.sparks) {
      s.life -= dt; if (s.life <= 0) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 1500 * dt;
      fx.fillStyle(s.c, Math.min(1, s.life * 3));
      fx.fillRect(s.x - 5, s.y - 5, 10, 10);
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);

    // mano que desliza (sin texto) hasta el primer toque
    if (this.mode === 'play' && !this.touched && !P.auto && g.t < 7) this.hand(fx, g.t);

    this.hud(fx);
  }

  tree(gf, x, y) {
    gf.fillStyle(0x2f6b3a); gf.fillCircle(x, y, 30);
    gf.fillStyle(0x3f8a4b); gf.fillCircle(x - 6, y - 7, 19);
  }

  vehicle(gf, type, x, y, rot) {
    const d = VEH[type], w = d.w, l = d.l, c = COLORS[type];
    gf.save(); gf.translateCanvas(x, y); gf.rotateCanvas(rot);
    // sombra
    gf.fillStyle(0x000000, 0.25); gf.fillRoundedRect(-w / 2 + 6, -l / 2 + 8, w, l, 16);
    if (type === 'moto') {
      gf.fillStyle(0x15171b); gf.fillRoundedRect(-9, -l / 2, 18, 30, 6); gf.fillRoundedRect(-9, l / 2 - 30, 18, 30, 6);
      gf.fillStyle(c); gf.fillRoundedRect(-13, -l / 2 + 20, 26, l - 40, 10);
      gf.fillStyle(0xd8432e); gf.fillRoundedRect(-w / 2, 6, w, 40, 8);        // caja de reparto
      gf.fillStyle(0xf0c9a0); gf.fillCircle(0, -10, 13);                        // casco
      gf.restore(); return;
    }
    // llantas
    gf.fillStyle(0x15171b);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) gf.fillRoundedRect(sx * (w / 2 - 4) - 7, sy * (l / 2 - 38) - 17, 14, 34, 5);
    // carrocería con contorno
    gf.fillStyle(0x2a1c12); gf.fillRoundedRect(-w / 2, -l / 2, w, l, 18);
    gf.fillStyle(c); gf.fillRoundedRect(-w / 2 + 5, -l / 2 + 5, w - 10, l - 10, 14);
    const glass = 0x9fd8ef;
    if (type === 'combi') {
      gf.fillStyle(0xf2a51f); gf.fillRect(-w / 2 + 5, -l / 2 + 46, w - 10, 16);          // franja
      gf.fillStyle(0x2f9e8f); gf.fillRect(-w / 2 + 5, -l / 2 + 62, w - 10, 8);
      gf.fillStyle(glass); gf.fillRoundedRect(-w / 2 + 12, -l / 2 + 12, w - 24, 28, 8);   // parabrisas
      gf.fillStyle(0xe2ded0); gf.fillRoundedRect(-w / 2 + 14, -l / 2 + 80, w - 28, l - 110, 8); // techo
      gf.fillStyle(0xffffff); gf.fillCircle(-w / 2 + 16, -l / 2 + 7, 6); gf.fillCircle(w / 2 - 16, -l / 2 + 7, 6);
      gf.fillStyle(0xd8432e); gf.fillRect(-w / 2 + 10, l / 2 - 11, 16, 6); gf.fillRect(w / 2 - 26, l / 2 - 11, 16, 6);
    } else if (type === 'camion') {
      gf.fillStyle(0xd8432e); gf.fillRoundedRect(-w / 2 + 5, -l / 2 + 5, w - 10, 62, 12);  // cabina
      gf.fillStyle(glass); gf.fillRoundedRect(-w / 2 + 14, -l / 2 + 14, w - 28, 22, 6);
      gf.fillStyle(0xc3c7cf); gf.fillRect(-w / 2 + 10, -l / 2 + 76, w - 20, l - 90);       // caja
      gf.lineStyle(3, 0x8a8f99); for (let yy = -l / 2 + 100; yy < l / 2 - 20; yy += 34) gf.lineBetween(-w / 2 + 12, yy, w / 2 - 12, yy);
    } else {
      gf.fillStyle(glass); gf.fillRoundedRect(-w / 2 + 13, -l / 2 + 40, w - 26, 26, 7);    // parabrisas
      gf.fillStyle(glass, 0.85); gf.fillRoundedRect(-w / 2 + 15, l / 2 - 52, w - 30, 18, 6);
      gf.fillStyle(0xffffff, 0.22); gf.fillRoundedRect(-w / 2 + 14, -l / 2 + 70, w - 28, l - 128, 8); // techo
      if (type === 'taxi') { gf.fillStyle(0x1b1410); gf.fillRect(-14, -8, 28, 16); gf.fillStyle(0xffffff); gf.fillRect(-10, -4, 20, 8); }
      if (type === 'camioneta') { gf.fillStyle(0x2a1c12, 0.35); gf.fillRoundedRect(-w / 2 + 12, 10, w - 24, l / 2 - 24, 6); }
      gf.fillStyle(0xd8432e); gf.fillRect(-w / 2 + 10, l / 2 - 11, 16, 6); gf.fillRect(w / 2 - 26, l / 2 - 11, 16, 6);
    }
    gf.restore();
  }

  hand(fx, t) {
    const ph = (t % 1.6) / 1.6;
    const k = ph < 0.5 ? ph * 2 : 1 - (ph - 0.5) * 2;        // va y regresa
    const e = k * k * (3 - 2 * k);
    const x = W / 2 - 130 + 260 * e, y = 1180;
    fx.fillStyle(0xffffff, 0.22); fx.fillRoundedRect(W / 2 - 150, y - 14, 300, 28, 14);
    fx.fillStyle(0xffffff, 0.35); fx.fillTriangle(W / 2 - 176, y, W / 2 - 150, y - 20, W / 2 - 150, y + 20);
    fx.fillTriangle(W / 2 + 176, y, W / 2 + 150, y - 20, W / 2 + 150, y + 20);
    // dedo
    fx.fillStyle(0x1b1410, 0.9); fx.fillCircle(x, y, 40); fx.fillRoundedRect(x - 26, y, 52, 86, 22);
    fx.fillStyle(0xffe0bd); fx.fillCircle(x, y, 34); fx.fillRoundedRect(x - 21, y, 42, 80, 18);
    fx.fillStyle(0xffffff, 0.55); fx.fillCircle(x - 8, y - 10, 10);
  }

  hud(fx) {
    const g = this.g, play = this.mode === 'play', menu = this.mode === 'menu', dead = this.mode === 'dead';
    this.tMeters.setVisible(play).setText(meters(g) + ' m');
    this.tBest.setVisible(play && this.save.best > 0).setText('RÉCORD ' + this.save.best + ' m');
    this.tTitle.setVisible(menu).setText('RUTA\nLOCA').setLineSpacing(-18);
    this.tSub.setVisible(menu).setText('TOCA PARA JUGAR').setAlpha(0.6 + 0.4 * Math.sin(this.modeT * 5));
    const show = dead && this.modeT > 0.55;
    this.tEnd.setVisible(show).setText('¡CHOCASTE!');
    this.tEnd2.setVisible(show).setText(meters(g) + ' m');
    this.tEnd3.setVisible(show).setText(this.isRecord ? '¡NUEVO RÉCORD!' : 'RÉCORD ' + this.save.best + ' m');
    this.tBtn.setVisible(show).setText('OTRA VEZ');
    if (menu && this.save.best > 0) { this.tBest.setVisible(true).setText('RÉCORD ' + this.save.best + ' m').setY(600); } else this.tBest.setY(162);
    if (show) {
      fx.fillStyle(0x000000, 0.5); fx.fillRect(0, 0, W, H);
      const s = 1 + 0.03 * Math.sin(this.modeT * 6);
      const bw = 460 * s, bh = 130 * s;
      fx.fillStyle(0x1b1410); fx.fillRoundedRect(W / 2 - bw / 2 - 6, 880 - bh / 2 - 2, bw + 12, bh + 16, 34);
      fx.fillStyle(0xffd84a); fx.fillRoundedRect(W / 2 - bw / 2, 880 - bh / 2, bw, bh, 30);
    }
    if (menu) { fx.fillStyle(0x000000, 0.35); fx.fillRect(0, 0, W, H); }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W, height: H,
  backgroundColor: '#15171b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  fps: { smoothStep: true },
  scene: [Juego],
});
