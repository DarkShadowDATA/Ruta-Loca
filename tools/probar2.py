import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':390,'height':844}, has_touch=True)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        base='http://127.0.0.1:4179/'
        await pg.goto(base+'?go&dev&seed=5&speed=6')
        for i in range(40):
            await pg.wait_for_timeout(400)
            if await pg.evaluate('__rl.mode')=='dead': break
        await pg.wait_for_timeout(150); await pg.screenshot(path='shots/4_choque.png')
        await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/5_fin.png')
        print(await pg.evaluate('({m:Math.floor(__rl.g.dist/40), best:__rl.save.best, fps:Math.round(__rl.game.loop.actualFps)})'))
        await pg.touchscreen.tap(195,400); await pg.wait_for_timeout(300)
        print('tras tocar:', await pg.evaluate('__rl.mode'))
        await pg.goto(base+'?go&dev&god&seed=5'); await pg.wait_for_timeout(500)
        await pg.mouse.move(200,600); await pg.mouse.down(); await pg.mouse.move(240,600,steps=4); await pg.mouse.up(); await pg.wait_for_timeout(200)
        print('deslizar 40px:', await pg.evaluate('__rl.g.lane'))
        await pg.goto(base+'?go&dev&auto&seed=5&t=70'); await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/7_rapido.png')
        print('errores', errs); await b.close()
asyncio.run(main())
