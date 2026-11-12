# Ruta Loca — estilo del arte

Vista **desde arriba, recta** (top-down, sin perspectiva). Caricatura pintada a mano estilo Kingdom Rush: formas gruesas, contorno café oscuro grueso, sombreado pintado con degradados suaves y brillos, luz desde arriba a la izquierda. Vehículos apuntando hacia arriba, centrados, ~85 % de la imagen. Fondo magenta liso (#FF00FF) para recortar; suelos sin costura.

Generador: FLUX.1 schnell (Workers AI de Alejandro), skill `generar-imagen`. Prompts aprobados abajo.

## Lo que aprendimos con FLUX (11 nov 2026)
- Con «Kingdom Rush / magenta» FLUX dibuja los coches de frente en 3/4 y pone logos (VW). No usar.
- Funciona pedir **«top-down 2D car sprite for a retro overhead racing game like GTA 2, orthographic bird's eye view…»** y **fondo verde** (el magenta sale rosa disparejo).
- La orientación sale al azar: `tools/arte_rl.py --rot 180` la endereza. El recorte solo quita el verde que toca la orilla (el turquesa de adentro se queda).
- Puede salir texto («TAXI») o firmas: revisar cada imagen.

## Bloque base (inglés)
```
top-down 2D car sprite for a retro overhead racing game like GTA 2, orthographic bird's eye view from directly above, only the roof is visible, vehicle pointing up toward the top of the image, long vertical shape twice as long as wide, hand-painted cartoon style, thick dark brown outline, painted shading, isolated on a plain flat solid pure green background, no logo, no emblem, no text, no signature
```

## Prompts aprobados
- `veh_combi` ← `art_src/gen/combi_6.jpg` (rot 180; Alejandro eligió esta, la opción 1; se tapó un emblema del frente que parecía de VW). Mismo prompt que la opción 2 (`combi_7.jpg`): bloque base + «a 1960s split-window minibus van used as Mexican public transport, cream white roof with a wide orange band across the front and a teal stripe, small roof rack with tied brown bundles in the middle»
- `trafico_sedan_rojo` ← `art_src/gen/sedan_2.jpg` (rot 180): bloque base (sin «long vertical shape») + «a red compact sedan, windshield at the top, rear window at the bottom»
- `trafico_ny_taxi` ← `art_src/gen/taxi_2.jpg`: bloque base + «a yellow new york taxi cab» (trae la palabra TAXI en el letrero; aceptable)
