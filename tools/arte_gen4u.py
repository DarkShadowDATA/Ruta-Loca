import base64, io, json, sys, os, urllib.request
from PIL import Image
D='/home/claude/ruta-loca/art_src/'
def b64(p):
    b=io.BytesIO(); Image.open(p).convert('RGB').resize((512,512)).save(b,'JPEG',quality=90); return base64.b64encode(b.getvalue()).decode()
STY=b64(D+'gen2/vocho_1.jpg')
P=("Redraw the vehicle from the reference image, keeping exactly its shape, silhouette, proportions, details and its straight top-down camera angle, "
   "but as a cartoon illustration with thin dark outline, bright saturated glossy colors with soft white highlights, "
   "soft dark green drop shadow toward the bottom right, plain flat green background. "
   "Vehicle lying horizontally pointing to the right, no logo, no text. The vehicle: ")
for name, shape, desc in json.load(open(sys.argv[1])):
    body={"prompt":P+desc,"refs":[b64(D+"gen4/"+shape)],"ancho":1024,"alto":1024}
    r=urllib.request.Request('https://generador-imagenes.salchineta.workers.dev/',data=json.dumps(body).encode(),headers={'x-key':os.environ['GEN_KEY'],'content-type':'application/json','User-Agent':'darkshadow-arte/1.0'})
    try:
        with urllib.request.urlopen(r,timeout=180) as res: open(D+f'gen4/u_{name}.jpg','wb').write(res.read()); print('ok',name)
    except urllib.error.HTTPError as e: print('ERR',name,e.code,e.read()[:200]); sys.exit(2)
