import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv();

const SECRET_ID = process.env.TENCENT_SECRET_ID;
const SECRET_KEY = process.env.TENCENT_SECRET_KEY;
const ENV_ID = 'hennanzsb-d2gg6lb9if6c9aa6f';
const REGION = 'ap-shanghai';
const DIST = '/workspace/frontend/dist';

if (!SECRET_ID || !SECRET_KEY) {
  console.error('缺少环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY，请在 .env 中配置');
  process.exit(1);
}

function camSafeUrlEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

// Replicate tcb CLI admin-api signing (COS q-signature)
function getAuth({ secretId, secretKey, method = 'post', params = {}, headers = {}, pathname = '/admin' }) {
  method = method.toLowerCase();
  let p = pathname;
  if (p.indexOf('/') !== 0) p = '/' + p;
  const getObjectKeys = (obj) =>
    Object.keys(obj).filter((k) => typeof obj[k] !== 'undefined').sort();
  const objectToString = (obj) => {
    const list = [];
    for (const key of getObjectKeys(obj)) {
      let value = obj[key] === null || typeof obj[key] === 'undefined' ? '' : obj[key];
      if (typeof value !== 'string') value = JSON.stringify(value);
      list.push(`${camSafeUrlEncode(key.toLowerCase())}=${camSafeUrlEncode(value)}`);
    }
    return list.join('&');
  };
  const now = Math.floor(Date.now() / 1000) - 1;
  const exp = now + 900;
  const qKeyTime = `${now};${exp}`;
  const qHeaderList = getObjectKeys(headers).join(';').toLowerCase();
  const qUrlParamList = getObjectKeys(params).join(';').toLowerCase();
  const signKey = crypto.createHmac('sha1', secretKey).update(qKeyTime).digest('hex');
  const formatString = [method, p, objectToString(params), objectToString(headers), ''].join('\n');
  const sha1 = crypto.createHash('sha1').update(Buffer.from(formatString)).digest('hex');
  const stringToSign = ['sha1', qKeyTime, sha1, ''].join('\n');
  const qSignature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');
  return [
    'q-sign-algorithm=sha1',
    `q-ak=${secretId}`,
    `q-sign-time=${qKeyTime}`,
    `q-key-time=${qKeyTime}`,
    `q-header-list=${qHeaderList}`,
    `q-url-param-list=${qUrlParamList}`,
    `q-signature=${qSignature}`,
  ].join('&');
}

async function getUploadMetadata(cloudPath) {
  const data = {
    action: 'storage.getUploadMetadata',
    path: cloudPath,
    envName: ENV_ID,
    timestamp: Date.now(),
  };
  const headers = {
    'content-type': 'application/json',
    'user-agent': 'cloudbase-manager-node/0.1.0',
    'x-tcb-source': 'cloudbase-manager-node, not-scf',
  };
  const authorization = getAuth({
    secretId: SECRET_ID,
    secretKey: SECRET_KEY,
    method: 'post',
    params: data,
    headers,
    pathname: '/admin',
  });
  const body = { ...data, sessionToken: '', authorization };
  const url = `https://${ENV_ID}.${REGION}.tcb-api.tencentcloudapi.com/admin`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (json.code) throw new Error('getUploadMetadata failed: ' + JSON.stringify(json));
  return json.data;
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else out.push({ full, rel });
  }
  return out;
}

async function main() {
  const files = walk(DIST).filter((f) => f.rel !== '.gitkeep');
  console.log(`Found ${files.length} files to upload`);
  let ok = 0;
  let fail = 0;
  for (const f of files) {
    try {
      const meta = await getUploadMetadata(f.rel);
      const buf = fs.readFileSync(f.full);
      const ext = path.extname(f.rel).toLowerCase();
      const putRes = await fetch(meta.url, {
        method: 'PUT',
        headers: {
          Authorization: meta.authorization,
          'x-cos-security-token': meta.token,
          'x-cos-meta-fileid': meta.cosFileId,
          'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
          'Content-Length': String(buf.length),
        },
        body: buf,
      });
      if (!putRes.ok) {
        const txt = await putRes.text();
        throw new Error(`HTTP ${putRes.status}: ${txt.slice(0, 200)}`);
      }
      ok++;
      console.log(`✔ ${f.rel}`);
    } catch (e) {
      fail++;
      console.error(`✖ ${f.rel}: ${e.message}`);
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
