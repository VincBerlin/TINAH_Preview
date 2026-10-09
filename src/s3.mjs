// Presigned S3 URLs (AWS Signature V4, query signing) for Railway Storage Buckets.
// Railway buckets are private: browsers receive short-lived signed URLs and load
// the files directly from the bucket, so media traffic never passes through the service.
import { createHash, createHmac } from 'node:crypto';

const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

// Railway's own variable names first, then the AWS SDK / S3 preset names it can inject instead.
export function bucketFromEnv(env = process.env) {
  const pick = (...names) => names.map(name => env[name]?.trim()).find(Boolean);
  const name = pick('BUCKET', 'S3_BUCKET', 'AWS_S3_BUCKET_NAME', 'BUCKET_NAME');
  const accessKeyId = pick('ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
  const secretAccessKey = pick('SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
  const endpointValue = pick('ENDPOINT', 'S3_ENDPOINT', 'AWS_ENDPOINT_URL_S3', 'AWS_ENDPOINT_URL');
  if (!name || !accessKeyId || !secretAccessKey || !endpointValue) return null;
  let endpoint;
  try { endpoint = new URL(endpointValue); } catch { return null; }
  const local = ['localhost', '127.0.0.1'].includes(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) return null;
  return {
    name,
    accessKeyId,
    secretAccessKey,
    region: pick('REGION', 'S3_REGION', 'AWS_REGION', 'AWS_DEFAULT_REGION') || 'auto',
    endpoint,
    // Railway uses virtual-hosted URLs; older buckets say "path style" on their Credentials tab.
    pathStyle: /^(1|true|yes|path)$/i.test(pick('BUCKET_PATH_STYLE', 'S3_FORCE_PATH_STYLE', 'AWS_S3_FORCE_PATH_STYLE') || ''),
  };
}

function locate(bucket, key) {
  const base = bucket.endpoint.pathname.replace(/\/+$/, '');
  const objectPath = key.split('/').map(encode).join('/');
  return bucket.pathStyle
    ? { host: bucket.endpoint.host, path: `${base}/${encode(bucket.name)}/${objectPath}` }
    : { host: `${bucket.name}.${bucket.endpoint.host}`, path: `${base}/${objectPath}` };
}

export function bucketOrigin(bucket) {
  return `${bucket.endpoint.protocol}//${locate(bucket, '').host}`;
}

// `headers` are signed too; the request must then send exactly these header values.
export function presign(bucket, key, { method = 'GET', expiresIn = 3600, date = new Date(), headers = {} } = {}) {
  const { host, path } = locate(bucket, key);
  const amzDate = date.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${bucket.region}/s3/aws4_request`;
  const signed = Object.entries({ ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim()])), host })
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const signedHeaders = signed.map(([name]) => name).join(';');
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${bucket.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresIn)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ].map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&');
  const canonicalRequest = [method, path, query, signed.map(([name, value]) => `${name}:${value}\n`).join(''), signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const signingKey = [bucket.region, 's3', 'aws4_request'].reduce(hmac, hmac(`AWS4${bucket.secretAccessKey}`, day));
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return `${bucket.endpoint.protocol}//${host}${path}?${query}&X-Amz-Signature=${signature}`;
}
