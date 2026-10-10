# -*- coding: utf-8 -*-
"""
Batch renderer for the SEKAI ARCHIVE poster system.

Reads manifest.json (368 card prompts) and writes one 16:9 PNG per card into the
output folder. Resumable: cards whose PNG already exists are skipped, so an
interrupted run continues where it stopped.

Requires ONE of:
  --provider openai      OPENAI_API_KEY in the environment (gpt-image-2 by default)
  --provider compatible  any OpenAI-compatible image endpoint via --base-url
  --provider stability   STABILITY_API_KEY in the environment

Stdlib only - no pip install required.

Examples
--------
  # dry run: verify the plan without spending anything
  python generate_posters.py --dry-run

  # pilot: 6 cards across all three card types
  python generate_posters.py --only picture_ex_011 ygo_n_89631139 gallery_spell_043 \
      source_trap_028 nc_sp_ur_005 water_010 --workers 3 --quality high

  # full archive
  python generate_posters.py --workers 4 --quality high
"""
import argparse
import base64
import io
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, 'manifest.json')
DEFAULT_OUT = r'D:\Sekai\_Picture\AI-generated'

WIDE = '1536x1024'          # the 16:9 shape both OpenAI and the layout mandate want
PRINT = threading.Lock()


def log(msg):
    with PRINT:
        sys.stdout.write(msg + '\n')
        sys.stdout.flush()


