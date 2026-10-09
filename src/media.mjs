// Maps the files in public/media (the hero videos; everything in that folder goes to the bucket)
// to bucket objects and decides, per file, where browsers load it from.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { bucketOrigin, presign } from './s3.mjs';

export const mediaTypes = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
export const mediaCacheControl = 'public, max-age=31536000, immutable';

// Signed URLs stay identical for three days, so browsers can cache the files;
// each one remains valid for at least four more days after that.
const SIGNING_WINDOW = 3 * 86400 * 1000;
const URL_LIFETIME = 7 * 86400;
const RECHECK_INTERVAL = 10 * 60 * 1000;

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('error', reject).on('data', chunk => hash.update(chunk)).on('end', () => resolve(hash.digest('hex')));
  });
}

// Keys contain the content hash (media/hero.3f2a9c1b7d4e.mp4): a replaced file gets a new key,
// so no visitor ever receives a stale cached copy, and an unchanged file is never uploaded twice.
export async function scanMedia(dir) {
  const files = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const ext = path.extname(entry.name).toLowerCase();
    if (!entry.isFile() || !mediaTypes[ext]) continue;
    const file = path.join(dir, entry.name);
    const [sha256, info] = await Promise.all([sha256File(file), stat(file)]);
    files.set(entry.name, { name: entry.name, file, size: info.size, sha256, type: mediaTypes[ext], key: `media/${path.basename(entry.name, ext)}.${sha256.slice(0, 12)}${ext}` });
  }
  return files;
}

async function existsInBucket(bucket, file) {
  const response = await fetch(presign(bucket, file.key, { method: 'HEAD', expiresIn: 120 }), { method: 'HEAD', signal: AbortSignal.timeout(5000) });
  return response.ok && Number(response.headers.get('content-length')) === file.size;
}

// Only files confirmed in the bucket get bucket URLs; everything else is served from /media/,
// so the site works before the first upload and if the bucket is unreachable.
export function createMediaResolver(files, bucket) {
  const inBucket = new Set();
  async function verify() {
    if (!bucket) return;
    await Promise.all([...files.values()].map(async file => {
      try {
        if (await existsInBucket(bucket, file)) inBucket.add(file.name);
        else inBucket.delete(file.name);
      } catch { /* Network trouble: keep the last known state until the next check. */ }
    }));
  }
  function url(name) {
    const file = files.get(name);
    if (!file) return null;
    if (!bucket || !inBucket.has(name)) return `/media/${name}`;
    return presign(bucket, file.key, { date: new Date(Math.floor(Date.now() / SIGNING_WINDOW) * SIGNING_WINDOW), expiresIn: URL_LIFETIME });
  }
  function watch() {
    if (bucket) setInterval(verify, RECHECK_INTERVAL).unref();
  }
  return { url, verify, watch, count: () => inBucket.size, total: files.size, origin: bucket ? bucketOrigin(bucket) : null };
}
