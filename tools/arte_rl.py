# Prepara una imagen del generador para Ruta Loca: quita el fondo verde (y su sombra), recorta, gira y deja el tamaño del juego.
# Uso: python3 tools/arte_rl.py entrada.jpg nombre --w 92 --l 180 [--rot 180] [--suelo]
#   nombre = clave de la textura (veh_combi, trafico_sedan_rojo…). --w/--l = tamaño del dibujo en el juego (ver VEHICLES/VEH en src/core.js).
#   --suelo: textura que se repite (no quita fondo; recorta a cuadro y deja 512×512).
import argparse, numpy as np
from PIL import Image, ImageFilter
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('name')
ap.add_argument('--w', type=int, default=0); ap.add_argument('--l', type=int, default=0)
ap.add_argument('--rot', type=int, default=0); ap.add_argument('--suelo', action='store_true'); ap.add_argument('--pad', type=int, default=10)
a = ap.parse_args()
im = Image.open(a.src).convert('RGB')
if a.suelo:
    im.resize((512, 512), Image.LANCZOS).save(f'src/img/{a.name}.webp', quality=85); print('ok', a.name); raise SystemExit
px = np.asarray(im).astype(int); r, g, b = px[..., 0], px[..., 1], px[..., 2]
green = (g > r + 25) & (g > b + 25)                   # verde (fondo y su sombra)
# solo cuenta como fondo el verde que toca la orilla (el turquesa o verde de adentro del vehículo se queda)
from scipy import ndimage
lab, n = ndimage.label(green)
edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge_labels))
alpha = np.where(bg, 0, 255).astype(np.uint8)
m = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
rgba = im.convert('RGBA'); rgba.putalpha(m)
# quitar el halo verde de la orilla
arr = np.asarray(rgba).copy(); edge = (arr[..., 3] > 0) & (arr[..., 3] < 255)
arr[..., 1] = np.where(edge, np.minimum(arr[..., 1], np.maximum(arr[..., 0], arr[..., 2])), arr[..., 1])
rgba = Image.fromarray(arr)
bbox = rgba.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
rgba = rgba.crop(bbox)
if a.rot: rgba = rgba.rotate(a.rot, expand=True)
if a.w and a.l: rgba = rgba.resize((a.w, a.l), Image.LANCZOS)
out = Image.new('RGBA', (rgba.width + 2 * a.pad, rgba.height + 2 * a.pad), (0, 0, 0, 0)); out.paste(rgba, (a.pad, a.pad))
out.save(f'src/img/{a.name}.webp', quality=90); out.save(f'art_src/{a.name}.png')
print('ok', a.name, out.size)
