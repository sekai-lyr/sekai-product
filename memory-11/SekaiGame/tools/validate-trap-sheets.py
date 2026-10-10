from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import json, subprocess
root=Path('src/main/resources/static/images/vfx')
data=json.loads(subprocess.check_output(['node','tools/audit-trap-vfx.mjs'],text=True, encoding='utf-8'))
rows=[]
for item in data['rows']:
 p=root/item['sheet']
 if not p.exists(): rows.append({**item,'exists':False}); continue
 with Image.open(p) as im:
  w,h=im.size
  # 4x4 cell fingerprints; tolerate non-divisible sheet edges
  hashes=[]
  for y in range(4):
   for x in range(4):
    box=(round(x*w/4),round(y*h/4),round((x+1)*w/4),round((y+1)*h/4))
    cell=im.crop(box).convert('RGB').resize((32,32))
    hashes.append(hash(cell.tobytes()))
  rows.append({**item,'exists':True,'size':[w,h],'bytes':p.stat().st_size,'uniqueFrames':len(set(hashes)),'modified':p.stat().st_mtime})
print(json.dumps({'files':len(rows),'missing':[x for x in rows if not x['exists']],'not16':[x for x in rows if x.get('uniqueFrames')!=16],'sizes':sorted(set(tuple(x['size']) for x in rows if x['exists'])),'totalMB':round(sum(x.get('bytes',0) for x in rows)/1048576,1)},ensure_ascii=False,indent=2))

