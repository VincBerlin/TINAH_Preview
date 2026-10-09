import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.ttf': 'font/ttf' };
function safeURL(value, fallback, hosts) {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!hosts || hosts.includes(url.hostname)) ? url.href : fallback;
  } catch { return fallback; }
}
const config = {
  heroVideoUrl: safeURL(process.env.HERO_VIDEO_URL, '/assets/hero.mp4?v=original1080'),
  spotifyUrl: safeURL(process.env.SPOTIFY_URL, 'https://tr.ee/FuFQHdoNV4', ['open.spotify.com', 'spotify.link', 'tr.ee']),
};

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/config.js') {
      res.writeHead(200, { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' });
      return res.end(req.method === 'HEAD' ? undefined : `window.TINAH_CONFIG = ${JSON.stringify(config)};`);
    }
    if (pathname === '/health') { res.writeHead(200); return res.end('ok'); }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404); return res.end(); }
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' };
    let start = 0, end = info.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end(); }
      start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= info.size) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end(); }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    res.writeHead(status, { ...headers, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`TINAH preview: http://localhost:${port}`));
