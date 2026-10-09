import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib';
import { bucketFromEnv } from './src/s3.mjs';
import { scanMedia, createMediaResolver, mediaTypes } from './src/media.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', ...mediaTypes };
const compressible = new Set(['.html', '.css', '.js', '.svg', '.ttf']);
function safeURL(value, fallback, hosts) {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (!hosts || hosts.includes(url.hostname)) ? url.href : fallback;
  } catch { return fallback; }
}
const spotifyUrl = safeURL(process.env.SPOTIFY_URL, 'https://tr.ee/FuFQHdoNV4', ['open.spotify.com', 'spotify.link', 'tr.ee']);

const bucket = bucketFromEnv();
const media = createMediaResolver(await scanMedia(path.join(root, 'media')), bucket);
await media.verify();
media.watch();
console.log(bucket
  ? `Media: ${media.count()}/${media.total} files served from bucket ${bucket.name}; the rest from /media/`
  : 'Media: no bucket configured, serving /media/ locally');

// Media references in index.html (/media/<file>) become bucket URLs once the file is confirmed there.
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
async function renderIndex() {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  return html.replace(/\/media\/([\w.-]+)/g, (match, name) => escapeAttribute(media.url(name) || match));
}

function send(req, res, status, headers, body) {
  const encoding = /\bbr\b/.test(req.headers['accept-encoding'] || '') ? 'br' : /\bgzip\b/.test(req.headers['accept-encoding'] || '') ? 'gzip' : null;
  let data = Buffer.from(body);
  if (encoding === 'br') data = brotliCompressSync(data, { params: { [zlib.BROTLI_PARAM_QUALITY]: 6 } });
  else if (encoding === 'gzip') data = gzipSync(data);
  res.writeHead(status, { ...headers, Vary: 'Accept-Encoding', ...(encoding && { 'Content-Encoding': encoding }), 'Content-Length': data.length });
  res.end(req.method === 'HEAD' ? undefined : data);
}

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/health') { res.writeHead(200); return res.end('ok'); }
    if (pathname === '/config.js') {
      const config = { spotifyUrl, heroVideo: { landscape: media.url('hero.mp4'), portrait: media.url('hero-portrait.mp4') } };
      return send(req, res, 200, { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' }, `window.TINAH_CONFIG = ${JSON.stringify(config)};`);
    }
    if (pathname === '/' || pathname === '/index.html') {
      return send(req, res, 200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-cache', ...(media.count() && { Link: `<${media.origin}>; rel=preconnect` }) }, await renderIndex());
    }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404); return res.end(); }
    const ext = path.extname(file);
    // Versioned URLs (?v=…) change whenever the file changes, so they can be cached for a year.
    const cacheControl = url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
    if (compressible.has(ext)) return send(req, res, 200, { 'Content-Type': types[ext], 'Cache-Control': cacheControl }, await readFile(file));
    const headers = { 'Content-Type': types[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': cacheControl };
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
