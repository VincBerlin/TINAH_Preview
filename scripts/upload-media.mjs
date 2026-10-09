// Uploads public/media to the Railway bucket. Already uploaded files are skipped.
// Usage: railway run npm run media:upload   (or with the bucket variables in .env: node --env-file=.env scripts/upload-media.mjs)
//        npm run media:upload -- --dry-run  (lists files and bucket keys without uploading)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bucketFromEnv, presign } from '../src/s3.mjs';
import { scanMedia, mediaCacheControl } from '../src/media.mjs';

const dryRun = process.argv.includes('--dry-run');
const bucket = bucketFromEnv();
if (!bucket && !dryRun) {
  console.error('No bucket configured. Set BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY and ENDPOINT (REGION is optional), e.g. via `railway run`.');
  process.exit(1);
}

const files = await scanMedia(fileURLToPath(new URL('../public/media/', import.meta.url)));
let failed = 0;
for (const file of files.values()) {
  const label = `${file.name} → ${file.key} (${(file.size / 1e6).toFixed(1)} MB)`;
  if (dryRun) { console.log(label); continue; }
  try {
    const head = await fetch(presign(bucket, file.key, { method: 'HEAD', expiresIn: 300 }), { method: 'HEAD' });
    if (head.ok && Number(head.headers.get('content-length')) === file.size) { console.log(`= ${label}, already in the bucket`); continue; }
    // Content-Type is signed; Cache-Control is sent unsigned, as the AWS SDKs do.
    const uploadUrl = presign(bucket, file.key, { method: 'PUT', expiresIn: 900, headers: { 'Content-Type': file.type } });
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'Cache-Control': mediaCacheControl }, body: await readFile(file.file) });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
    console.log(`↑ ${label}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${label}: ${error.message}`);
  }
}
if (!dryRun) console.log(failed ? `${failed} upload(s) failed.` : `Done. Restart or redeploy the service, or wait up to 10 minutes, for the site to switch to the bucket.`);
process.exitCode = failed ? 1 : 0;
