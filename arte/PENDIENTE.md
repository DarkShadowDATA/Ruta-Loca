# Ruta Loca — imágenes que faltan

Cada imagen reemplaza la textura con el mismo nombre (archivo `src/img/<nombre>.webp`); el juego usa el dibujo de código mientras no exista.
Se hacen con el generador de Cloudflare (estilo y prompts en `arte/ESTILO.md`; prioridad de cupo: Tierras del Umbral primero).
Preparar con `python3 tools/arte_rl.py <jpg> <nombre> --w <ancho> --l <largo> [--rot 180]` (tamaño = dibujo; la herramienta agrega 10 px de margen).
Prompts largos de referencia: doc del proyecto `claude/ruta-loca-arte-completo.md`.

## Hechas
- [x] `veh_combi` 92×180 · `trafico_sedan_rojo` 88×168 · `trafico_ny_taxi` 90×176

## 1. Garaje (elige Alejandro entre opciones)
| Archivo | Tamaño (w×l) | Qué es |
|---|---|---|
| `veh_vocho` | 78×148 | vocho redondo azul cielo |
| `veh_micro` | 100×240 | microbús verde y blanco de CDMX |
| `veh_taxi` | 88×168 | taxi rosa y blanco de CDMX |
| `veh_guajolotero` | 104×250 | camión rural amarillo y azul con carga en el techo y una gallina |
| `veh_moto` | 46×112 | moto de reparto con caja roja y casco amarillo |

## 2. Tráfico Ruta 1
| `trafico_sedan_azul` | 88×168 | hatchback azul |
| `trafico_taxi` | 88×168 | taxi amarillo (tráfico) |
| `trafico_camioneta` | 98×200 | pickup verde con cajas de naranjas |
| `trafico_camion` | 108×260 | camión de reparto, cabina roja y caja gris |
| `trafico_moto` | 46×112 | moto con repartidor, caja roja |

## 3. Tráfico de las otras rutas
| `trafico_tk_kei` 76×140 · `trafico_tk_taxi` 86×172 · `trafico_tk_camion` 100×230 · `trafico_tk_moto` 44×108 | Tokio |
| `trafico_ny_suv` 98×196 · `trafico_ny_bus` 108×260 | Nueva York |
| `trafico_bo_rickshaw` 70×118 · `trafico_bo_bus` 106×250 · `trafico_bo_camion` 104×236 · `trafico_bo_moto` 44×108 | Bombay |

## 4. Pinturas de la Combi (mismo dibujo que `veh_combi`, otra pintura) 92×180
`veh_combi_flamas`, `veh_combi_lowrider`, `veh_combi_taxi_rosa`, `veh_combi_lucha`, `veh_combi_neon`, `veh_combi_talavera`, `veh_combi_dorada`, `veh_combi_cromo`, `veh_combi_calavera`, `veh_combi_pozo`.
Ojo: con el generador es difícil que salga la MISMA combi; probar pidiendo la misma descripción con otros colores, o pintar encima de `art_src/veh_combi.png` con código (recolor).

## 5. Eventos, jefe y calle (falta conectar en el código: hoy se dibujan con código sin nombre de textura)
| `evento_tianguis` / `evento_obras` / `evento_mercado` | 150×150, se repiten | puesto con lona / vallas y conos / puesto indio |
| `evento_perro` 54×40 · `evento_vaca` 120×64 · `evento_bache` 60×44 | | |
| `evento_tren` 300×120 (un vagón; se repite 5 veces) · `jefe_trailer` 436×620 | | |
| `parada_techo` 52×~180 · `base_terminal` 70×~580 · `pasajero_1..4` 26×26 | | |
| `ruta1..4_asfalto`, `ruta1..4_banqueta` 512×512 que se repitan · adornos `ruta1_arbol`, `ruta2_cerezo`, `ruta2_neon`, `ruta3_hidrante`, `ruta3_farol`, `ruta4_palma` 60×60 | | |

## 6. Interfaz
`icono_moneda` 64×64 · `tarjeta_ruta1..4` 330×110 · `menu_fondo` 720×1280 · **sin logo hasta que haya nombre**.
