// Ruta Loca — el juego solo dibuja lo que calcula src/core.js.
// Todo el dibujo es de código (relleno) hasta que entre el arte de ChatGPT:
// cada vehículo es una textura con nombre (veh_<id>, trafico_<tipo>), así que
// cambiarla por la imagen final no toca nada más.
import Phaser from 'phaser';
import {
  W, H, DT, LANES, ROAD_X, LANE_W, PLAYER_Y, VEH, CFG, RIGHT, VEHICLES, VEH_ORDER, UPGRADES, TRAILER,
  createGame, step, meters, score, coins, autoDir, laneX, vehicleStats, visibleFeatures,
} from './core.js';
import { loadSave, writeSave, buyVehicle, buyUpgrade, upgradeCost } from './save.js';
import * as S from './sound.js';
import { dsTrack } from './dsev.js';

const VERSION = '0.4.0';
let Q;
try { Q = new URLSearchParams(location.search); } catch { Q = new URLSearchParams(''); }
const P = {
  go: Q.has('go'), auto: Q.has('auto'), god: Q.has('god'), dev: Q.has('dev'),
  seed: Q.has('seed') ? (parseInt(Q.get('seed'), 10) >>> 0) : null,
  t: parseFloat(Q.get('t') || '0') || 0,
  speed: Math.max(0.1, parseFloat(Q.get('speed') || '1') || 1),
  veh: Q.get('veh'), ruta: parseInt(Q.get('ruta') || '1', 10) || 1, menu: Q.get('menu'),
};

const TCOL = { sedan_rojo: 0xd8432e, sedan_azul: 0x2f76d2, taxi: 0xf2c230, camioneta: 0x4a9a52, camion: 0x9a9fa8, moto: 0x30343c };
const OUT = 0x2a1c12, GLASS = 0x9fd8ef;
const FONT = '"Arial Black", "Arial Bold", Impact, system-ui, sans-serif';
const $ = (id) => document.getElementById(id);

class Juego extends Phaser.Scene {
  constructor() { super('juego'); }

  create() {
    this.save = loadSave();
    if (P.veh && VEHICLES[P.veh]) { this.save.owned[P.veh] = true; this.save.sel = P.veh; }
    S.setSound(this.save.sound);
    this.makeTextures();

    this.gfx = this.add.graphics();                 // calle y cosas en el piso
    this.pool = [];                                  // sprites de vehículos
    this.top = this.add.graphics().setDepth(4);      // tráiler, perro, toldos
    this.fx = this.add.graphics().setDepth(6);       // chispas, lluvia, mano
    this.hudG = this.add.graphics().setDepth(9);
    this.player = this.add.image(W / 2, PLAYER_Y, 'veh_combi').setDepth(3);
    this.knock = this.add.image(0, 0, 'trafico_taxi').setDepth(3).setVisible(false);

    const txt = (x, y, size, color = '#ffffff', depth = 10) => this.add.text(x, y, '', {
      fontFamily: FONT, fontSize: size + 'px', color, stroke: '#1b1410', strokeThickness: Math.round(size / 6), align: 'center',
    }).setOrigin(0.5).setDepth(depth);
    this.tMeters = txt(W / 2, 78, 72);
    this.tScore = txt(W / 2, 136, 28, '#ffd84a');
    this.tPax = txt(96, 62, 34).setOrigin(0, 0.5);
    this.tCoins = txt(W - 24, 62, 34, '#ffd84a').setOrigin(1, 0.5);
    this.tShield = txt(W - 24, 112, 28, '#9fd8ef').setOrigin(1, 0.5);
    this.tWarn = txt(W / 2, 330, 54, '#ffd84a');
    this.tPop = txt(W / 2, 520, 64, '#ffffff');
    this.tBoss = txt(W / 2, 214, 34, '#ffffff');
    this.tFloat = [];

    this.queue = []; this.acc = 0; this.sparks = []; this.drops = [];
    this.mode = 'menu'; this.modeT = 0; this.touched = false; this.slow = 0; this.paused = false;
    this.warnT = 0; this.popT = 0; this.shake = 0; this.menuDist = 0;
    this.newGame();
    this.bindInput();
    this.bindUI();
    dsTrack('game_opened', 'ruta');

    if (P.go) this.start();
    else if (P.menu === 'garaje') this.showGarage();
    else this.showMenu();
    if (P.dev) window.__rl = this;
  }

