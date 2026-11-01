"""Verify the live 8091 atlas audit against local pixels and runtime WebP files."""
import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / 'src/main/resources/static'
audit = json.loads((ROOT / 'tools/8091-vfx-audit.json').read_text('utf-8'))
issues = []
pixels = {}
for row in audit['rows']:
    name = row['sheet']
    if not name:
        issues.append({'id':row['id'], 'error':'missing mapping'})
        continue
    source = STATIC / 'images/vfx' / name
    with Image.open(source) as raw:
        image = raw.convert('RGBA')
    width, height = image.size
    fingerprint = hashlib.sha256(image.tobytes()).hexdigest()
    if fingerprint in pixels:
        issues.append({'id':row['id'], 'duplicateOf':pixels[fingerprint]})
    pixels[fingerprint] = row['id']
    frames = [hashlib.sha256(image.crop((round(x*width/4),round(y*height/4),round((x+1)*width/4),round((y+1)*height/4))).tobytes()).hexdigest() for y in range(4) for x in range(4)]
    if len(set(frames)) != 16:
        issues.append({'id':row['id'], 'distinctFrames':len(set(frames))})
    if name.startswith('independent-') and (image.size != (1536,1536) or image.getextrema()[3][0] != 0):
        issues.append({'id':row['id'], 'error':'invalid new atlas size or transparency'})
    if hashlib.sha256(source.read_bytes()).hexdigest() != audit['assets'][name]['sha']:
        issues.append({'id':row['id'], 'error':'live PNG differs from disk'})

def verify_webp(row):
    name = row['sheet'].replace('.png','.webp')
    local = STATIC / 'images/vfx-mobile' / name
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open('http://127.0.0.1:8091/images/vfx-mobile/'+name+'?v=independent-atlases-1',timeout=15) as response:
            body = response.read()
        if body != local.read_bytes():
            return {'id':row['id'], 'error':'runtime WebP differs from disk'}
        with Image.open(local) as image:
            if image.format != 'WEBP':
                return {'id':row['id'], 'error':'runtime asset is not WebP'}
    except Exception as error:
        return {'id':row['id'], 'error':str(error)}
    return None

with ThreadPoolExecutor(max_workers=6) as pool:
    runtime_issues = [issue for issue in pool.map(verify_webp,audit['rows']) if issue]
issues.extend(runtime_issues)
result = {'cards':audit['total'], 'uniquePixelSheets':len(pixels), 'runtimeWebpChecked':len(audit['rows']), 'newAtlases':json.loads((ROOT/'tools/independent-atlas-progress.json').read_text('utf-8'))['installed'], 'issues':issues}
(ROOT/'tools/independent-atlas-final-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps(result,ensure_ascii=False))
raise SystemExit(bool(issues))
