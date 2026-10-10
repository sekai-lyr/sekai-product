# -*- coding: utf-8 -*-
"""Local FANCE preview server with the auth endpoints used by the static pages."""

import json
import re
import secrets
import threading
import urllib.error
import urllib.request
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import bcrypt
import pymysql


PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = PROJECT_ROOT / "src" / "main" / "resources" / "static"
PROPERTIES = PROJECT_ROOT / "src" / "main" / "resources" / "application.properties"
ROUTES = {
    "/login": "/login.html",
    "/register": "/register.html",
    "/chat": "/chat.html",
}
SESSIONS = {}
SESSIONS_LOCK = threading.Lock()
CONVERSATIONS = {}
CONVERSATIONS_LOCK = threading.Lock()


def read_property(name):
    text = PROPERTIES.read_text(encoding="utf-8")
    match = re.search(r"^" + re.escape(name) + r"=(.*)$", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def database_config():
    url = read_property("spring.datasource.url")
    match = re.search(r"jdbc:mysql://([^:/]+)(?::(\d+))?/([^?]+)", url)
    if not match:
        raise RuntimeError("Invalid MySQL URL in application.properties")
    return {
        "host": match.group(1),
        "port": int(match.group(2) or 3306),
        "database": match.group(3),
        "user": read_property("spring.datasource.username"),
        "password": read_property("spring.datasource.password"),
    }


def open_database():
    return pymysql.connect(**database_config(), autocommit=True, charset="utf8mb4")


def result(code, message, data=None):
    body = {"code": code, "message": message}
    if data is not None:
        body["data"] = data
    return body


def chat_with_model(message, system_prompt, conversation_id):
    if not message:
        raise ValueError("请输入消息")

    system = system_prompt or "你是 AnimeAI，一名友好的动漫助手。请用用户使用的语言简洁回答。"
    with CONVERSATIONS_LOCK:
        history = list(CONVERSATIONS.get(conversation_id, [])) if conversation_id else []
    messages = [{"role": "system", "content": system}]
    messages.extend(history[-8:])
    messages.append({"role": "user", "content": message})

    base_url = read_property("spring.ai.openai.base-url").rstrip("/")
    endpoint = base_url + ("/chat/completions" if base_url.endswith("/v1") else "/v1/chat/completions")
    request_body = json.dumps(
        {
            "model": read_property("spring.ai.openai.chat.options.model") or "deepseek-chat",
            "messages": messages,
            "temperature": 0.3,
            "stream": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=request_body,
        headers={
            "Authorization": "Bearer " + read_property("spring.ai.openai.api-key"),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError("AI 服务暂时不可用") from error

    choices = data.get("choices") or []
    content = choices[0].get("message", {}).get("content") if choices else None
    if not content:
        raise RuntimeError("AI 服务没有返回内容")

    if conversation_id:
        with CONVERSATIONS_LOCK:
            updated = CONVERSATIONS.setdefault(conversation_id, [])
            updated.extend([
                {"role": "user", "content": message},
                {"role": "assistant", "content": content},
            ])
            del updated[:-8]
    return content


class FanceHandler(SimpleHTTPRequestHandler):
    server_version = "FANCEPreview/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_ROOT), **kwargs)

    def send_json(self, payload, status=HTTPStatus.OK, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        for name, value in (extra_headers or []):
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/auth/me":
            user_name = self.current_user()
            if user_name:
                self.send_json(result(200, "成功", {"userName": user_name}))
            else:
                self.send_json(result(500, "未登录"))
            return
        if path == "/api/reminders/pending":
            self.send_json({"messages": []})
            return
        self.path = ROUTES.get(path, self.path)
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/auth/logout":
            token = self.cookies().get("fance_session")
            if token:
                with SESSIONS_LOCK:
                    SESSIONS.pop(token, None)
            self.send_json(result(200, "退出成功"))
            return

        if path in ("/api/ai/chat", "/api/ai/chat-with-tools"):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length) or b"{}")
                content = chat_with_model(
                    str(payload.get("message", "")).strip(),
                    payload.get("systemPrompt"),
                    str(payload.get("conversationId", "")).strip(),
                )
                self.send_json({"success": True, "content": content})
            except Exception:
                self.send_json({"success": False, "error": "AI 服务暂时不可用"})
            return

        if path not in ("/api/auth/login", "/api/auth/register"):
            self.send_json(result(404, "接口不存在"), HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            user_name = str(payload.get("userName", "")).strip()
            password = str(payload.get("password", ""))
            if not user_name or not password:
                self.send_json(result(500, "请输入用户名和密码"))
                return

            if path.endswith("/register"):
                response = self.register_user(user_name, password, payload.get("email"))
                self.send_json(response)
                return

            response = self.login_user(user_name, password)
            if response["code"] != 200:
                self.send_json(response)
                return

            token = secrets.token_urlsafe(24)
            with SESSIONS_LOCK:
                SESSIONS[token] = user_name
            self.send_json(
                response,
                extra_headers=[("Set-Cookie", f"fance_session={token}; Path=/; HttpOnly; SameSite=Lax")],
            )
        except Exception:
            self.send_json(result(500, "登录服务暂时不可用"), HTTPStatus.INTERNAL_SERVER_ERROR)

    def cookies(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))
        return {key: morsel.value for key, morsel in cookie.items()}

    def current_user(self):
        token = self.cookies().get("fance_session")
        if not token:
            return None
        with SESSIONS_LOCK:
            return SESSIONS.get(token)

    @staticmethod
    def login_user(user_name, password):
        with open_database() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT password FROM users WHERE user_name=%s", (user_name,))
                row = cursor.fetchone()
                if not row or not bcrypt.checkpw(password.encode("utf-8"), row[0].encode("utf-8")):
                    return result(500, "用户名或密码错误")
                cursor.execute("UPDATE users SET last_login_time=NOW() WHERE user_name=%s", (user_name,))
        return result(200, "登录成功", {"userName": user_name})

    @staticmethod
    def register_user(user_name, password, email):
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        with open_database() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 FROM users WHERE user_name=%s", (user_name,))
                if cursor.fetchone():
                    return result(500, "用户名已存在")
                cursor.execute(
                    "INSERT INTO users (user_name, password, email, create_time) VALUES (%s, %s, %s, NOW())",
                    (user_name, hashed, email),
                )
        return result(200, "注册成功")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8094), FanceHandler)
    print("FANCE preview running at http://127.0.0.1:8094")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
