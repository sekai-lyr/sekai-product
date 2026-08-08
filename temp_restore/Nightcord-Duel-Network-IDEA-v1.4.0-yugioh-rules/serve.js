const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = path.join(__dirname, "Nightcord-Duel-Network-v1.4.0");

const MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
    let filePath = path.join(ROOT, req.url === "/" ? "index.html" : req.url);
    const ext = path.extname(filePath);
    const mime = MIME[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        res.writeHead(200, { "Content-Type": mime + "; charset=utf-8" });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
