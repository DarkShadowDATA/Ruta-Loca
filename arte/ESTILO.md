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

- 16 nov, opción 1 de cada uno (Alejandro: «usa todos los 1»), con el bloque base + estas descripciones (modelo schnell):
  - `veh_vocho` (rot 180): «a light sky-blue classic round beetle car, rounded hood and roof, chrome bumpers, small and compact»
  - `veh_micro` (`--tono 0.08 --sombra --nivel 0.6`): «a long Mexico City green and white microbus minibus, white front cap with big windshield, green roof with two roof vents, long vertical shape almost three times as long as wide»
  - `veh_taxi` (`--sin-verde`; la imagen traía marco blanco): «a Mexico City taxi sedan painted pink on the hood and trunk with a white roof and a small blank roof light»
  - `veh_guajolotero`: «an old Mexican rural bus with a yellow front and blue body, a roof rack overloaded with tied bundles, wooden crates, baskets and one white chicken, long vertical shape»
  - `veh_moto` (`--sin-verde`): «a delivery motorcycle with its rider seen from above, rider with a round yellow helmet and hands on the handlebars, big square red delivery box on the back, very narrow vertical shape»
  - `trafico_sedan_azul`: «a compact royal blue hatchback car with a short rear end, light blue windshield»
  - `trafico_taxi`: «a yellow and white Mexican city taxi sedan with a small blank roof light»
  - `trafico_camioneta`: «an old green pickup truck, short cab at the top, open cargo bed at the bottom loaded with wooden crates of oranges»
- Recorte (`tools/arte_rl.py`): todos con `--vertical`. Vehículos que NO son verdes: `--sin-verde` quita cualquier resto del fondo. Vehículos verdes: `--sombra --nivel 0.6` (quita solo la sombra oscura, sin comerse el techo).

## 20 nov — mismo modelo para todos (orden de Alejandro vía la mente maestra)
- Modelo: FLUX.2 klein (por defecto del generador) con **referencia = `art_src/gen2/vocho_1.jpg`** (vocho azul claro, vista desde arriba, sombra abajo a la derecha). Para vehículos largos (micro, guajolotero, camión) se manda también la combi (`art_src/gen/combi_6.jpg`) como 2.ª referencia de forma. Script: `GEN_KEY=… python3 tools/gen_ref_vocho.py lista.json` (lista de `[nombre, descripción]`; los vehículos salen horizontales apuntando a la derecha).
- Recorte: `tools/arte_rl.py … --vertical` (SIN `--rot`: así quedan con el frente hacia arriba) + `--sin-verde`; el micro con `--sombra --nivel 0.6`.
- Originales en `art_src/gen3/`, recortados listos en `art_src/gen3/listos/`, hoja para Alejandro `art_src/gen3/hoja_mismo_estilo.png`. Candidatos: micro_4, taxirosa_1, guajolotero_2, sedan_azul_2, taxi_2, camioneta_2, camion_2. La camioneta se pidió naranja (en verde se pierde con el fondo).
- La moto NO sale: con el vocho de referencia el modelo dibuja un coche con repartidor; con una moto de referencia sale torcida (mejor intento: moto_9).
