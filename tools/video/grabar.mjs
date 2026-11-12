// Graba cualquier página con reloj controlado: 1080×1920 (viewport vw×vh × dpr). Basado en tools/video/grabar.mjs de Mutantes.
// spec: { out, secs, url, vw:1080, vh:1920, dpr:1, css:false, uiZoom: 3, init:{localStorage}, pre:[{eval|click|wait}], acts:[{f, eval|click}] }
import fs from 'node:fs';
import { createRequire } from 'node:module';
const req = createRequire('/home/claude/mutantes-wasteland/package.json');
let pw; try { pw = req('playwright'); } catch { pw = createRequire(process.execPath)('playwright'); }
const { chromium } = pw;
const S = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.rmSync(S.out, { recursive: true, force: true }); fs.mkdirSync(S.out, { recursive: true });
const b = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: S.vw ?? 1080, height: S.vh ?? 1920 }, deviceScaleFactor: S.dpr ?? 1, locale: 'es-MX' });
if (S.init) await ctx.addInitScript(o => { try { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } catch {} }, S.init);
await ctx.addInitScript({ path: new URL('./clock.js', import.meta.url).pathname });
for (const r of S.routes ?? []) await ctx.route(r.match, route => route.fulfill({ json: r.json, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }));
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(S.url); await page.waitForTimeout(S.load ?? 2500);
if (S.style) await page.addStyleTag({ content: S.style });
const run = async a => {
  if (a.click) await page.click(a.click, { timeout: 3000 }).catch(() => errs.push('click ' + a.click));
  if (a.eval) await page.evaluate(a.eval).catch(e => errs.push('eval ' + e.message));
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.shot) await page.screenshot({ path: a.shot });
};
for (const a of S.pre ?? []) await run(a);
await page.evaluate(() => window.__manual());
if (S.warm) await page.evaluate(n => { for (let i = 0; i < n; i++) window.__step(1000 / 30); }, Math.round(S.warm * 30));
for (const a of S.post ?? []) await run(a);
let cdp = null;
if (S.css) { cdp = await ctx.newCDPSession(page); await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.12 }); }
const N = Math.round(S.secs * 30); let last = Date.now();
for (let i = 0; i < N; i++) {
  for (const a of S.acts ?? []) if (a.f === i) await run(a);
  await page.evaluate(() => window.__step(1000 / 30));
  await page.screenshot({ path: `${S.out}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  if (cdp) { const now = Date.now(), dt = Math.max(40, now - last); last = now; await cdp.send('Animation.setPlaybackRate', { playbackRate: Math.min(1, (1000 / 30) / dt) }); }
}
console.log(JSON.stringify({ N, errs }));
await b.close();
