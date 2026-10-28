"""Private loopback smoke check. Credentials arrive via stdin and are never logged."""
import json
import sys
import urllib.request
import urllib.error
import urllib.parse
from http.cookies import SimpleCookie

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirect())
cookie = ""
checks = []

def request(path, method="GET", payload=None, authenticated=False, form=False):
    headers = {"Host": "sekaisong.com", "X-Forwarded-Proto": "https"}
    if authenticated:
        headers["Cookie"] = cookie
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
        body = urllib.parse.urlencode(payload).encode() if form else json.dumps(payload).encode()
    req = urllib.request.Request("http://127.0.0.1:8085" + path, data=body, headers=headers, method=method)
    try:
        response = opener.open(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    return response.code, response.headers, response.read()

def check(path, expected=200, **kwargs):
    code, headers, body = request(path, **kwargs)
    if code != expected:
        raise RuntimeError(f"{path}: expected {expected}, got {code}")
    checks.append({"path": path, "status": code})
    return headers, body

credentials = json.load(sys.stdin)
check("/login")
check("/register")
check("/api/admin/overview", 401)
check("/api/admin/feedback/export", 401)
check("/api/feedback", 401, method="POST", payload={"content": "内部验收不会发表这条评论"})
code, headers, body = request("/user/login", "POST", {"userName": "sekai", "password": credentials["password"]}, form=True)
if code != 302 or "/home" not in headers.get("Location", ""):
    raise RuntimeError("Application login failed")
for raw in headers.get_all("Set-Cookie", []):
    parsed = SimpleCookie(raw)
    if "JSESSIONID_M5" in parsed:
        token = parsed["JSESSIONID_M5"]
        if not token["secure"] or not token["httponly"]:
            raise RuntimeError("Session cookie flags: secure=" + str(bool(token["secure"])) + ", httponly=" + str(bool(token["httponly"])))
        cookie = "JSESSIONID_M5=" + token.value
if not cookie:
    raise RuntimeError("Login cookie missing")
for path in ["/", "/home", "/songs", "/playlists", "/local-player", "/feedback", "/admin/overview"]:
    _, content = check(path, authenticated=True)
    if path == "/feedback" and "听友广场" not in content.decode("utf-8"):
        raise RuntimeError("Wrong feedback version")
    if path == "/local-player" and b"local-import-confirm" not in content:
        raise RuntimeError("Old local import layout")
for mode in ["disc", "lyrics", "folia-classic", "folia"]:
    check("/local-stage?mode=" + mode, authenticated=True)
for path in ["/js/community-comments.js", "/js/listening-stats.js", "/js/local-player.js", "/css/website-feedback.css", "/js/vendor/folia-sekai-source.zip"]:
    check(path)
_, data = check("/api/local-player/library", 404, authenticated=True)
_, data = check("/local-player/library", authenticated=True)
library = json.loads(data)
if len(library["songs"]) != 641 or library["user"]["id"] != 3:
    raise RuntimeError("Existing account song library changed")
_, data = check("/api/admin/overview", authenticated=True)
overview = json.loads(data)["data"]
if overview["registeredUsers"] != 5:
    raise RuntimeError("Existing accounts changed")
check("/api/feedback?sort=hot", authenticated=True)
check("/api/feedback", 403, method="POST", payload={"content": "内部验收不会发表这条评论"}, authenticated=True)
check("/api/admin/feedback/999999999", 403, method="POST", payload={"status": "approved"}, authenticated=True)
check("/api/listening/start", 403, method="POST", payload={"songId": 36, "stage": "disc"}, authenticated=True)
print(json.dumps({"checks": checks, "login": True, "secureCookie": True, "accountSongs": len(library["songs"]), "registeredUsers": overview["registeredUsers"], "commentCount": overview["comments"], "testCommentWritten": False}, ensure_ascii=False))
