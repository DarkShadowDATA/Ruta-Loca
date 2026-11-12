// Cuenta DarkShadow en Ruta Loca: nube, Tienda Shadow, pinturas (normales y de colección), Pozo y mercado.
// Servidor: repo de Mutantes server/src/routes/rutaloca.ts y server/src/routes/pozos.ts (prefijo /rl/ y juego 'rutaloca').
// Todo es opcional: sin cuenta o sin internet el juego sigue igual con el guardado del celular.
// Reglas de pago del estudio: un solo lugar para comprar (pestaña Tienda + precios junto al vehículo en el Garaje), nada a media
// partida ni al chocar, nada de poder exclusivo de pago, sin relojes de oferta; en el Pozo nada comprado cuenta.
import { initCuenta, api, onStudio, user, loginUrl, shadowUrl } from './cuenta.js';
import { mergeSaves, replaceSave, onPersist, writeSave } from './save.js';
export { loginUrl, shadowUrl, api };

export const nube = { on: false, can: false, name: '', rev: 0, state: '', shadow: 0, tienda: [], ediciones: [], compras: {}, pinturas: [], mercado: false };
const listeners = [];
export function onNube(fn) { listeners.push(fn); }
const changed = () => listeners.forEach((f) => { try { f(); } catch { /* nada */ } });

/** Pinturas: ids, nombre y colores del dibujo de código (relleno hasta el arte de ChatGPT). */
export const PAINTS = {
  flamas:    { name: 'Flamas',       body: 0x1b1410, a: 0xff5a1f, b: 0xffd84a, tipo: 'flamas' },
  lowrider:  { name: 'Lowrider',     body: 0x6b2fa0, a: 0xd9b8ff, b: 0xffd84a, tipo: 'rayas' },
  taxi_rosa: { name: 'Taxi rosa',    body: 0xff8fb8, a: 0xffffff, b: 0xffffff, tipo: 'mitad' },
  lucha:     { name: 'Lucha libre',  body: 0x2f76d2, a: 0xffd84a, b: 0xd8432e, tipo: 'mascara' },
  neon:      { name: 'Neón',         body: 0x15171b, a: 0x5ff0ff, b: 0xff4fa0, tipo: 'rayas' },
  talavera:  { name: 'Talavera',     body: 0xf4f1e6, a: 0x1f4fb0, b: 0xf2c230, tipo: 'puntos' },
  // colección (con número de serie; se venden en el mercado)
  combi_dorada:   { name: 'Combi dorada',   body: 0xd4a017, a: 0xfff1a8, b: 0x8a6510, tipo: 'brillo', col: true },
  combi_cromo:    { name: 'Combi cromo',    body: 0xb9c2cc, a: 0xffffff, b: 0x6b7480, tipo: 'brillo', col: true },
  combi_calavera: { name: 'Combi calavera', body: 0x15171b, a: 0xf4f1e6, b: 0xff5fa2, tipo: 'calavera', col: true },
  combi_pozo:     { name: 'Combi del Pozo', body: 0x2e9b4f, a: 0xffd84a, b: 0x15171b, tipo: 'brillo', col: true },
};
export const NORMAL_PAINTS = ['flamas', 'lowrider', 'taxi_rosa', 'lucha', 'neon', 'talavera'];
export const RAR_NAME = ['Común', 'Rara', 'Épica', 'Legendaria'];

/** Pintura del día (prueba gratis por una partida): igual para todos según la fecha. */
export function paintOfDay() {
  const d = new Date(), n = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  return NORMAL_PAINTS[n % NORMAL_PAINTS.length];
}

/** Pinturas que tiene el jugador: normales compradas + de colección en su garaje (las publicadas en el mercado no se pueden usar). */
export function ownedPaints() {
  const out = NORMAL_PAINTS.filter((p) => (nube.compras[`pint_${p}`] | 0) > 0 || (p === 'flamas' && (nube.compras.inicio | 0) > 0));
  for (const it of nube.pinturas) if (it.status === 'bodega' && !out.includes(it.ref)) out.push(it.ref);
  return out;
}

