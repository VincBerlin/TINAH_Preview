import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanMedia, createMediaResolver } from '../src/media.mjs';

async function withMedia(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'tinah-media-'));
  try {
    await writeFile(path.join(dir, 'hero.mp4'), 'video');
    await writeFile(path.join(dir, 'notes.txt'), 'ignored');
    await run(await scanMedia(dir));
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('scanMedia builds content-addressed keys for media files only', () => withMedia(files => {
  assert.deepEqual([...files.keys()], ['hero.mp4']);
  const hero = files.get('hero.mp4');
  assert.equal(hero.size, 5);
  assert.equal(hero.type, 'video/mp4');
  assert.match(hero.key, /^media\/hero\.[0-9a-f]{12}\.mp4$/);
}));

test('without a bucket every file is served locally', () => withMedia(async files => {
  const media = createMediaResolver(files, null);
  await media.verify();
  assert.equal(media.url('hero.mp4'), '/media/hero.mp4');
  assert.equal(media.url('missing.mp4'), null);
}));

test('only files confirmed in the bucket get signed URLs', () => withMedia(async files => {
  const bucket = { name: 'b', accessKeyId: 'id', secretAccessKey: 's', region: 'auto', endpoint: new URL('https://t3.storageapi.dev'), pathStyle: false };
  const realFetch = globalThis.fetch;
  let present = false;
  globalThis.fetch = async () => new Response(null, { status: present ? 200 : 404, headers: { 'content-length': '5' } });
  try {
    const media = createMediaResolver(files, bucket);
    await media.verify();
    assert.equal(media.url('hero.mp4'), '/media/hero.mp4');
    present = true;
    await media.verify();
    const first = media.url('hero.mp4');
    assert.match(first, /^https:\/\/b\.t3\.storageapi\.dev\/media\/hero\.[0-9a-f]{12}\.mp4\?X-Amz-/);
    assert.equal(media.url('hero.mp4'), first, 'URLs stay stable within a signing window so browsers can cache them');
  } finally { globalThis.fetch = realFetch; }
}));
