# Capturas por ruta y de las pantallas nuevas: python3 tools/probar_rutas.py
import asyncio
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:4179/'
WAIT_FOR = """(k)=>{const g=__rl.g; if(k==='tren') return !!g.train && g.train.s-g.dist<700; if(k==='vaca') return !!g.dog && g.dog.f.look==='vaca' && g.dog.s-g.dist<600; if(k==='fog') return g.fog>4;
 if(k==='cut') return g.vehicles.some(v=>v.cut&&v.cut.go&&!v.cut.done); if(k==='obras') return g.feats.some(f=>f.look==='obras'&&f.s-g.dist<500&&f.s-g.dist>-1500); return true;}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':390,'height':844}, has_touch=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE+'?dev'); await pg.wait_for_timeout(1200); await pg.screenshot(path='shots/r_menu.png')
        await pg.evaluate("(()=>{const s=__rl.save; s.runs=40; s.totalPax=320; s.totalNears=60; s.maxCombo=3; s.bossWins=4; s.bestBy={1:2800,2:900}; s.bestM=2800; __rl.showLogros()})()")
        await pg.wait_for_timeout(300); await pg.screenshot(path='shots/r_logros.png')
        await pg.evaluate("__rl.showStats()"); await pg.wait_for_timeout(300); await pg.screenshot(path='shots/r_stats.png')
        for ruta, k in [(2,'tren'),(3,'cut'),(3,'fog'),(4,'vaca'),(2,'obras')]:
            await pg.goto(BASE+f'?go&dev&auto&god&seed=4&ruta={ruta}&speed=3'); await pg.wait_for_timeout(400)
            ok=False
            for i in range(200):
                if await pg.evaluate(WAIT_FOR, k): ok=True; break
                await pg.wait_for_timeout(150)
            await pg.evaluate("window.__slow=1"); 
            await pg.screenshot(path=f'shots/r{ruta}_{k}.png'); print(ruta,k,ok)
        print('errores', errs[:3]); await b.close()
asyncio.run(main())
