// Static server for the collateral pages. Serves the PROJECT ROOT, so pages use absolute paths such as
// /collateral/images/manifest.json, /public/media/p/<file>.jpg and /node_modules/@fontsource/... .
//   node collateral/tools/serve.mjs <port>
// Each session uses its own port (see collateral/CONTRACT.md). No caching, so edits show on reload.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.argv[2] ?? 4510);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end('forbidden');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) return res.writeHead(404, { 'content-type': 'text/plain' }).end('not found: ' + p);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  })
  .listen(port, '127.0.0.1', () => console.log(`collateral server: http://localhost:${port}/ (root ${ROOT})`));
