/**
 * Crawls the browser module graph over HTTP and reports any 404/500,
 * so a broken import can't be discovered only in the browser.
 */
const BASE = process.env.BASE || "http://127.0.0.1:8080";
const seen = new Set();
const problems = [];
const queue = [];

function resolve(spec, fromPath) {
    if (/^https?:/.test(spec)) return spec;
    const baseDir = fromPath.replace(/[^/]*$/, "");
    const path = spec.split("?")[0];
    const joined = new URL(path.startsWith("/") ? path : baseDir + path, BASE).pathname;
    return joined;
}

async function fetchText(path) {
    const response = await fetch(BASE + path);
    if (!response.ok) throw new Error(`${response.status}`);
    return response.text();
}

async function walk(path) {
    if (seen.has(path)) return;
    seen.add(path);
    let text;
    try {
        text = await fetchText(path);
    } catch (error) {
        problems.push(`${path} -> ${error.message}`);
        return;
    }
    if (!path.endsWith(".js")) return;
    // Only real module specifiers: a line-starting `import ... from "x"`,
    // `export ... from "x"`, or a dynamic `import("x")`. Matching arbitrary
    // "from"/"import" text inside bundles produced false 404s.
    const specs = [
        ...text.matchAll(/^\s*(?:import|export)\b[^;"']*?from\s*["']([^"']+)["']/gm),
        ...text.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
        ...text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ].map(m => m[1]);
    for (const spec of specs) {
        if (spec.startsWith("data:") || spec.startsWith("node:")) continue;
        queue.push(resolve(spec, path));
    }
}

const html = await fetchText("/");
const entry = [
    ...[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]),
    // main.js is injected dynamically: entry.src = "./js/main.js?v=..."
    ...[...html.matchAll(/\.src\s*=\s*["']([^"']+\.js[^"']*)["']/g)].map(m => m[1]),
].map(src => resolve(src.split("?")[0], "/"));
const cssLinks = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);
queue.push("/", ...entry);
console.log("entry modules:", entry.join(", "));

while (queue.length) {
    const batch = queue.splice(0, queue.length);
    await Promise.all(batch.map(walk));
}

for (const css of cssLinks) {
    try {
        const response = await fetch(new URL(css, BASE + "/").href);
        if (!response.ok) problems.push(`${css} -> ${response.status}`);
    } catch (error) {
        problems.push(`${css} -> ${error.message}`);
    }
}

console.log(`crawled ${seen.size} module URLs`);
if (problems.length === 0) {
    console.log("ALL MODULES RESOLVE (no 404/500)");
} else {
    console.log("PROBLEMS:");
    for (const problem of problems) console.log("  " + problem);
    process.exitCode = 1;
}