  // ---------- texturas hechas con código ----------
  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    for (const id of VEH_ORDER) { const v = VEHICLES[id]; this.drawVeh(g, id, v.w, v.l); g.generateTexture('veh_' + id, v.w + 20, v.l + 20); g.clear(); }
    for (const t in VEH) { const v = VEH[t]; this.drawVeh(g, t, v.w, v.l); g.generateTexture('trafico_' + t, v.w + 20, v.l + 20); g.clear(); }
    g.destroy();
  }

  drawVeh(g, type, w, l) {
    const cx = w / 2 + 10, cy = l / 2 + 10;
    const R = (x, y, ww, hh, r, c, a = 1) => { g.fillStyle(c, a); g.fillRoundedRect(cx + x, cy + y, ww, hh, r); };
    if (type === 'moto') {
      R(-9, -l / 2, 18, 30, 6, 0x15171b); R(-9, l / 2 - 30, 18, 30, 6, 0x15171b);
      R(-14, -l / 2 + 18, 28, l - 36, 10, OUT); R(-11, -l / 2 + 21, 22, l - 42, 8, 0x30343c);
      R(-w / 2, 8, w, 42, 8, OUT); R(-w / 2 + 3, 11, w - 6, 36, 6, 0xd8432e);
      g.fillStyle(OUT); g.fillCircle(cx, cy - 10, 15); g.fillStyle(0xf2c230); g.fillCircle(cx, cy - 10, 12);
      g.fillStyle(0xffffff, 0.6); g.fillCircle(cx - 4, cy - 14, 4);
      return;
    }
    g.fillStyle(0x15171b);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.fillRoundedRect(cx + sx * (w / 2 - 4) - 7, cy + sy * (l / 2 - Math.min(38, l * 0.22)) - 17, 14, 34, 5);
    const body = { combi: 0xf4f1e6, vocho: 0x7cc6e8, micro: 0x3f9b5a, taxi: 0xff8fb8, guajolotero: 0x2f6fc0 }[type] ?? TCOL[type] ?? 0xcccccc;
    const rr = type === 'vocho' ? Math.min(w, l) * 0.42 : 18;
    R(-w / 2, -l / 2, w, l, rr, OUT); R(-w / 2 + 5, -l / 2 + 5, w - 10, l - 10, rr - 4, body);
    if (type === 'combi') {
      R(-w / 2 + 5, -l / 2 + 46, w - 10, 16, 0, 0xf2a51f); R(-w / 2 + 5, -l / 2 + 62, w - 10, 8, 0, 0x2f9e8f);
      R(-w / 2 + 12, -l / 2 + 12, w - 24, 28, 8, GLASS); R(-w / 2 + 14, -l / 2 + 80, w - 28, l - 110, 8, 0xe2ded0);
      R(-w / 2 + 20, -l / 2 + 92, w - 40, 22, 4, 0x8a5a32); R(-w / 2 + 24, -l / 2 + 120, w - 48, 18, 4, 0x6f8a3a);
    } else if (type === 'vocho') {
      R(-w / 2 + 12, -l / 2 + 34, w - 24, 24, 10, GLASS); R(-w / 2 + 14, -l / 2 + 60, w - 28, l - 104, 14, 0xa6dcf0); R(-w / 2 + 16, l / 2 - 40, w - 32, 14, 6, GLASS);
    } else if (type === 'micro') {
      R(-w / 2 + 5, -l / 2 + 5, w - 10, 40, 14, 0xf4f1e6); R(-w / 2 + 12, -l / 2 + 12, w - 24, 26, 8, GLASS);
      R(-w / 2 + 14, -l / 2 + 56, w - 28, l - 80, 8, 0x4fb06a);
      for (let y = -l / 2 + 70; y < l / 2 - 30; y += 34) R(-w / 2 + 20, y, w - 40, 6, 3, 0x2f7a46);
    } else if (type === 'guajolotero') {
      R(-w / 2 + 5, -l / 2 + 5, w - 10, 50, 14, 0xf2c230); R(-w / 2 + 12, -l / 2 + 14, w - 24, 26, 8, GLASS);
      R(-w / 2 + 12, -l / 2 + 64, w - 24, l - 84, 8, 0x8a5a32);                   // parrilla
      const loads = [[0xd8432e, 0.2], [0xf2c230, 0.38], [0x6f8a3a, 0.55], [0xf4f1e6, 0.7]];
      for (const [c, k] of loads) R(-w / 2 + 18, -l / 2 + l * k, w - 36, 26, 8, c);
      g.fillStyle(0xffffff); g.fillCircle(cx + 18, cy + l * 0.32, 8); g.fillStyle(0xd8432e); g.fillCircle(cx + 22, cy + l * 0.32 - 6, 3);
    } else if (type === 'camion') {
      R(-w / 2 + 5, -l / 2 + 5, w - 10, 62, 12, 0xd8432e); R(-w / 2 + 14, -l / 2 + 14, w - 28, 22, 6, GLASS);
      R(-w / 2 + 10, -l / 2 + 76, w - 20, l - 90, 4, 0xc3c7cf);
      for (let y = -l / 2 + 100; y < l / 2 - 20; y += 34) R(-w / 2 + 12, y, w - 24, 3, 0, 0x8a8f99);
    } else {
      R(-w / 2 + 13, -l / 2 + 40, w - 26, 26, 7, GLASS); R(-w / 2 + 15, l / 2 - 52, w - 30, 18, 6, GLASS, 0.85);
      R(-w / 2 + 14, -l / 2 + 70, w - 28, l - 128, 8, 0xffffff, 0.2);
      if (type === 'taxi') { R(-w / 2 + 5, -l / 2 + 5, w - 10, 30, 12, 0xffffff, 0.0); R(-w / 2 + 14, -l / 2 + 70, w - 28, l - 128, 8, 0xffffff, 0.75); R(-14, -8, 28, 16, 3, OUT); R(-10, -4, 20, 8, 2, 0xffffff); }
      if (type === 'camioneta') R(-w / 2 + 12, 10, w - 24, l / 2 - 24, 6, OUT, 0.35);
    }
    g.fillStyle(0xffffff); g.fillCircle(cx - w / 2 + 16, cy - l / 2 + 7, 5); g.fillCircle(cx + w / 2 - 16, cy - l / 2 + 7, 5);
    R(-w / 2 + 10, l / 2 - 11, 16, 6, 2, 0xd8432e); R(w / 2 - 26, l / 2 - 11, 16, 6, 2, 0xd8432e);
  }

  // ---------- partida ----------
  newGame() {
    const seed = P.seed != null ? P.seed : ((Math.random() * 4294967296) >>> 0);
    const id = this.save.sel;
    this.g = createGame(seed, { god: P.god, veh: id, upg: this.save.upg[id] });
    this.player.setTexture('veh_' + this.g.P.id);
    this.queue.length = 0; this.acc = 0; this.sparks.length = 0;
    this.crash = null; this.tilt = 0; this.slow = 0; this.warnT = 0; this.popT = 0; this.knock.setVisible(false);
    for (const f of this.tFloat) f.t.destroy();
    this.tFloat = [];
  }

  start() {
    S.unlock();
    this.newGame();
    this.mode = 'play'; this.modeT = 0;
    this.screen(null);
    if (!this.startedOnce) { this.startedOnce = true; dsTrack('game_started', 'ruta'); }
    if (P.t > 0) {
      const god = this.g.god; this.g.god = true;
      while (this.g.t < P.t) step(this.g, autoDir(this.g));
      this.g.god = god;
    }
    S.engineStart();
  }

  push(dir) {
    this.touched = true;
    if (this.queue.length < 3) this.queue.push(dir);
  }

  bindInput() {
    let sx = 0, st = 0, swiped = false, down = false;
    this.input.on('pointerdown', (p) => {
      S.unlock();
      if (this.paused) { this.paused = false; this.screen(null); return; }
      down = true; sx = p.x; st = this.time.now; swiped = false;
    });
    this.input.on('pointermove', (p) => {
      if (!down || this.mode !== 'play') return;
      const dx = (p.x - sx) / this.scale.displayScale.x;
      if (Math.abs(dx) > (swiped ? 64 : 22)) { this.push(dx > 0 ? 1 : -1); sx = p.x; swiped = true; }
    });
    this.input.on('pointerup', (p) => {
      if (!down) return; down = false;
      if (this.mode === 'play' && !swiped && this.time.now - st < 350) this.push(p.x < W / 2 ? -1 : 1);
    });
    this.input.keyboard?.on('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (this.paused) { this.paused = false; this.screen(null); return; }
      if (this.mode === 'play') {
        if (k === 'arrowleft' || k === 'a') this.push(-1);
        if (k === 'arrowright' || k === 'd') this.push(1);
        if (k === 'escape' || k === 'p') this.pause();
      } else if ((k === ' ' || k === 'enter') && (this.mode === 'menu' || (this.mode === 'dead' && this.modeT > 0.7))) this.start();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
  }

  pause() { if (this.mode === 'play' && !this.paused) { this.paused = true; this.screen('pause'); S.engineSet(420, 0.5); } }

  // ---------- interfaz HTML ----------
  bindUI() {
    const fit = () => {
      const r = this.game.canvas.getBoundingClientRect();
      const ui = $('ui'); ui.style.left = r.left + 'px'; ui.style.top = r.top + 'px'; ui.style.transform = `scale(${r.width / W})`;
    };
    this.scale.on('resize', fit); window.addEventListener('resize', () => setTimeout(fit, 50)); setTimeout(fit, 0); fit();
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); S.unlock(); S.sfx('click'); fn(); });
    click('b-play', () => this.start());
    click('b-again', () => this.start());
    click('b-garage', () => this.showGarage());
    click('b-ogarage', () => this.showGarage());
    click('b-menu', () => this.showMenu());
    click('b-gback', () => this.showMenu());
    click('b-sound', () => { this.save.sound = !this.save.sound; S.setSound(this.save.sound); writeSave(this.save); this.showMenu(); });
    $('pause').addEventListener('click', () => { this.paused = false; this.screen(null); });
    $('ver').textContent = 'prototipo ' + VERSION;
  }

  screen(id) {
    for (const s of ['menu', 'over', 'garage', 'pause']) $(s).classList.toggle('on', s === id);
  }

  showMenu() {
    this.mode = 'menu'; this.modeT = 0; S.engineStop(); S.rainSound(false);
    this.player.setTexture('veh_' + this.save.sel);
    $('m-best').textContent = this.save.best; $('m-coins').textContent = this.save.coins;
    $('b-sound').textContent = this.save.sound ? '🔊' : '🔇';
    this.screen('menu');
  }

  showGarage(sel) {
    this.mode = 'menu'; S.engineStop(); S.rainSound(false);
    const s = this.save; this.gSel = sel || this.gSel || s.sel;
    $('g-coins').textContent = s.coins;
    const cars = $('cars'); cars.innerHTML = '';
    for (const id of VEH_ORDER) {
      const v = VEHICLES[id], st = vehicleStats(id, s.upg[id]), own = s.owned[id];
      const d = document.createElement('div');
      d.className = 'car' + (id === this.gSel ? ' sel' : '') + (own ? '' : ' lock');
      d.innerHTML = `<div class="n">${v.name}</div><img src="${this.textures.getBase64('veh_' + id)}" alt="">
        <div class="d">${desc(id, st)}</div><div class="p">${own ? (s.sel === id ? '✔ Manejando' : 'Tuyo') : '🪙 ' + v.price}</div>`;
      d.addEventListener('click', () => { S.sfx('click'); this.showGarage(id); });
      cars.appendChild(d);
    }
    const id = this.gSel, v = VEHICLES[id], own = s.owned[id];
    let h = `<h3>${v.name}</h3>`;
    if (!own) {
      h += `<button class="btn" id="g-buy" ${s.coins < v.price ? 'disabled style="background:#6b665c;box-shadow:0 7px 0 #3e3a34"' : ''} style="font-size:40px;padding:16px 40px;margin:6px 0 0">Comprar · 🪙 ${v.price}</button>`;
      if (s.coins < v.price) h += `<div style="font:700 24px system-ui;margin-top:14px;color:#e9e6dc">Te faltan ${v.price - s.coins} monedas. Se ganan jugando.</div>`;
    } else {
      if (s.sel !== id) h += `<button class="btn" id="g-use" style="font-size:36px;padding:14px 40px;margin:0 0 12px">Manejar este</button>`;
      for (const k of ['cupo', 'agil', 'iman']) {
        const n = s.upg[id][k], c = upgradeCost(s, id, k);
        h += `<div class="up"><div>${UPGRADES[k].name} <span class="dots">${'●'.repeat(n)}${'○'.repeat(3 - n)}</span><br><small style="opacity:.8">${n ? UPGRADES[k].desc(id, n) : '—'}</small></div>
          <button class="btn" data-up="${k}" ${!c || s.coins < c ? 'disabled' : ''}>${c ? '🪙 ' + c : 'Máximo'}</button></div>`;
      }
    }
    $('det').innerHTML = h;
    $('g-buy')?.addEventListener('click', () => { if (buyVehicle(s, id)) { S.sfx('buy'); this.toast('¡Nuevo: ' + v.name + '!'); } else S.sfx('no'); this.showGarage(id); });
    $('g-use')?.addEventListener('click', () => { s.sel = id; writeSave(s); S.sfx('click'); this.showGarage(id); });
    for (const b of $('det').querySelectorAll('[data-up]')) b.addEventListener('click', () => { if (buyUpgrade(s, id, b.dataset.up)) S.sfx('buy'); else S.sfx('no'); this.showGarage(id); });
    this.player.setTexture('veh_' + s.sel);
    this.screen('garage');
  }

  toast(t) { const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(this.toastT); this.toastT = setTimeout(() => { e.style.display = 'none'; }, 1400); }

  // ---------- bucle ----------
  update(_, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.modeT += dt;
    const g = this.g;

    if (this.mode === 'play' && !this.paused) {
      let scale = P.speed;
      if (this.slow > 0) { this.slow -= dt; scale *= 0.3; }
      this.acc += dt * scale;
      let n = 0;
      while (this.acc >= DT && n < 60 && g.alive) {
        this.acc -= DT; n++;
        let dir = 0;
        if (P.auto) dir = autoDir(g);
        else if (this.queue.length) dir = this.queue.shift();
        step(g, dir);
        for (const e of g.events) this.onEvent(e);
      }
      S.engineSet(g.speed, this.slow > 0 ? 0.6 : 1);
    } else if (this.mode === 'menu') {
      this.menuDist += 320 * dt;
    }

    const want = Phaser.Math.Clamp((laneX(g.lane) - g.x) / LANE_W, -1, 1) * 0.22;
    this.tilt += (want - this.tilt) * Math.min(1, dt * 22);
    this.draw(dt);
  }

  float(text, x, y, color = '#ffffff', size = 40) {
    const t = this.add.text(x, y, text, { fontFamily: FONT, fontSize: size + 'px', color, stroke: '#1b1410', strokeThickness: Math.round(size / 6) }).setOrigin(0.5).setDepth(11);
    this.tFloat.push({ t, life: 1.1 });
  }

  onEvent(e) {
    const g = this.g, [k, a, b] = e.split(':');
    const px = g.x, py = PLAYER_Y - 120;
    if (k === 'lane') S.sfx('lane');
    else if (k === 'crash') this.onCrash();
    else if (k === 'board') { S.sfx('board'); this.float('+' + a + ' 🧍', px, py, '#ffffff'); }
    else if (k === 'deliver') { S.sfx('deliver'); this.float('+' + a * CFG.paxCoins + ' 🪙', px, py, '#ffd84a', 48); this.pop('¡PASAJE ENTREGADO!', '#ffd84a'); }
    else if (k === 'stop_miss' && g.pax < g.P.cap) this.float('Parada perdida', W - 170, py, '#cccccc', 28);
    else if (k === 'near') { S.sfx('near', +a); this.slow = CFG.nearSlow; this.pop(a > 1 ? `¡CASI! ×${a}` : '¡CASI!', '#7ef0ff'); this.float('+' + b, px, py, '#7ef0ff'); }
    else if (k === 'warn') this.warn(a);
    else if (k === 'rain') S.rainSound(true);
    else if (k === 'rain_end') S.rainSound(false);
    else if (k === 'boss') { S.sfx('boss'); this.shake = 0.5; }
    else if (k === 'boss_shift') S.sfx('horn');
    else if (k === 'boss_win') { S.sfx('win'); this.pop('¡LE AGUANTASTE AL TRÁILER!', '#ffd84a'); this.float('+' + CFG.bossCoins + ' 🪙', px, py, '#ffd84a', 54); }
    else if (k === 'bache') { S.sfx('bache'); this.shake = 0.25; if (a === '1') this.float('¡Se cayó uno! −1 🧍', px, py, '#ff8a6a', 30); }
    else if (k === 'shield') { S.sfx('shield'); this.shake = 0.4; this.pop('¡AGUANTÓ EL GOLPE!', '#9fd8ef'); this.spark(g.x, PLAYER_Y - 80, 30); if (g.knocked) { this.knockV = { v: g.knocked, x: g.knocked.x, y: PLAYER_Y - (g.knocked.s - g.dist), r: 0, vx: (g.knocked.x > g.x ? 1 : -1) * 600 }; this.knock.setTexture('trafico_' + g.knocked.type).setVisible(true); } }
  }

  warn(type) {
    const T = { tianguis: '⚠ ¡TIANGUIS!', lluvia: '🌧 ¡VA A LLOVER!', perro: '🐕 ¡AGUAS, UN PERRO!', baches: '⚠ ¡BACHES!', boss: '🚛 ¡VIENE EL TRÁILER!' };
    this.tWarn.setText(T[type] || '⚠'); this.warnT = 2.2;
    S.sfx(type === 'perro' ? 'dog' : 'horn');
  }
  pop(text, color) { this.tPop.setText(text).setColor(color).setScale(1.4); this.popT = 1.1; }

  spark(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 250 + Math.random() * 900;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, life: 0.35 + Math.random() * 0.55, c: Math.random() < 0.5 ? 0xffe066 : 0xff8a3c });
    }
  }

  onCrash() {
    const g = this.g;
    this.mode = 'dead'; this.modeT = 0;
    S.sfx('crash'); S.engineStop(); S.rainSound(false);
    const v = g.vehicles.find((o) => o.id === g.crashWith);
    const side = v ? Math.sign(g.x - v.x) || 1 : (Math.random() < 0.5 ? -1 : 1);
    this.crash = { x: g.x, y: PLAYER_Y, vx: side * 260, vy: -g.speed * 0.35, rot: 0, vr: side * 13, other: v ? v.id : 0, ox: 0, orot: 0 };
    this.spark(v ? (g.x + v.x) / 2 : g.x, PLAYER_Y - g.P.l / 2, 46);
    this.cameras.main.shake(420, 0.028);
    this.cameras.main.flash(120, 255, 255, 255);
    try { navigator.vibrate?.(120); } catch { /* sin vibración */ }

    const m = meters(g), sc = score(g), c = coins(g), s = this.save;
    const rec = m > s.best;
    s.runs++; s.coins += c; s.totalPax += g.delivered; s.totalM += m;
    if (rec) s.best = m;
    if (sc > s.bestScore) s.bestScore = sc;
    writeSave(s);
    if (rec && s.runs > 1) setTimeout(() => S.sfx('record'), 600);
    $('o-title').textContent = { tianguis: '¡TE METISTE AL TIANGUIS!', trailer: '¡TE APLASTÓ EL TRÁILER!', dog: '¡EL PERRITO! (está bien)' }[g.crashKind] || '¡CHOCASTE!';
    $('o-m').textContent = m + ' m';
    $('o-rec').textContent = rec && s.runs > 1 ? '¡NUEVO RÉCORD!' : 'Récord: ' + s.best + ' m';
    $('o-lines').innerHTML = [
      ['Puntos', sc], ['Pasaje entregado', g.delivered + (g.pax ? ` <small>(${g.pax} sin entregar)</small>` : '')],
      ['¡Casi!', g.nears], ...(g.bossWins ? [['Tráileres', g.bossWins]] : []), ['Monedas', '+' + c + ' 🪙'],
    ].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    setTimeout(() => { if (this.mode === 'dead') this.screen('over'); }, 700);
  }

  // ---------- dibujo ----------
  y(s) { return PLAYER_Y - (s - this.g.dist); }

  draw(dt) {
    const g = this.g, gf = this.gfx, top = this.top;
    const play = this.mode !== 'menu';
    const dist = play ? g.dist : this.menuDist;
    gf.clear(); top.clear();

    // banquetas y calle
    gf.fillStyle(0x8f8a80); gf.fillRect(0, 0, W, H);
    gf.fillStyle(0x7d786f);
    const slab = 160, off = dist % slab;
    for (let y = -slab + off; y < H; y += slab) { gf.fillRect(0, y, ROAD_X, 4); gf.fillRect(W - ROAD_X, y, ROAD_X, 4); }
    gf.fillStyle(0x3a3d44); gf.fillRect(ROAD_X, 0, LANE_W * LANES, H);
    gf.fillStyle(0xf2c230); gf.fillRect(ROAD_X, 0, 8, H); gf.fillRect(ROAD_X + LANE_W * LANES - 8, 0, 8, H);
    gf.fillStyle(0xe9e6dc);
    const dash = 150, doff = dist % dash;
    for (let i = 1; i < LANES; i++) { const x = ROAD_X + LANE_W * i - 5; for (let y = -dash + doff; y < H; y += dash) gf.fillRect(x, y, 10, 70); }
    const treeGap = 520, toff = dist % treeGap;
    for (let y = -treeGap + toff; y < H + 80; y += treeGap) { this.tree(top, 28, y); this.tree(top, W - 28, y + treeGap / 2); this.tree(top, W - 28, y - treeGap / 2); }

    if (play) {
      // cosas en la calle: paradas, terminal, tianguis, baches
      for (const f of visibleFeatures(g, dist - 600, dist + 1400)) this.drawFeat(gf, top, f);
      for (const b of g.baches) {
        const y = this.y(b.s); if (y < -60 || y > H + 60) continue;
        gf.fillStyle(0x1f2024); gf.fillEllipse(laneX(b.lane), y, 60, 44); gf.fillStyle(0x2c2e33); gf.fillEllipse(laneX(b.lane) - 4, y - 3, 44, 30);
      }
    }

    // vehículos
    let i = 0;
    if (play) {
      for (const v of g.vehicles) {
        if (v.gone) continue;
        let y = this.y(v.s), x = v.x, rot = 0;
        if (this.crash && v.id === this.crash.other) {
          const c = this.crash, k = Math.max(0, 1 - this.modeT);
          c.ox += -Math.sign(c.vx) * 120 * dt * k; c.orot += -Math.sign(c.vx) * 2.2 * dt * k;
          x += c.ox; rot = c.orot;
        }
        if (y < -200 || y > H + 200) continue;
        const sp = this.pool[i] || (this.pool[i] = this.add.image(0, 0, 'trafico_taxi').setDepth(2));
        sp.setTexture('trafico_' + v.type).setPosition(x, y).setRotation(rot).setVisible(true);
        i++;
        if (v.parked) { const on = (this.time.now / 300 | 0) % 2; if (on) { top.fillStyle(0xffb020, 0.9); top.fillCircle(x - 34, y - 70, 7); top.fillCircle(x + 34, y - 70, 7); top.fillCircle(x - 34, y + 70, 7); top.fillCircle(x + 34, y + 70, 7); } }
      }
    }
    for (; i < this.pool.length; i++) this.pool[i].setVisible(false);

    if (this.knockV) {
      const k = this.knockV; k.x += k.vx * dt; k.y += 300 * dt; k.r += 9 * dt * Math.sign(k.vx);
      this.knock.setPosition(k.x, k.y).setRotation(k.r).setAlpha(Math.max(0, 1 - k.r * Math.sign(k.vx) / 6));
      if (k.x < -200 || k.x > W + 200) { this.knockV = null; this.knock.setVisible(false); }
    }

    // perro y Tráiler
    if (play && g.dog) this.drawDog(top, g.dog.x, this.y(g.dog.s), g.dog.vx);
    if (play && g.boss) this.drawTrailer(top, g.boss.x, this.y(g.dist + g.boss.off), g.boss);

    // jugador
    if (this.crash) {
      const c = this.crash, k = Math.max(0, 1 - this.modeT / 1.1);
      c.x += c.vx * dt * k; c.y += c.vy * dt * k; c.rot += c.vr * dt * k;
      c.x = Phaser.Math.Clamp(c.x, 40, W - 40);
      this.player.setPosition(c.x, c.y).setRotation(c.rot).setAlpha(1);
    } else {
      this.player.setPosition(play ? g.x : W / 2, PLAYER_Y).setRotation(this.tilt);
      this.player.setAlpha(g.invul > 0 ? 0.5 + 0.5 * ((this.time.now / 80 | 0) % 2) : 1);
    }

    // efectos
    const fx = this.fx; fx.clear();
    if (play && g.rain > 0) this.drawRain(fx, dt);
    for (const s of this.sparks) {
      s.life -= dt; if (s.life <= 0) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 1500 * dt;
      fx.fillStyle(s.c, Math.min(1, s.life * 3)); fx.fillRect(s.x - 5, s.y - 5, 10, 10);
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    if (this.shake > 0) { this.shake -= dt; this.cameras.main.setScroll((Math.random() - 0.5) * 14 * this.shake * 2, (Math.random() - 0.5) * 14 * this.shake * 2); }
    else this.cameras.main.setScroll(0, 0);
    if (this.slow > 0) { fx.fillStyle(0x7ef0ff, 0.12 * (this.slow / CFG.nearSlow)); fx.fillRect(0, 0, W, H); }

    if (this.mode === 'play' && !this.touched && !P.auto && g.t < 7) this.hand(fx, g.t);
    this.hud(dt);
  }

  tree(gf, x, y) { gf.fillStyle(0x2f6b3a); gf.fillCircle(x, y, 30); gf.fillStyle(0x3f8a4b); gf.fillCircle(x - 6, y - 7, 19); gf.fillStyle(0xa77bd6, 0.9); gf.fillCircle(x + 9, y + 6, 6); gf.fillCircle(x - 12, y + 10, 5); }

  drawFeat(gf, top, f) {
    const g = this.g;
    if (f.type === 'stop' || f.type === 'terminal') {
      const y0 = this.y(f.s + f.len), y1 = this.y(f.s);
      const x0 = ROAD_X + LANE_W * RIGHT + 8, x1 = ROAD_X + LANE_W * LANES - 10;
      const term = f.type === 'terminal';
      const col = term ? 0x3fd17a : 0xffd84a;
      gf.fillStyle(col, f.done ? 0.08 : 0.22); gf.fillRect(x0, y0, x1 - x0, y1 - y0);
      gf.lineStyle(6, col, f.done ? 0.3 : 0.9); gf.strokeRect(x0, y0, x1 - x0, y1 - y0);
      // en la banqueta
      if (term) {
        top.fillStyle(OUT); top.fillRoundedRect(W - 64, y0 - 30, 70, y1 - y0 + 60, 10);
        top.fillStyle(0x3f9b5a); top.fillRoundedRect(W - 60, y0 - 26, 66, y1 - y0 + 52, 8);
        top.fillStyle(0xffd84a); top.fillCircle(W - 30, (y0 + y1) / 2, 20);
        top.fillStyle(OUT); top.fillRect(W - 34, (y0 + y1) / 2 - 12, 8, 24);
      } else {
        top.fillStyle(OUT); top.fillRoundedRect(W - 58, y0 + 30, 52, y1 - y0 - 60, 8);
        top.fillStyle(0x2f76d2); top.fillRoundedRect(W - 55, y0 + 33, 46, y1 - y0 - 66, 6);
        if (!f.done) { const n = 2 + (f.s % 3 | 0); for (let i = 0; i < n; i++) { top.fillStyle(OUT); top.fillCircle(W - 32, y0 + 70 + i * 34, 13); top.fillStyle([0xd8432e, 0xf2c230, 0x7cc6e8, 0x9b59b6][i % 4]); top.fillCircle(W - 32, y0 + 70 + i * 34, 10); } }
      }
      // flecha en el piso que avisa
      if (!f.done && ((term && g.pax > 0) || (!term && g.pax < g.P.cap))) {
        const cx = (x0 + x1) / 2, cy = y1 + 140;
        gf.fillStyle(col, 0.85); gf.fillTriangle(cx, cy - 40, cx - 34, cy + 10, cx + 34, cy + 10); gf.fillRect(cx - 12, cy + 10, 24, 40);
      }
    } else if (f.type === 'tianguis') {
      const y0 = Math.max(-40, this.y(f.s + f.len)), y1 = Math.min(H + 40, this.y(f.s));
      if (y1 < -40 || y0 > H + 40) return;
      const lo = Math.min(...f.blocks), hi = Math.max(...f.blocks);
      const x0 = ROAD_X + LANE_W * lo + 4, x1 = ROAD_X + LANE_W * (hi + 1) - 4;
      const cols = [0xff5fa2, 0x2fa8e0, 0xffd84a, 0x3fd17a, 0xff8a3c];
      const step0 = 150, base = this.y(f.s);
      for (let y = base; y > y0 - step0; y -= step0) {
        if (y - step0 > y1) continue;
        const idx = Math.abs(Math.round((base - y) / step0));
        top.fillStyle(OUT); top.fillRect(x0, y - step0, x1 - x0, step0);
        top.fillStyle(cols[idx % cols.length]); top.fillRect(x0 + 4, y - step0 + 4, x1 - x0 - 8, step0 - 8);
        top.fillStyle(0xffffff, 0.35); for (let x = x0 + 20; x < x1 - 10; x += 60) top.fillRect(x, y - step0 + 4, 22, step0 - 8);
      }
      const yb = this.y(f.s);
      if (yb > -20 && yb < H + 20) { top.fillStyle(0xff3b30); for (let x = x0; x < x1; x += 50) { top.fillTriangle(x + 10, yb + 6, x + 25, yb - 26, x + 40, yb + 6); } }
    }
  }

  drawDog(gf, x, y, vx) {
    const d = Math.sign(vx) || 1;
    gf.fillStyle(OUT); gf.fillEllipse(x, y, 66, 34); gf.fillStyle(0xb07a45); gf.fillEllipse(x, y, 58, 26);
    gf.fillStyle(OUT); gf.fillCircle(x + d * 30, y - 2, 15); gf.fillStyle(0xc8925a); gf.fillCircle(x + d * 30, y - 2, 12);
    gf.fillStyle(0x6b4423); gf.fillEllipse(x + d * 28, y - 13, 10, 14); gf.fillEllipse(x + d * 28, y + 9, 10, 14);
    const wag = Math.sin(this.time.now / 60) * 8;
    gf.lineStyle(6, 0xb07a45); gf.lineBetween(x - d * 28, y, x - d * 44, y + wag);
  }

  drawTrailer(gf, x, y, b) {
    const w = LANE_W * 3 - 14, l = TRAILER.l;
    gf.fillStyle(0x000000, 0.25); gf.fillRoundedRect(x - w / 2 + 10, y - l / 2 + 12, w, l, 18);
    gf.fillStyle(OUT); gf.fillRoundedRect(x - w / 2, y - l / 2, w, l, 18);
    gf.fillStyle(0xb0b5bd); gf.fillRoundedRect(x - w / 2 + 6, y - l / 2 + 140, w - 12, l - 146, 12);
    for (let yy = y - l / 2 + 170; yy < y + l / 2 - 20; yy += 44) { gf.fillStyle(0x8a8f99); gf.fillRect(x - w / 2 + 14, yy, w - 28, 5); }
    gf.fillStyle(0xd8432e); gf.fillRoundedRect(x - 110, y - l / 2 + 6, 220, 130, 16);
    gf.fillStyle(GLASS); gf.fillRoundedRect(x - 90, y - l / 2 + 18, 180, 40, 8);
    gf.fillStyle(0xffd84a); gf.fillRect(x - w / 2 + 6, y + l / 2 - 26, w - 12, 18);
    gf.fillStyle(OUT); for (let xx = x - w / 2 + 6; xx < x + w / 2 - 20; xx += 40) gf.fillRect(xx, y + l / 2 - 26, 20, 18);
    // direccionales cuando se va a cambiar de lado
    if (b.phase === 'ahead' || b.phase === 'shift') {
      const on = (this.time.now / 150 | 0) % 2;
      if (on) { const sx = b.side === 0 ? 1 : -1; gf.fillStyle(0xffb020); gf.fillCircle(x + sx * (w / 2 - 14), y - l / 2 + 14, 14); gf.fillCircle(x + sx * (w / 2 - 14), y + l / 2 - 14, 14); }
    }
  }

  drawRain(fx, dt) {
    fx.fillStyle(0x1a2a44, 0.22); fx.fillRect(0, 0, W, H);
    while (this.drops.length < 90) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 1400 + Math.random() * 600 });
    fx.lineStyle(3, 0xbfd8ff, 0.45);
    for (const d of this.drops) { d.y += d.v * dt; d.x -= 120 * dt; if (d.y > H) { d.y = -40; d.x = Math.random() * (W + 100); } fx.lineBetween(d.x, d.y, d.x - 8, d.y + 34); }
  }

  hand(fx, t) {
    const ph = (t % 1.6) / 1.6, k = ph < 0.5 ? ph * 2 : 1 - (ph - 0.5) * 2, e = k * k * (3 - 2 * k);
    const x = W / 2 - 130 + 260 * e, y = 1180;
    fx.fillStyle(0xffffff, 0.22); fx.fillRoundedRect(W / 2 - 150, y - 14, 300, 28, 14);
    fx.fillStyle(0xffffff, 0.35); fx.fillTriangle(W / 2 - 176, y, W / 2 - 150, y - 20, W / 2 - 150, y + 20); fx.fillTriangle(W / 2 + 176, y, W / 2 + 150, y - 20, W / 2 + 150, y + 20);
    fx.fillStyle(0x1b1410, 0.9); fx.fillCircle(x, y, 40); fx.fillRoundedRect(x - 26, y, 52, 86, 22);
    fx.fillStyle(0xffe0bd); fx.fillCircle(x, y, 34); fx.fillRoundedRect(x - 21, y, 42, 80, 18);
    fx.fillStyle(0xffffff, 0.55); fx.fillCircle(x - 8, y - 10, 10);
  }

  hud(dt) {
    const g = this.g, play = this.mode === 'play', hg = this.hudG; hg.clear();
    const show = play || (this.mode === 'dead' && this.modeT < 0.7);
    this.tMeters.setVisible(show).setText(meters(g) + ' m');
    this.tScore.setVisible(show).setText(score(g) + ' pts');
    this.tPax.setVisible(show).setText(`${g.pax}/${g.P.cap}`);
    this.tCoins.setVisible(show).setText('🪙 ' + coins(g));
    this.tShield.setVisible(show && g.P.shield > 0).setText(g.shield > 0 ? '🛡 1 golpe' : '🛡 —');
    if (show) {
      // ícono de pasajero
      hg.fillStyle(0x1b1410, 0.75); hg.fillRoundedRect(18, 30, 64 + this.tPax.width + 14, 64, 30);
      hg.fillStyle(0xffffff); hg.fillCircle(56, 50, 11); hg.fillRoundedRect(44, 62, 24, 22, 8);
      if (g.pax >= g.P.cap) { hg.lineStyle(4, 0x3fd17a); hg.strokeRoundedRect(18, 30, 64 + this.tPax.width + 14, 64, 30); }
    }
    // aviso
    if (this.warnT > 0) { this.warnT -= dt; this.tWarn.setVisible(play).setAlpha(Math.min(1, this.warnT * 3)).setScale(1 + 0.05 * Math.sin(this.modeT * 14)); } else this.tWarn.setVisible(false);
    if (this.popT > 0) { this.popT -= dt; this.tPop.setVisible(play).setAlpha(Math.min(1, this.popT * 3)).setScale(1 + 0.4 * Math.max(0, this.popT - 0.8)); } else this.tPop.setVisible(false);
    // Tráiler: cuánto falta
    if (play && g.boss && g.boss.phase !== 'out') {
      const left = Math.max(0, Math.ceil(CFG.bossTime - g.boss.t));
      this.tBoss.setVisible(true).setText(`🚛 Aguanta: ${left} s`);
      const k = Math.min(1, g.boss.t / CFG.bossTime);
      hg.fillStyle(0x1b1410, 0.8); hg.fillRoundedRect(W / 2 - 180, 240, 360, 22, 11);
      hg.fillStyle(0xffd84a); hg.fillRoundedRect(W / 2 - 176, 244, 352 * k, 14, 7);
    } else this.tBoss.setVisible(false);
    for (const f of this.tFloat) { f.life -= dt; f.t.y -= 90 * dt; f.t.setAlpha(Math.min(1, f.life * 2)); }
    this.tFloat = this.tFloat.filter((f) => { if (f.life <= 0) { f.t.destroy(); return false; } return true; });
  }
}

function desc(id, st) {
  const v = VEHICLES[id];
  const extra = { vocho: 'Cambia de carril rapidísimo', micro: 'Más largo', taxi: '+20 % de monedas', guajolotero: 'Aguanta 1 choque', moto: 'Muy angosta · «¡Casi!» ×2', combi: 'La de siempre' }[id];
  return `${st.cap} pasajeros<br>${extra}`;
}

new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#15171b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 }, fps: { smoothStep: true }, scene: [Juego],
});

// App instalable: solo en su dominio (en el enlace privado de prueba no se registra).
if ('serviceWorker' in navigator && /darkshadow-studios\.com$/.test(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
