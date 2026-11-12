# Adelanta hasta cada evento y toma captura: python3 tools/probar_eventos.py
import asyncio
from playwright.async_api import async_playwright
BASE='http://127.0.0.1:4179/'
CASES=[(4,'mercado2',"g=>g.feats.some(f=>f.type==='tianguis'&&f.look==='mercado'&&f.s-g.dist<200&&f.s-g.dist>-800)"),(2,'tren',"g=>!!g.train && g.train.s-g.dist<520"),(3,'fog',"g=>g.fog>5.5"),(2,'obras',"g=>g.feats.some(f=>f.look==='obras'&&f.s-g.dist<300&&f.s-g.dist>-1500)"),
       (4,'mercado',"g=>g.feats.some(f=>f.look==='mercado'&&f.s-g.dist<300&&f.s-g.dist>-1500)"),(1,'trailer',"g=>!!g.boss&&g.boss.phase==='hold'"),(1,'parada',"g=>g.feats.some(f=>f.type==='terminal'&&f.s-g.dist<700&&f.s-g.dist>200)")]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':390,'height':844}, has_touch=True)
        for ruta,k,cond in CASES:
            ok=False
            for seed in range(1,6):
                await pg.goto(BASE+f'?go&dev&god&seed={seed}&ruta={ruta}&speed=0.1'); await pg.wait_for_timeout(400)
                ok = await pg.evaluate(f"__rlTo({cond})")
                if ok: break
            await pg.wait_for_timeout(500); await pg.screenshot(path=f'shots/e_{k}.png'); print(k, ok)
        await b.close()
asyncio.run(main())
