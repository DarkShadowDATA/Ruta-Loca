import json, sys, os, urllib.request
STYLE=("top-down 2D vehicle sprite for a retro overhead racing game like GTA 2, clean cartoon illustration with thin dark outline, bright saturated glossy colors with soft white highlights, "
 "flat top-down orthographic bird's eye view from directly above like a map, only the roof, hood and top surfaces are visible, no perspective, no side view, "
 "vehicle lying horizontally with its front pointing to the right, centered, a soft dark green drop shadow offset toward the bottom right, "
 "isolated on a plain flat solid green background, no logo, no emblem, no text, no signature. The vehicle: ")
def gen(name, desc, extra):
    body={"prompt":STYLE+desc,"ancho":1024,"alto":1024}; body.update(extra)
    r=urllib.request.Request('https://generador-imagenes.salchineta.workers.dev/',data=json.dumps(body).encode(),headers={
      'x-key':os.environ['GEN_KEY'],'content-type':'application/json','User-Agent':'darkshadow-arte/1.0'})
    try:
        with urllib.request.urlopen(r,timeout=180) as res:
            open(f'/home/claude/ruta-loca/art_src/gen4/s_{name}.jpg','wb').write(res.read()); print('ok',name,res.headers.get('x-modelo'))
    except urllib.error.HTTPError as e:
        print('ERR',name,e.code,e.read()[:200]); sys.exit(2)
jobs=json.load(open(sys.argv[1])); extra=json.loads(sys.argv[2]) if len(sys.argv)>2 else {}
for n,d in jobs: gen(n,d,extra)
