# Ruta Loca (4.º juego de DarkShadow Studios) — fase 0, prototipo

Arcade vertical de un dedo: manejas una combi por 4 carriles y esquivas el tráfico.

- `src/core.js` — TODA la lógica (sin Phaser): paso fijo 1/60 s y azar con semilla. Misma semilla + mismos toques = misma partida (`replay`).
- `src/main.js` — solo dibuja (Phaser 3). El dibujo de código es relleno de la fase 0.
- `npm test` — pruebas del núcleo. `npm run build` — deja todo en `dist/index.html` (se sube ya compilado).
- Pruebas: `?go` entra directo · `&auto` maneja solo · `&god` no choca · `&seed=N` · `&t=seg` · `&speed=4` · `?dev` deja el juego en `window.__rl`.
- Plan completo: doc del proyecto `claude/ruta-loca-plan.md`.
