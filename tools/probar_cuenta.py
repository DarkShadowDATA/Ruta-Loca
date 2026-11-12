# Prueba de punta a punta con el servidor del estudio en local (PORT=3077 DEV_AUTH=1 DATABASE_URL=pglite: npx tsx src/node.ts)
import asyncio, json
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:4179/?dev&devapi=http://127.0.0.1:3077'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':390,'height':844}, has_touch=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE); await pg.wait_for_timeout(2500)
        print('nube', await pg.evaluate("(async()=>{const m=await import('/src/tienda.js').catch(()=>null); return null})()"))
        await pg.screenshot(path='shots/k_menu.png')
        await pg.click('#b-tienda'); await pg.wait_for_timeout(800); await pg.screenshot(path='shots/k_tienda.png')
        await pg.click('[data-buy="pint_flamas"]'); await pg.wait_for_timeout(600)
        print('toast', await pg.inner_text('#toast'))
        await pg.goto(BASE); await pg.wait_for_timeout(2000)
        await pg.click('#b-pozo'); await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/k_pozo.png')
        await pg.click('#p-go'); await pg.wait_for_timeout(800)
        # jugar con el piloto hasta chocar (en el núcleo, sin esperar en tiempo real)
        await pg.evaluate("(()=>{const s=__rl; s.g.god=false; window.__rlTo(g=>!g.alive, 60*90);})()")
        await pg.wait_for_timeout(300)
        st = await pg.evaluate("({mode:__rl.mode, alive:__rl.g.alive, m:Math.floor(__rl.g.dist/40), inputs:__rl.g.inputs.length})"); print(st)
        await pg.wait_for_timeout(2500); await pg.screenshot(path='shots/k_fin.png')
        print('news', await pg.inner_text('#o-news'))
        print('errores', errs[:3]); await b.close()
asyncio.run(main())
