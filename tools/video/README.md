# Videos de Noche de Leyendas (formato «gancho en el segundo 0»)

Se graba el juego cuadro por cuadro con reloj controlado y se arma con `tools/video/gancho.py` del repo de **Mutantes** (mismo formato, música y cierre).

## Receta
```bash
npm run build && (cd dist && python3 -m http.server 4100 &)     # juego local
node tools/video/grabar.mjs tools/video/ejemplos/llorona.json  # toma → carpeta de cuadros 00000.jpg…
python3 ../mutantes-wasteland/tools/video/gancho.py guion.json --muestra   # hoja para revisar
python3 ../mutantes-wasteland/tools/video/gancho.py guion.json             # .mp4 final + portada
```
`grabar.mjs` necesita playwright (el del repo de Mutantes o el de la máquina).

## Trucos
- Pantalla 1080×1920 con `dpr: 1`, y `"style": "#hud,#banner,#levelup,#hint{zoom:3}"` para que la interfaz tenga tamaño de celular; la cámara se acerca con `window.__ndl.cameras.main.setZoom(1.7)` en `pre`.
- `?go=<cazador>&auto&god&t=<segundos>`: entra directo a la partida, se mueve solo, no muere y empieza en ese minuto (con 14 mejoras automáticas). `&dev` hace que las flores cuenten.
- `warm`: segundos que avanza el juego (sin grabar) antes de la primera toma; así ya hay horda.
- Jefe a la vista: en `post` llama `s.spawnBoss('llorona')` (o `charro`, `cadejo`) y mueve `s.bossAlive.x/y` cerca de `s.P`. Oculta `#boss` (su barra sale enorme con el zoom).
- Pantallas de HTML (árbol de talentos, menú): graba a 360×640 con `dpr: 3` (si no, se ven en modo compu, 3 columnas).
- Fin de partida con premio: `s.kills = 982; s.bossKills = {cadejo:1, charro:1, llorona:1}; s.endRun(true)`.
- El video con horda pesa mucho: recomprime con `-crf 23 -maxrate 11M` para que quede < 30 MB.
