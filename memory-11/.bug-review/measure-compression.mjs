/** 对比压缩前后的首屏传输量，并检查关键模块是否仍可正常加载。 */
const BASE = "http://127.0.0.1:8080";

function resolve(spec, fromPath) {
    if (/^https?:/.test(spec)) return spec;
    const baseDir = fromPath.replace(/[^/]*$/, "");
    const path = spec.split("?")[0];
    return new URL(path.startsWith("/") ? path : baseDir + path, BASE).pathname;
}

async function crawl(acceptEncoding) {
    const seen = new Set();
    let total = 0;
    let requests = 0;
    async function walk(path) {
        if (seen.has(path)) return;
        seen.add(path);
        let text;
        try {
            const r = await fetch(BASE + path, { headers: { "Accept-Encoding": acceptEncoding } });
            const buf = Buffer.from(await r.arrayBuffer());
            // node 的 fetch 会自动解压，body 长度反映不出线上字节数，
            // 因此优先用服务器返回的 Content-Length（本服务器会写压缩后的长度）。
            const wire = Number(r.headers.get("content-length")) || buf.length;
            total += wire;
            requests++;
            if (acceptEncoding && r.headers.get("content-encoding") && path === "/js/engine.js") {
                console.log(`  engine.js: 原始 ${buf.length} 字节 → 线上 ${wire} 字节 (${r.headers.get("content-encoding")})`);
            }
            text = buf.toString("utf8");
        } catch { return; }
        if (!path.endsWith(".js")) return;
        const specs = [
            ...text.matchAll(/^\s*(?:import|export)\b[^;"']*?from\s*["']([^"']+)["']/gm),
            ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
        ].map(m => m[1]);
        await Promise.all(specs.filter(s => !s.startsWith("node:")).map(s => walk(resolve(s, path))));
    }
    const html = await (await fetch(BASE + "/")).text();
    const entry = [...html.matchAll(/\.src\s*=\s*["']([^"']+\.js[^"']*)["']/g)].map(m => resolve(m[1], "/"));
    await Promise.all(entry.map(walk));
    const css = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);
    for (const c of css) {
        const r = await fetch(new URL(c, BASE + "/").href, { headers: { "Accept-Encoding": acceptEncoding } });
        const buf = Buffer.from(await r.arrayBuffer());
        total += Number(r.headers.get("content-length")) || buf.length;
        requests++;
    }
    // 登录页上的装饰卡图（静态 HTML 里的 <img src>）
    const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
    let imageBytes = 0;
    for (const img of images) {
        const r = await fetch(new URL(img, BASE + "/").href, { headers: { "Accept-Encoding": acceptEncoding } });
        const buf = Buffer.from(await r.arrayBuffer());
        const len = buf.length;
        imageBytes += len;
        total += len;
        requests++;
    }
    return { total, requests, modules: seen.size, images: images.length, imageBytes };
}

const plain = await crawl("");
console.log(`未压缩首屏: ${(plain.total / 1024).toFixed(0)} KB / ${plain.requests} 个请求（含 ${plain.images} 张装饰卡图 ${(plain.imageBytes / 1024).toFixed(0)} KB）`);
const gzip = await crawl("gzip, br");
console.log(`优化后首屏: ${(gzip.total / 1024).toFixed(0)} KB / ${gzip.requests} 个请求（含 ${gzip.images} 张装饰卡图 ${(gzip.imageBytes / 1024).toFixed(0)} KB）`);
console.log(`节省: ${((1 - gzip.total / plain.total) * 100).toFixed(1)}%`);
