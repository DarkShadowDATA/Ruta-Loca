// Cuenta DarkShadow en Ruta Loca: la sesión vive en cookies de .darkshadow-studios.com (la crea darkshadow-studios.com/cuenta).
// Aquí solo se lee esa sesión, se renueva cuando vence y se habla con el servidor del estudio (repo de Mutantes: server/src/routes/rutaloca.ts).
// Sin cuenta (o sin internet) el juego sigue igual, con el guardado del celular.
export const STUDIO = 'darkshadow-studios.com';
export const API = `https://${STUDIO}/api`;
export const onStudio = () => location.hostname === STUDIO || location.hostname.endsWith('.' + STUDIO);
export const loginUrl = () => `https://${STUDIO}/cuenta?volver=${encodeURIComponent(location.href.split('#')[0])}`;
export const shadowUrl = () => `https://${STUDIO}/cuenta?volver=${encodeURIComponent(location.href.split('#')[0])}#tienda`;

const YEAR = 400 * 24 * 3600, CHUNK = 3500;
const readRaw = (name) => { const hit = document.cookie.split('; ').find(c => c.startsWith(name + '=')); return hit ? hit.slice(name.length + 1) : null; };
const writeRaw = (name, value, maxAge) => { document.cookie = `${name}=${value}; Domain=.${STUDIO}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`; };
// Mismo formato que client/src/auth.ts de Mutantes (Supabase guarda la sesión en trozos de 3500)
const cookies = {
  get(key) {
    const n = Number(readRaw(`${key}.n`)); if (!n) return null;
    let s = ''; for (let i = 0; i < n; i++) { const p = readRaw(`${key}.${i}`); if (p === null) return null; s += p; }
    try { return JSON.parse(decodeURIComponent(s)); } catch (e) { return null; }
  },
  set(key, obj) {
    const parts = encodeURIComponent(JSON.stringify(obj)).match(new RegExp(`.{1,${CHUNK}}`, 'g')) || [''];
    const old = Number(readRaw(`${key}.n`)) || 0;
    parts.forEach((p, i) => writeRaw(`${key}.${i}`, p, YEAR));
    writeRaw(`${key}.n`, String(parts.length), YEAR);
    for (let i = parts.length; i < old; i++) writeRaw(`${key}.${i}`, '', 0);
  },
};

let cfg = null, key = '', session = null;
// Solo para probar en la compu (localhost): ?devapi=http://127.0.0.1:3077 usa el servidor local con DEV_AUTH
const DEVAPI = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? new URLSearchParams(location.search).get('devapi') : null;
export let user = null; // { name }

const timeout = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

/** Lee la sesión del dominio. Devuelve el usuario o null (sin cuenta, sin internet o fuera del dominio del estudio). */
export async function initCuenta() {
  if (DEVAPI) { user = { name: 'Dev 4242' }; return user; }
  if (!onStudio()) return null;
  try {
    cfg = await fetch(`${API}/config`, { signal: timeout(6000) }).then(r => r.json());
    if (!cfg.supabaseUrl) return null;
    key = `sb-${new URL(cfg.supabaseUrl).hostname.split('.')[0]}-auth-token`;
    session = cookies.get(key);
    if (!session || !session.refresh_token) return null;
    if (!await fresh()) return null;
    const m = (session.user && session.user.user_metadata) || {};
    user = { name: (m.full_name || m.name || m.user_name || 'Chofer').slice(0, 30) };
    return user;
  } catch (e) { return null; }
}

/** Renueva el token si vence en menos de 1 minuto (como lo haría Supabase). */
async function fresh() {
  session = cookies.get(key) || session; // otra pestaña (o /cuenta) pudo renovarla
  if (session.expires_at && session.expires_at * 1000 - Date.now() > 60000) return true;
  const r = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }), signal: timeout(8000),
  });
  if (!r.ok) { if (r.status === 400 || r.status === 401) { session = null; user = null; } return false; }
  const s = await r.json();
  if (!s.expires_at && s.expires_in) s.expires_at = Math.floor(Date.now() / 1000) + s.expires_in;
  session = s; cookies.set(key, s);
  return true;
}

/** Llamada al servidor del estudio con la sesión. Lanza Error con el mensaje del servidor. */
export async function api(path, init = {}) {
  let auth;
  if (DEVAPI) auth = { 'x-dev-user': '4242' };
  else { if (!session || !await fresh()) throw new Error('Inicia sesión con tu cuenta DarkShadow.'); auth = { Authorization: `Bearer ${session.access_token}` }; }
  const r = await fetch(`${DEVAPI ? DEVAPI + '/api' : API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...auth, ...(init.headers || {}) }, signal: timeout(10000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'No se pudo conectar. Intenta otra vez.'); e.status = r.status; e.data = j; throw e; }
  return j;
}
