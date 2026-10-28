"""Read-only playback-route verification; credentials are supplied on stdin."""
import json
import sys
import urllib.request
import urllib.parse
import urllib.error

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirect())
credentials = json.load(sys.stdin)
body = urllib.parse.urlencode(credentials).encode()
try:
    response = opener.open(urllib.request.Request('http://127.0.0.1:8085/user/login', data=body,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}), timeout=15)
except urllib.error.HTTPError as error:
    response = error
assert response.code == 302
cookie = response.headers['Set-Cookie'].split(';')[0]
results = []
for mode in ['disc', 'lyrics', 'folia-classic', 'folia']:
    response = opener.open(urllib.request.Request('http://127.0.0.1:8085/player/606?playlistId=24&mode='+mode,
        headers={'Cookie': cookie}), timeout=15)
    html = response.read().decode('utf-8')
    assert response.code == 200
    assert 'local-playback-page' in html and 'data-song-id="606"' in html
    assert 'data-playlist-id="24"' in html and 'data-stage-mode="'+mode+'"' in html
    assert 'href="/playlists/24"' in html
    results.append({'mode': mode, 'status': response.code, 'importRedirect': False})
response = opener.open(urllib.request.Request('http://127.0.0.1:8085/local-player', headers={'Cookie': cookie}), timeout=15)
html = response.read().decode('utf-8')
assert 'local-playback-page' not in html and 'local-import-guide' in html
print(json.dumps({'routes': results, 'importPageIntact': True}))
