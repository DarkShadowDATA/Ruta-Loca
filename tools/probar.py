import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':390,'height':780}, device_scale_factor=1, has_touch=True)
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        base='http://127.0.0.1:4179/'
        await pg.goto(base+'?dev'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='shots/1_menu.png')
        await pg.goto(base+'?go&dev&seed=5'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/2_mano.png')
        await pg.goto(base+'?go&dev&auto&seed=5&t=25'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='shots/3_trafico.png')
        # sin tocar: choca solo
        await pg.goto(base+'?go&dev&seed=5&speed=3'); await pg.wait_for_timeout(2600)
        st = await pg.evaluate('({mode:__rl.mode, m:__rl.g.dist/40, alive:__rl.g.alive})'); print(st)
        await pg.wait_for_timeout(200); await pg.screenshot(path='shots/4_choque.png')
        await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/5_fin.png')
        # otra vez en un toque
        await pg.touchscreen.tap(195,400); await pg.wait_for_timeout(300)
        print('tras tocar:', await pg.evaluate('__rl.mode'))
        # deslizar y tocar
        await pg.goto(base+'?go&dev&seed=5&god'); await pg.wait_for_timeout(600)
        await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(300)
        l1 = await pg.evaluate('__rl.g.lane')
        await pg.touchscreen.tap(60,600); await pg.wait_for_timeout(300)
        l2 = await pg.evaluate('__rl.g.lane')
        await pg.mouse.move(200,600); await pg.mouse.down(); await pg.mouse.move(260,600,steps=4); await pg.mouse.up(); await pg.wait_for_timeout(300)
        l3 = await pg.evaluate('__rl.g.lane')
        print('carriles: tecla',l1,'toque izq',l2,'deslizar der',l3, 'toques', await pg.evaluate('JSON.stringify(__rl.g.inputs)'))
        # escritorio
        pd = await b.new_page(viewport={'width':1280,'height':720})
        await pd.goto(base+'?go&auto&seed=9&t=40'); await pd.wait_for_timeout(1200); await pd.screenshot(path='shots/6_compu.png')
        print('errores:', errs)
        await b.close()
asyncio.run(main())