def post_json(url, payload, headers, timeout=600):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def render_openai(prompt, args):
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not key:
        raise RuntimeError('OPENAI_API_KEY is not set')
    base = (args.base_url or 'https://api.openai.com/v1').rstrip('/')
    payload = {
        'model': args.model or 'gpt-image-2',
        'prompt': prompt,
        'size': args.size,
        'quality': args.quality,
        'n': 1,
    }
    if args.background and args.background != 'auto':
        payload['background'] = args.background
    if args.response_format:
        payload['response_format'] = args.response_format
    out = post_json(base + '/images/generations', payload,
                    {'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    b64 = out['data'][0].get('b64_json')
    if b64:
        return base64.b64decode(b64)
    url = out['data'][0].get('url')
    if url:
        with urllib.request.urlopen(url, timeout=300) as r:
            return r.read()
    raise RuntimeError('no image in response: ' + json.dumps(out)[:300])


def render_stability(prompt, args):
    key = os.environ.get('STABILITY_API_KEY', '').strip()
    if not key:
        raise RuntimeError('STABILITY_API_KEY is not set')
    boundary = '----sekaiarchive'
    body = io.BytesIO()

    def field(name, value):
        body.write(('--%s\r\n' % boundary).encode())
        body.write(('Content-Disposition: form-data; name="%s"\r\n\r\n' % name).encode())
        body.write((value + '\r\n').encode('utf-8'))

    field('prompt', prompt)
    field('output_format', 'png')
    field('aspect_ratio', '16:9')
    body.write(('--%s--\r\n' % boundary).encode())
    req = urllib.request.Request(
        'https://api.stability.ai/v2beta/stable-image/generate/sd3',
        data=body.getvalue(),
        headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'multipart/form-data; boundary=' + boundary,
                 'Accept': 'image/*'},
        method='POST')
    with urllib.request.urlopen(req, timeout=600) as resp:
        return resp.read()


def render(prompt, args):
    if args.provider in ('openai', 'compatible'):
        return render_openai(prompt, args)
    if args.provider == 'stability':
        return render_stability(prompt, args)
    raise RuntimeError('unknown provider ' + args.provider)


def one(rec, args, done_counter, total):
    dest = os.path.join(args.out, rec['id'] + '.png')
    if os.path.exists(dest) and not args.force:
        return rec['id'], 'skip', 0.0
    t0 = time.time()
    last = None
    for attempt in range(1, args.retries + 1):
        try:
            blob = render(rec['prompt'], args)
            os.makedirs(args.out, exist_ok=True)
            tmp = dest + '.part'
            with open(tmp, 'wb') as fh:
                fh.write(blob)
            os.replace(tmp, dest)
            with done_counter['lock']:
                done_counter['n'] += 1
                n = done_counter['n']
            log('[%3d/%3d] OK   %-22s %-24s %5.1fs' % (n, total, rec['id'], rec['name'][:24], time.time() - t0))
            return rec['id'], 'ok', time.time() - t0
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')[:300]
            last = 'HTTP %s %s' % (e.code, detail)
        except Exception as e:                                   # noqa: BLE001
            last = '%s: %s' % (type(e).__name__, e)
        if attempt < args.retries:
            time.sleep(args.backoff * attempt)
    log('[----/----] FAIL %-22s %s' % (rec['id'], last))
    return rec['id'], 'fail:' + str(last), time.time() - t0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--provider', default='openai', choices=['openai', 'compatible', 'stability'])
    ap.add_argument('--model', default=None, help='default: gpt-image-2 for openai')
    ap.add_argument('--base-url', default=None, help='OpenAI-compatible base URL, e.g. http://127.0.0.1:8188/v1')
    ap.add_argument('--size', default=WIDE)
    ap.add_argument('--quality', default='high', choices=['low', 'medium', 'high'])
    ap.add_argument('--background', default='auto')
    ap.add_argument('--response-format', default=None, help='set to b64_json for endpoints that require it')
    ap.add_argument('--workers', type=int, default=3)
    ap.add_argument('--retries', type=int, default=3)
    ap.add_argument('--backoff', type=float, default=4.0)
    ap.add_argument('--limit', type=int, default=0, help='stop after N new images')
    ap.add_argument('--only', nargs='*', default=None, help='restrict to these card ids')
    ap.add_argument('--type', dest='ctype', default=None, choices=['monster', 'spell', 'trap'])
    ap.add_argument('--rarity', default=None)
    ap.add_argument('--force', action='store_true', help='re-render even if the PNG exists')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    recs = json.load(io.open(MANIFEST, encoding='utf-8'))
    if args.only:
        want = set(args.only)
        recs = [r for r in recs if r['id'] in want]
    if args.ctype:
        recs = [r for r in recs if r['type'] == args.ctype]
    if args.rarity:
        recs = [r for r in recs if r['rarity'] == args.rarity]

    pending = [r for r in recs if args.force or not os.path.exists(os.path.join(args.out, r['id'] + '.png'))]
    if args.limit:
        pending = pending[:args.limit]

    log('manifest cards : %d' % len(recs))
    log('already done   : %d' % (len(recs) - len([r for r in recs if args.force or not os.path.exists(os.path.join(args.out, r['id'] + '.png'))])))
    log('to render      : %d' % len(pending))
    log('provider       : %s  model=%s  size=%s  quality=%s  workers=%d'
        % (args.provider, args.model or '(default)', args.size, args.quality, args.workers))
    log('output         : %s' % args.out)

    if args.dry_run:
        log('--- dry run, nothing rendered ---')
        for r in pending[:12]:
            log('  %-22s %-26s %s' % (r['id'], r['name'][:26], '; '.join(r['motifs'])[:80]))
        if len(pending) > 12:
            log('  ... and %d more' % (len(pending) - 12))
        return 0

    if not pending:
        log('nothing to do')
        return 0

    counter = {'n': 0, 'lock': threading.Lock()}
    results = []
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(one, r, args, counter, len(pending)) for r in pending]
        for f in as_completed(futs):
            results.append(f.result())

    ok = sum(1 for _, s, _ in results if s == 'ok')
    skipped = sum(1 for _, s, _ in results if s == 'skip')
    failed = [(i, s) for i, s, _ in results if s.startswith('fail')]
    log('=' * 68)
    log('rendered %d | skipped %d | failed %d | %.1f min'
        % (ok, skipped, len(failed), (time.time() - t0) / 60.0))
    for i, s in failed:
        log('  FAILED %s  %s' % (i, s[:140]))

    logfile = os.path.join(HERE, 'render-log.jsonl')
    with io.open(logfile, 'a', encoding='utf-8') as fh:
        for i, s, dt in results:
            fh.write(json.dumps({'id': i, 'status': s, 'seconds': round(dt, 1),
                                 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}, ensure_ascii=False) + '\n')
    log('log appended -> %s' % logfile)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
