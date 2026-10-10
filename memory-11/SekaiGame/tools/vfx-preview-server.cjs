const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.argv[2] || 8097);
const projectRoot = path.resolve(__dirname, '..');
const staticRoot = path.join(projectRoot, 'src', 'main', 'resources', 'static');
const cardsFile = path.join(projectRoot, 'src', 'main', 'resources', 'cards.json');
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (pathname === '/api/cards') {
    response.writeHead(200, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
    fs.createReadStream(cardsFile).pipe(response);
    return;
  }

  const gameRoutes = new Set(['/', '/login', '/register', '/game']);
  const relative = gameRoutes.has(pathname) ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(staticRoot, relative);
  if (file !== staticRoot && !file.startsWith(`${staticRoot}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`SekaiGame: http://127.0.0.1:${port}/game`);
  console.log(`VFX preview: http://127.0.0.1:${port}/vfx-preview.html`);
});
