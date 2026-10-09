import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketFromEnv, bucketOrigin, presign } from '../src/s3.mjs';

const awsExample = {
  BUCKET: 'examplebucket',
  ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  ENDPOINT: 'https://s3.amazonaws.com',
  REGION: 'us-east-1',
};

test('presign matches the AWS documentation example', () => {
  // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
  const url = presign(bucketFromEnv(awsExample), 'test.txt', { date: new Date('2013-05-24T00:00:00Z'), expiresIn: 86400 });
  assert.equal(url, 'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
});

test('bucketFromEnv reads Railway variables and defaults the region to auto', () => {
  const bucket = bucketFromEnv({ BUCKET: 'tinah-media-x1', ACCESS_KEY_ID: 'id', SECRET_ACCESS_KEY: 'secret', ENDPOINT: 'https://t3.storageapi.dev' });
  assert.equal(bucket.region, 'auto');
  assert.equal(bucket.pathStyle, false);
  assert.equal(bucketOrigin(bucket), 'https://tinah-media-x1.t3.storageapi.dev');
});

test('bucketFromEnv accepts AWS SDK preset names and path style', () => {
  const bucket = bucketFromEnv({ AWS_S3_BUCKET_NAME: 'b', AWS_ACCESS_KEY_ID: 'id', AWS_SECRET_ACCESS_KEY: 's', AWS_ENDPOINT_URL_S3: 'https://t3.storageapi.dev', AWS_DEFAULT_REGION: 'auto', BUCKET_PATH_STYLE: 'true' });
  assert.equal(bucket.name, 'b');
  assert.equal(bucketOrigin(bucket), 'https://t3.storageapi.dev');
  assert.match(presign(bucket, 'media/a.mp4'), /^https:\/\/t3\.storageapi\.dev\/b\/media\/a\.mp4\?/);
});

test('bucketFromEnv rejects incomplete or insecure configuration', () => {
  assert.equal(bucketFromEnv({}), null);
  assert.equal(bucketFromEnv({ ...awsExample, SECRET_ACCESS_KEY: '' }), null);
  assert.equal(bucketFromEnv({ ...awsExample, ENDPOINT: 'http://s3.example.com' }), null);
  assert.equal(bucketFromEnv({ ...awsExample, ENDPOINT: 'not a url' }), null);
  assert.ok(bucketFromEnv({ ...awsExample, ENDPOINT: 'http://localhost:9000' }));
});

test('signed headers are listed and keys are encoded', () => {
  const url = new URL(presign(bucketFromEnv(awsExample), 'media/a b.mp4', { method: 'PUT', headers: { 'Content-Type': 'video/mp4' } }));
  assert.equal(url.pathname, '/media/a%20b.mp4');
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host');
});
