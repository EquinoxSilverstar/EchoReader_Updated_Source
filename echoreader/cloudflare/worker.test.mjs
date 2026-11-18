import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { SignJWT, importPKCS8 } from 'jose';
import worker, { UsageBudget } from './worker.mjs';

const project = 'echo-reader-39cec';
const site = 'https://equinoxsilverstar.github.io';

function request(path, { method = 'GET', token, origin, body } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (origin) headers.set('Origin', origin);
  return new Request('https://worker.example' + path, { method, headers, body });
}

test('Worker exposes a readiness check, rejects unauthenticated requests and enforces CORS', async () => {
  assert.equal((await worker.fetch(request('/health'), {})).status, 503);
  assert.equal((await worker.fetch(request('/health'), { USAGE: {} })).status, 200);
  assert.equal((await worker.fetch(request('/status'), {})).status, 401);
  assert.equal((await worker.fetch(request('/status', { token: 'invalid.token', origin: site }), {})).status, 401);
  assert.equal((await worker.fetch(request('/status', { origin: 'https://elsewhere.example' }), {})).status, 403);
  const preflight = await worker.fetch(request('/tts', { method: 'OPTIONS', origin: site }), {});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), site);
  assert.equal(await preflight.text(), '');
});

test('Worker verifies signed Firebase tokens and proxies both voice providers with server credentials', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'echo-reader-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'certificate.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=unit-test',
    '-days', '1', '-keyout', keyPath, '-out', certPath], { stdio: 'ignore' });
  const privateKey = readFileSync(keyPath, 'utf8');
  const key = await importPKCS8(privateKey, 'RS256');
  const certificate = readFileSync(certPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const makeToken = (audience = project, exp = now + 600) => new SignJWT({
    sub: 'reader', auth_time: now - 5, firebase: { sign_in_provider: 'password' },
  }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://securetoken.google.com/' + project)
    .setAudience(audience).setIssuedAt(now - 5).setExpirationTime(exp).sign(key);

  let authCalls = 0;
  let providerCalls = 0;
  let consumeCalls = 0;
  t.mock.method(globalThis, 'fetch', async (address, options) => {
    if (address.includes('/metadata/x509/')) {
      authCalls++;
      return Response.json({ 'test-key': certificate }, { headers: { 'Cache-Control': 'public, max-age=600' } });
    }
    if (address === 'https://oauth2.googleapis.com/token') {
      assert.ok(options.body.get('assertion'));
      return Response.json({ access_token: 'fake-oauth-token', expires_in: 3600 });
    }
    providerCalls++;
    if (address.includes('elevenlabs.io')) {
      assert.equal(options.headers.get('xi-api-key'), 'fake-eleven-key');
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } });
    }
    assert.match(address, /^https:\/\/texttospeech.googleapis.com\//);
    assert.equal(options.headers.get('Authorization'), 'Bearer fake-oauth-token');
    assert.equal(options.headers.has('X-Goog-Api-Key'), false);
    return Response.json({ audioContent: 'AQID' });
  });

  const token = await makeToken();
  const env = {
    FIREBASE_PROJECT_ID: project,
    ELEVENLABS_API_KEY: 'fake-eleven-key',
    GOOGLE_TTS_SERVICE_ACCOUNT: JSON.stringify({ type: 'service_account', client_email: 'tts@example.test', private_key: privateKey }),
    USAGE: { idFromName: () => 'budget', get: () => ({ fetch: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), { uid: 'reader', characters: 5 });
      consumeCalls++;
      return new Response(null, { status: 204 });
    } }) },
  };
  const status = await worker.fetch(request('/status', { token }), env);
  assert.deepEqual((await status.json()).providers, { eleven: true, google: true });
  const noKeys = await worker.fetch(request('/status', { token }), { FIREBASE_PROJECT_ID: project });
  assert.deepEqual((await noKeys.json()).providers, { eleven: false, google: false });
  for (const badToken of [await makeToken('different-project'), await makeToken(project, now - 1),
    token.slice(0, token.lastIndexOf('.') + 1) + 'AAAA']) {
    assert.equal((await worker.fetch(request('/status', { token: badToken }), env)).status, 401);
  }
  for (const provider of ['eleven', 'google']) {
    const body = JSON.stringify({ text: 'Hello', provider, voiceId: 'en-US-Standard-A', rate: 1 });
    const response = await worker.fetch(request('/tts', { method: 'POST', token, origin: site, body }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  }
  const badJson = await worker.fetch(request('/tts', { method: 'POST', token, origin: site, body: '{' }), env);
  assert.equal(badJson.status, 400);
  const oversized = await worker.fetch(request('/tts', { method: 'POST', token, origin: site, body: 'a'.repeat(20_000) }), env);
  assert.equal(oversized.status, 413);
  const noBudget = await worker.fetch(request('/voices?provider=eleven', { token }), { ...env, USAGE: null });
  assert.equal(noBudget.status, 500);
  assert.equal(authCalls, 1);
  assert.equal(providerCalls, 2);
  assert.equal(consumeCalls, 2);
});

test('SQLite budget limits both an individual user and aggregate account spend', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const budget = new UsageBudget({ storage: {
    sql: { exec: (sql, ...args) => {
      const statement = db.prepare(sql);
      if (sql.startsWith('SELECT')) return { toArray: () => statement.all(...args) };
      statement.run(...args);
    } },
    transactionSync: (fn) => {
      db.exec('BEGIN');
      try {
        const value = fn();
        db.exec('COMMIT');
        return value;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  } });
  t.mock.method(Date, 'now', () => 1_800_000_000_000);
  const consume = (uid, characters) => budget.fetch(request('/consume', {
    method: 'POST', body: JSON.stringify({ uid, characters }),
  }));
  for (let i = 0; i < 10; i++) assert.equal((await consume('one', 1500)).status, 204);
  assert.equal((await consume('one', 1)).status, 429);
  for (let i = 0; i < 10; i++) assert.equal((await consume('two', 1000)).status, 204);
  assert.equal((await consume('three', 1)).status, 429);
  Date.now.mock.mockImplementation(() => 1_800_000_000_000 + 86_400_000);
  assert.equal((await consume('one', 1)).status, 204);
});
