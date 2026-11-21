import base64, io, json, sys, urllib.request
from PIL import Image
REF='/home/claude/ruta-loca/art_src/gen2/vocho_1.jpg'
b=io.BytesIO(); Image.open(REF).convert('RGB').resize((512,512)).save(b,'JPEG',quality=90)
ref=base64.b64encode(b.getvalue()).decode()
b2=io.BytesIO(); Image.open('/home/claude/ruta-loca/art_src/gen/combi_6.jpg').convert('RGB').rotate(-90 if 'ROT' else 0).resize((512,512)).save(b2,'JPEG',quality=90)
ref2=base64.b64encode(b2.getvalue()).decode()
BASE=("Same exact art style, outline thickness, color palette, lighting, camera angle, scale, drop shadow and plain flat green background as the first reference image (the light blue car). The second reference shows how a long vehicle looks from directly above. "
 "Use the reference ONLY for art style; draw a different vehicle. Exactly like the reference: a flat top-down orthographic bird's eye view from directly above, we see ONLY the roof and hood, the sides of the vehicle are NOT visible, no wheels visible, no side windows visible, no perspective. Vehicle lying horizontally pointing to the right, bright saturated colors like the reference, "
 "same soft dark green drop shadow toward the bottom right, hand-painted cartoon, thin dark outline, no logo, no emblem, no text, no signature. The vehicle: ")
def gen(name, desc):
    body=json.dumps({"prompt":BASE+desc,"refs":[ref,ref2],"ancho":1024,"alto":1024}).encode()
    r=urllib.request.Request('https://generador-imagenes.salchineta.workers.dev/',data=body,headers={
      'x-key':''+__import__('os').environ['GEN_KEY']+'','content-type':'application/json','User-Agent':'darkshadow-arte/1.0'})
    try:
        with urllib.request.urlopen(r,timeout=180) as res:
            open(f'/home/claude/ruta-loca/art_src/gen3/{name}.jpg','wb').write(res.read()); print('ok',name,res.headers.get('x-modelo'))
    except urllib.error.HTTPError as e:
        print('ERR',name,e.code,e.read()[:200]); sys.exit(2)
if __name__=='__main__':
    jobs=json.load(open(sys.argv[1]))
    for n,d in jobs: gen(n,d)
