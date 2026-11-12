// Sonido propio de Ruta Loca, hecho con código (Web Audio): sin archivos que descargar.
let ctx = null, master = null, engine = null, engGain = null, engFilter = null, rainNode = null, rainGain = null;
let on = true;

export function setSound(v) { on = !!v; if (master) master.gain.value = on ? 0.55 : 0; }
export function soundOn() { return on; }

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = on ? 0.55 : 0; master.connect(ctx.destination);
  } catch { ctx = null; }
}

function noiseBuf(sec = 1) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function tone(freq, t0, dur, type = 'square', vol = 0.2, slideTo = 0) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn); gn.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, vol, f0, f1, q = 1, type = 'bandpass') {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(dur + 0.05);
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const gn = ctx.createGain(); gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(gn); gn.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
}

export function sfx(name, arg = 0) {
  if (!ctx || !on) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'lane': noise(t, 0.12, 0.25, 700, 2400, 0.8); break;
    case 'crash':
      noise(t, 0.6, 0.9, 1800, 120, 0.6, 'lowpass');
      tone(110, t, 0.35, 'sawtooth', 0.35, 40);
      noise(t + 0.05, 0.4, 0.3, 4000, 2000, 2);           // vidrios
      break;
    case 'board': tone(880, t, 0.09, 'triangle', 0.25); tone(1320, t + 0.09, 0.14, 'triangle', 0.25); break;
    case 'deliver': [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.07, 0.16, 'square', 0.12)); noise(t + 0.3, 0.15, 0.2, 5000, 0, 3, 'highpass'); break;
    case 'near': tone(500 + arg * 120, t, 0.18, 'sawtooth', 0.12, 1400 + arg * 200); break;
    case 'horn': tone(392, t, 0.22, 'square', 0.18); tone(494, t, 0.22, 'square', 0.14); tone(392, t + 0.28, 0.3, 'square', 0.18); tone(494, t + 0.28, 0.3, 'square', 0.14); break;
    case 'boss': tone(98, t, 0.9, 'sawtooth', 0.3); tone(104, t, 0.9, 'sawtooth', 0.25); break;
    case 'win': [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.2, 'square', 0.14)); break;
    case 'record': [659, 784, 988, 1318].forEach((f, i) => tone(f, t + i * 0.1, 0.22, 'triangle', 0.22)); break;
    case 'bache': tone(90, t, 0.18, 'sine', 0.5, 50); noise(t, 0.12, 0.3, 300, 0, 1, 'lowpass'); break;
    case 'shield': tone(300, t, 0.3, 'square', 0.2, 900); break;
    case 'dog': tone(620, t, 0.07, 'square', 0.15, 480); tone(620, t + 0.13, 0.07, 'square', 0.15, 480); break;
    case 'click': tone(1200, t, 0.04, 'square', 0.08); break;
    case 'buy': tone(988, t, 0.08, 'square', 0.15); tone(1318, t + 0.08, 0.2, 'square', 0.15); break;
    case 'no': tone(200, t, 0.18, 'square', 0.12, 150); break;
  }
}

// Motor: zumbido que sube con la velocidad.
export function engineStart() {
  if (!ctx || engine) return;
  engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 55;
  engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 400;
  engGain = ctx.createGain(); engGain.gain.value = 0.0001;
  engine.connect(engFilter); engFilter.connect(engGain); engGain.connect(master); engine.start();
  engGain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.3);
}
export function engineSet(speed, slow = 1) {
  if (!engine) return;
  const k = (speed - 420) / 980;
  engine.frequency.setTargetAtTime((52 + k * 60) * slow, ctx.currentTime, 0.1);
  engFilter.frequency.setTargetAtTime(380 + k * 700, ctx.currentTime, 0.1);
}
export function engineStop() {
  if (!engine) return;
  const e = engine, gn = engGain;
  gn.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
  setTimeout(() => { try { e.stop(); } catch { /* ya paró */ } }, 300);
  engine = null;
}
export function rainSound(v) {
  if (!ctx) return;
  if (v && !rainNode) {
    rainNode = ctx.createBufferSource(); rainNode.buffer = noiseBuf(2); rainNode.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    rainGain = ctx.createGain(); rainGain.gain.value = 0.0001;
    rainNode.connect(f); f.connect(rainGain); rainGain.connect(master); rainNode.start();
    rainGain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.4);
  } else if (!v && rainNode) {
    const n = rainNode; rainGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    setTimeout(() => { try { n.stop(); } catch { /* ya paró */ } }, 1200);
    rainNode = null;
  }
}
