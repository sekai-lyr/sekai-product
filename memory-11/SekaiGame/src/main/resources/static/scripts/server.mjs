import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
// 开发服务器只托管静态资源，但页面里所有接口都是同源相对路径（/api/...）。
// 没有这层代理的话，8080 上的最新前端永远登不进去（405），只能去用 8091 里
// 打包好的旧前端。这里把 /api 反代到后端，8080 才是一个可用的完整环境。
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8091";
const PROXY_PREFIXES = ["/api/"];
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};
const SPA_ROUTES = new Set(["/login", "/register", "/game"]);

// 登录页原本要传约 1.8 MB 的未压缩 JS/CSS（86 个模块），手机端首屏体验很差。
// 文本类资源优先 br、其次 gzip；图片本身已是压缩格式，不再二次处理。
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt"]);
const compressionCache = new Map();

function compressBody(finalPath, content, acceptEncoding, mtimeMs = 0) {
    if (!COMPRESSIBLE.has(path.extname(finalPath).toLowerCase())) return null;
    const accepts = String(acceptEncoding || "");
    const wantsBrotli = accepts.includes("br");
    const wantsGzip = accepts.includes("gzip");
    if (!wantsBrotli && !wantsGzip) return null;
    // key 里带 mtime：源文件改了但字节数恰好相同（例如只替换一个字符）时，
    // 旧实现会命中缓存继续下发旧内容。
    const key = `${finalPath}:${mtimeMs}:${content.length}`;
    let entry = compressionCache.get(key);
    if (!entry) {
        entry = {
            br: brotliCompressSync(content, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } }),
            gzip: gzipSync(content, { level: 6 }),
        };
        if (compressionCache.size > 120) compressionCache.clear();
        compressionCache.set(key, entry);
    }
    return wantsBrotli ? { body: entry.br, encoding: "br" } : { body: entry.gzip, encoding: "gzip" };
}

function safePath(urlPath) {
    let pathname;
    try {
        pathname = decodeURIComponent((urlPath || "/").split("?")[0]);
    } catch {
        return null;
    }
    const requested = pathname === "/" || SPA_ROUTES.has(pathname) ? "/index.html" : pathname;
    const resolved = path.resolve(ROOT, "." + requested);
    return resolved.startsWith(ROOT + path.sep) || resolved === ROOT ? resolved : null;
}

/** 把 /api/* 反向代理到 Spring Boot 后端（含 POST 请求体与 Set-Cookie）。 */
async function proxyToBackend(request, response) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const headers = { ...request.headers };
    for (const drop of ["host", "connection", "content-length", "accept-encoding"]) delete headers[drop];

    try {
        const upstream = await fetch(new URL(request.url, BACKEND), {
            method: request.method,
            headers,
            body,
            redirect: "manual",
        });
        const payload = Buffer.from(await upstream.arrayBuffer());
        const out = {};
        upstream.headers.forEach((value, key) => {
            const lower = key.toLowerCase();
            if (["transfer-encoding", "connection", "content-encoding", "content-length", "set-cookie"].includes(lower)) return;
            out[key] = value;
        });
        // Set-Cookie 可能有多个，必须原样透传，否则登录态在 8080 上丢失
        const cookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
        if (cookies.length > 0) out["set-cookie"] = cookies;
        out["content-length"] = String(payload.length);
        out["x-proxied-by"] = "static-dev-server";
        response.writeHead(upstream.status, out);
        response.end(payload);
    } catch (error) {
        response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(`Bad Gateway：无法连接后端 ${BACKEND}（${error?.message || error}）`);
    }
}

const server = http.createServer(async (request, response) => {
    try {
        const pathname = (request.url || "/").split("?")[0];
        if (PROXY_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
            await proxyToBackend(request, response);
            return;
        }
        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, {
                "Content-Type": "text/plain; charset=utf-8",
                "Allow": "GET, HEAD",
            }).end("Method Not Allowed");
            return;
        }
        const filePath = safePath(request.url);
        if (!filePath) {
            response.writeHead(403).end("Forbidden");
            return;
        }
        const info = await stat(filePath);
        const finalPath = info.isDirectory() ? path.join(filePath, "index.html") : filePath;
        const content = await readFile(finalPath);
        const extension = path.extname(finalPath).toLowerCase();
        const isCode = [".html", ".css", ".js", ".mjs", ".json"].includes(extension);
        const encoded = compressBody(finalPath, content, request.headers["accept-encoding"], info.mtimeMs);
        const headers = {
            "Content-Type": MIME[extension] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "same-origin",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'",
            // 开发版代码不缓存，避免修复后浏览器仍运行旧的 ui.js。
            "Cache-Control": isCode ? "no-store, max-age=0" : "public, max-age=86400",
        };
        if (encoded) {
            headers["Content-Encoding"] = encoded.encoding;
            headers["Vary"] = "Accept-Encoding";
            headers["Content-Length"] = String(encoded.body.length);
        } else {
            headers["Content-Length"] = String(content.length);
        }
        response.writeHead(200, headers);
        response.end(request.method === "HEAD" ? undefined : (encoded ? encoded.body : content));
    } catch (error) {
        response.writeHead(error?.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(error?.code === "ENOENT" ? "Not Found" : "Server Error");
    }
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nightcord Duel Network: http://127.0.0.1:${PORT}`);
    console.log("按 Ctrl+C 停止服务器。");
});