// ---------- nube ----------
let save = null, timer = null, pushing = false, again = false;
function schedule() { if (!nube.on) return; clearTimeout(timer); timer = setTimeout(push, 1500); }
async function push() {
  if (pushing) { again = true; return; }
  pushing = true;
  try { const r = await api('/rl/save', { method: 'PUT', body: JSON.stringify({ rev: nube.rev, save }) }); nube.rev = r.rev; nube.state = 'ok'; }
  catch (e) {
    if (e.status === 409 && e.data && e.data.save) { replaceSave(save, mergeSaves(save, e.data.save)); nube.rev = e.data.rev; again = true; }
    else nube.state = 'offline';
  }
  pushing = false; changed();
  if (again) { again = false; schedule(); }
}

/** Entrega lo comprado que el juego guarda en el celular (vehículos, paquete de inicio). Una sola vez por compra. */
export function applyCompras(s) {
  s.applied = s.applied || {};
  let changedAny = false;
  for (const [id, n] of Object.entries(nube.compras)) {
    if (!(n > 0)) continue;
    if (id.startsWith('veh_') && !s.owned[id.slice(4)]) { s.owned[id.slice(4)] = true; changedAny = true; }
    if (id === 'inicio' && !s.applied.inicio) { s.applied.inicio = true; s.owned.vocho = true; s.coins += 500; changedAny = true; }
    if (id === 'apoyo' && !s.apoyo) { s.apoyo = true; changedAny = true; }
  }
  if (s.paint && !ownedPaints().includes(s.paint)) { s.paint = ''; changedAny = true; }
  return changedAny;
}

export async function startNube(s) {
  save = s;
  nube.can = onStudio() && window.top === window.self;
  const u = await initCuenta();
  if (!u) { changed(); return; }
  try {
    const r = await api('/rl/save');
    Object.assign(nube, { on: true, name: user.name, rev: r.rev, shadow: r.shadow, tienda: r.tienda || [], ediciones: r.ediciones || [],
      compras: r.compras || {}, pinturas: r.pinturas || [], mercado: !!r.mercado });
    if (r.save) replaceSave(save, mergeSaves(save, r.save));
    applyCompras(save);
    onPersist(schedule);
    writeSave(save);
    await push();
  } catch { nube.state = 'offline'; }
  changed();
}

export async function buy(item) {
  const r = await api('/rl/comprar', { method: 'POST', body: JSON.stringify({ item }) });
  nube.shadow = r.shadow; nube.compras = r.compras || nube.compras; nube.ediciones = r.ediciones || nube.ediciones; nube.pinturas = r.pinturas || nube.pinturas;
  if (applyCompras(save)) writeSave(save);
  changed();
  return r;
}

// ---------- mercado de pinturas de colección ----------
export const mercadoGet = () => api('/rl/mercado');
export async function mercadoVender(item, price) { const r = await api('/rl/mercado/vender', { method: 'POST', body: JSON.stringify({ item, price }) }); nube.pinturas = r.pinturas; if (applyCompras(save)) writeSave(save); changed(); return r; }
export async function mercadoCancelar(id) { const r = await api(`/rl/mercado/${id}/cancelar`, { method: 'POST', body: '{}' }); nube.pinturas = r.pinturas; changed(); return r; }
export async function mercadoComprar(id) { const r = await api(`/rl/mercado/${id}/comprar`, { method: 'POST', body: '{}' }); nube.pinturas = r.pinturas; nube.shadow = r.shadow; changed(); return r; }

// ---------- Pozo ----------
export const pozoInfo = () => api('/pozo/rutaloca');
export const pozoStart = () => api('/pozo/rutaloca/start', { method: 'POST', body: '{}' });
export const pozoFinish = (attemptId, inputs, name) => api('/pozo/rutaloca/finish', { method: 'POST', body: JSON.stringify({ attemptId, inputs, name }) });
