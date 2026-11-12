# Revisión visual con Playwright: python3 tools/probar.py  (con `npx vite preview --port 4179` corriendo)
import asyncio
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:4179/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':390,'height':844}, has_touch=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        async def shot(url, name, wait=1500, js=None):
            await pg.goto(BASE+url); await pg.wait_for_timeout(wait)
            if js: await pg.evaluate(js); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'shots/{name}.png')
        await shot('?dev', 'a_menu')
        await shot('?dev&menu=garaje', 'b_garaje', js="(()=>{__rl.save.coins=2000;__rl.showGarage('vocho')})()")
        # buscar momentos: parada, tianguis, perro, lluvia, tráiler
        found={}
        await pg.goto(BASE+'?go&dev&auto&god&seed=3&speed=1'); await pg.wait_for_timeout(500)
        await pg.evaluate("__rl.slowKeep=1")
        for i in range(400):
            st = await pg.evaluate("""(()=>{const g=__rl.g;const f=g.feats.find(f=>!f.done&&f.s-g.dist<500&&f.s-g.dist>-((f.len||0)));return {t:g.t, f:f?f.type:null, boss:g.boss?g.boss.phase:null, rain:g.rain>0, dog:!!g.dog, pax:g.pax}})()""")
            key = st['boss'] and 'boss' or (st['dog'] and 'perro') or (st['rain'] and 'lluvia') or st['f']
            if key and key not in found:
                await pg.wait_for_timeout(250 if key!='boss' else 2600)
                await pg.screenshot(path=f'shots/c_{key}.png'); found[key]=round(st['t'])
            if len(found)>=7: break
            await pg.evaluate("(()=>{const g=__rl.g; for(let i=0;i<20;i++){ if(g.feats.some(f=>!f.done&&f.s-g.dist<700&&f.s-g.dist>-((f.len||0)))||g.boss||g.dog) break; __rl.constructor; window.__rlstep&&0; }})()")
            await pg.wait_for_timeout(120)
            # adelantar rápido cuando no pasa nada
            await pg.evaluate("""(()=>{const s=__rl,g=s.g; const busy=g.feats.some(f=>!f.done&&f.s-g.dist<1600&&f.s-g.dist>-((f.len||0)-0))||g.boss||g.dog||g.rain>0; if(!busy){ for(let i=0;i<30&&g.alive;i++){ const m=window.__core; } } })()""")
        print('encontrado', found)
        # choque y pantalla final
        await pg.goto(BASE+'?go&dev&seed=5&speed=6')
        for i in range(60):
            await pg.wait_for_timeout(300)
            if await pg.evaluate('__rl.mode')=='dead': break
        await pg.wait_for_timeout(1300); await pg.screenshot(path='shots/d_fin.png')
        print('errores', errs[:5]); await b.close()
asyncio.run(main())
