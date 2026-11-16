# Prepara una imagen del generador para Ruta Loca: quita el fondo verde (y su sombra), recorta, gira y deja el tamaño del juego.
# Uso: python3 tools/arte_rl.py entrada.jpg nombre --w 92 --l 180 [--rot 180] [--suelo]
#   nombre = clave de la textura (veh_combi, trafico_sedan_rojo…). --w/--l = tamaño del dibujo en el juego (ver VEHICLES/VEH en src/core.js).
#   --suelo: textura que se repite (no quita fondo; recorta a cuadro y deja 512×512).
import argparse, numpy as np
from PIL import Image, ImageFilter
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('name')
ap.add_argument('--w', type=int, default=0); ap.add_argument('--l', type=int, default=0)
ap.add_argument('--rot', type=int, default=0); ap.add_argument('--tol', type=float, default=60); ap.add_argument('--tono', type=float, default=0.08); ap.add_argument('--vertical', action='store_true'); ap.add_argument('--osc', type=float, default=0.12); ap.add_argument('--sombra', action='store_true'); ap.add_argument('--nivel', type=float, default=0.82); ap.add_argument('--sin-verde', dest='sin_verde', action='store_true'); ap.add_argument('--suelo', action='store_true'); ap.add_argument('--pad', type=int, default=10)
a = ap.parse_args()
im = Image.open(a.src).convert('RGB')
# si la imagen trae marco blanco, quitarlo
_a = np.asarray(im).astype(int); _nw = ~((_a > 235).all(-1)); _ys, _xs = np.where(_nw)
if (_a[0] > 235).all() or (_a[:, 0] > 235).all():
    im = im.crop((_xs.min() + 6, _ys.min() + 6, _xs.max() - 6, _ys.max() - 6))
if a.suelo:
    im.resize((512, 512), Image.LANCZOS).save(f'src/img/{a.name}.webp', quality=85); print('ok', a.name); raise SystemExit
px = np.asarray(im).astype(int); r, g, b = px[..., 0], px[..., 1], px[..., 2]
# Fondo = el color de la orilla (y su sombra, el mismo tono más oscuro), solo lo que toca la orilla.
# Así sirve aunque el vehículo también sea verde: se compara contra el verde exacto del fondo, no contra «cualquier verde».
border = np.concatenate([px[0], px[-1], px[:, 0], px[:, -1]])
bgc = np.median(border, axis=0)
dist = np.sqrt(((px - bgc) ** 2).sum(-1))
bn = bgc / max(1, bgc.sum()); pn = px / np.maximum(1, px.sum(-1, keepdims=True))
same_hue = np.sqrt(((pn - bn) ** 2).sum(-1)) < a.tono          # mismo tono (sombra = más oscuro)
darker = px.sum(-1) <= bgc.sum() * 1.08
green = (dist < a.tol) | (same_hue & darker & (px.sum(-1) > bgc.sum() * a.osc))
gdom = (g > r + 18) & (g > b + 18)
if a.sin_verde: green |= (g > r + 35) & (g > b + 35)                 # todo verde fuerte (solo vehículos que NO son verdes)
# solo cuenta como fondo el verde que toca la orilla (el turquesa o verde de adentro del vehículo se queda)
from scipy import ndimage
lab, n = ndimage.label(green)
edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge_labels))
if a.sombra:
    # 2.º paso: la sombra verde oscura que toca el fondo (sin volver a abrir el paso hacia el techo del vehículo)
    dark = gdom & (px.sum(-1) < bgc.sum() * a.nivel)
    lab2, _ = ndimage.label(bg | dark)
    keep = set(np.unique(lab2[bg])) - {0}
    bg = bg | (dark & np.isin(lab2, list(keep)))
alpha = np.where(bg, 0, 255).astype(np.uint8)
m = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
rgba = im.convert('RGBA'); rgba.putalpha(m)
# quitar el halo verde de la orilla
arr = np.asarray(rgba).copy(); edge = (arr[..., 3] > 0) & (arr[..., 3] < 255)
arr[..., 1] = np.where(edge, np.minimum(arr[..., 1], np.maximum(arr[..., 0], arr[..., 2])), arr[..., 1])
rgba = Image.fromarray(arr)
bbox = rgba.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
rgba = rgba.crop(bbox)
if a.vertical and rgba.width > rgba.height: rgba = rgba.rotate(90, expand=True)
if a.rot: rgba = rgba.rotate(a.rot, expand=True)
if a.w and a.l: rgba = rgba.resize((a.w, a.l), Image.LANCZOS)
out = Image.new('RGBA', (rgba.width + 2 * a.pad, rgba.height + 2 * a.pad), (0, 0, 0, 0)); out.paste(rgba, (a.pad, a.pad))
out.save(f'src/img/{a.name}.webp', quality=90); out.save(f'art_src/{a.name}.png')
print('ok', a.name, out.size)
