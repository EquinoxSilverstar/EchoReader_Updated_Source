import { decodeProtectedHeader, importPKCS8, importX509, jwtVerify, SignJWT } from 'jose';
import ttsCore from '../functions/src/tts-core.js';

const { createTtsHandler } = ttsCore;
const CERTIFICATES = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TTS_ORIGIN = 'https://texttospeech.googleapis.com';
const MAX_BODY_BYTES = 16_384;
const BASE_HEADERS = { 'Cache-Control': 'no-store', Vary: 'Origin' };
const ALLOWED_ORIGINS = new Set([
  'https://equinoxsilverstar.github.io',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
]);

let certificates;
let refreshCertificates;
let googleAccess;

async function firebaseKey(kid) {
  if (!certificates || Date.now() >= certificates.expires) {
    refreshCertificates ??= (async () => {
      const response = await fetch(CERTIFICATES, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok) throw new Error('Firebase certificate service unavailable');
      const ttl = Number(/(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('Cache-Control') || '')?.[1] || 0);
      const age = Number(response.headers.get('Age') || 0);
      const entries = await response.json();
      const keys = new Map(await Promise.all(Object.entries(entries).map(async ([id, certificate]) =>
        [id, await importX509(certificate, 'RS256')],
      )));
      certificates = { keys, expires: Date.now() + Math.max(0, ttl - age) * 1000 };
    })().finally(() => { refreshCertificates = undefined; });
    await refreshCertificates;
  }
  const key = certificates.keys.get(kid);
  if (!key) throw new Error('Unknown Firebase signing key');
  return key;
}

async function verifyFirebaseToken(token, project) {
  if (!project || token.length > 8192) throw new Error('Invalid session');
  const { alg, kid } = decodeProtectedHeader(token);
  if (alg !== 'RS256' || typeof kid !== 'string' || !kid) throw new Error('Invalid session header');
  const { payload } = await jwtVerify(token, await firebaseKey(kid), {
    algorithms: ['RS256'],
    issuer: 'https://securetoken.google.com/' + project,
    audience: project,
    requiredClaims: ['exp', 'iat', 'sub', 'auth_time'],
  });
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== project || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
      !Number.isInteger(payload.iat) || payload.iat > now ||
      !Number.isInteger(payload.auth_time) || payload.auth_time < 0 || payload.auth_time > payload.iat ||
      !payload.firebase?.sign_in_provider || payload.firebase.sign_in_provider === 'anonymous') {
    throw new Error('Invalid Firebase session claims');
  }
  return { uid: payload.sub };
}

async function googleAccessToken(secret) {
  const account = JSON.parse(secret);
  if (account.type !== 'service_account' || !account.client_email || !account.private_key) {
    throw new Error('Invalid Google service account');
  }
  if (googleAccess?.secret === secret && googleAccess.expires > Date.now()) return googleAccess.token;
  const key = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', kid: account.private_key_id })
    .setIssuer(account.client_email)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('55m')
    .sign(key);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Google service account token exchange failed');
  const { access_token: token, expires_in: expiresIn } = await response.json();
  if (typeof token !== 'string' || !token || !Number.isFinite(expiresIn)) {
    throw new Error('Invalid Google token response');
  }
  googleAccess = { secret, token, expires: Date.now() + Math.max(0, expiresIn - 60) * 1000 };
  return token;
}

function providerFetch(secret) {
  return async (url, options) => {
    const headers = new Headers(options.headers);
    if (new URL(url).origin === GOOGLE_TTS_ORIGIN) {
      headers.delete('X-Goog-Api-Key');
      try {
        headers.set('Authorization', 'Bearer ' + await googleAccessToken(secret));
      } catch {
        return new Response(null, { status: 403 });
      }
    }
    return fetch(url, { ...options, headers, redirect: 'error' });
  };
}

class BodyTooLarge extends Error {}

async function readBody(request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const value = JSON.parse(body + decoder.decode());
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError();
        return value;
      }
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function asFetchResponse() {
  let status;
  const headers = new Headers(BASE_HEADERS);
  return {
    status(code) { status = code; return this; },
    set(nameOrEntries, value) {
      if (typeof nameOrEntries === 'string') {
        headers.set(nameOrEntries, value);
      } else {
        for (const [key, entryValue] of Object.entries(nameOrEntries)) headers.set(key, entryValue);
      }
      return this;
    },
    json(value) { headers.set('Content-Type', 'application/json'); return new Response(JSON.stringify(value), { status, headers }); },
    send(value) { return new Response(status === 204 ? null : value, { status, headers }); },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ service: 'echoreader-voices', ready: Boolean(env.USAGE) }, {
        status: env.USAGE ? 200 : 503, headers: BASE_HEADERS,
      });
    }
    const googleSecret = env.GOOGLE_TTS_SERVICE_ACCOUNT?.trim();
    const handler = createTtsHandler({
      auth: { verifyIdToken: (token) => verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID) },
      getProviderKeys: () => ({ eleven: env.ELEVENLABS_API_KEY?.trim(), google: googleSecret ? 'oauth' : '' }),
      fetchImpl: providerFetch(googleSecret),
      allowedOrigins: ALLOWED_ORIGINS,
      usage: {
        async consume(uid, characters) {
          if (!env.USAGE) throw new Error('Usage budget is not configured');
          const budget = env.USAGE.get(env.USAGE.idFromName('production'));
          const response = await budget.fetch('https://usage.internal/consume', {
            method: 'POST', body: JSON.stringify({ uid, characters }),
          });
          if (response.status === 429) {
            const { error } = await response.json();
            throw Object.assign(new Error(error), { code: 'resource-exhausted' });
          }
          if (!response.ok) throw new Error('Usage budget unavailable');
        },
      },
    });

    let body;
    if (request.method === 'POST' && url.pathname === '/tts' &&
        (!request.headers.has('Origin') || ALLOWED_ORIGINS.has(request.headers.get('Origin'))) &&
        /^Bearer\s+\S+$/i.test(request.headers.get('Authorization') || '')) {
      try {
        body = await readBody(request);
      } catch (error) {
        const res = asFetchResponse();
        const origin = request.headers.get('Origin');
        if (origin) res.set({ 'Access-Control-Allow-Origin': origin });
        return error instanceof BodyTooLarge
          ? res.status(413).json({ error: 'The narration request is too large.' })
          : res.status(400).json({ error: 'Request body must be valid JSON.' });
      }
    }
    return handler({
      method: request.method,
      path: url.pathname,
      query: { provider: url.searchParams.get('provider') },
      get: (name) => request.headers.get(name),
      body,
    }, asFetchResponse());
  },
};

const MAX_ACCOUNT_DAILY_CHARACTERS = 25_000;
const MAX_ACCOUNT_DAILY_REQUESTS = 250;

export class UsageBudget {
  constructor(ctx) {
    this.storage = ctx.storage;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS usage (
      id TEXT PRIMARY KEY, day INTEGER, minute INTEGER, minute_requests INTEGER,
      requests INTEGER, characters INTEGER
    )`);
  }

  async fetch(request) {
    const { uid, characters } = await request.json();
    const minute = Math.floor(Date.now() / 60_000);
    const day = Math.floor(minute / 1440);
    const userId = 'user:' + uid;

    return this.storage.transactionSync(() => {
      const read = (id) => this.sql.exec('SELECT * FROM usage WHERE id = ? AND day = ?', id, day).toArray()[0];
      const global = read('global');
      const user = read(userId);
      const minuteRequests = user?.minute === minute ? user.minute_requests : 0;
      if (minuteRequests >= 10 || (user?.requests ?? 0) >= ttsCore.MAX_DAILY_REQUESTS ||
          (user?.characters ?? 0) + characters > ttsCore.MAX_DAILY_CHARACTERS ||
          (global?.requests ?? 0) >= MAX_ACCOUNT_DAILY_REQUESTS ||
          (global?.characters ?? 0) + characters > MAX_ACCOUNT_DAILY_CHARACTERS) {
        return Response.json({ error: 'Cloud narration has reached a usage limit. Try later or use a device voice.' }, { status: 429 });
      }

      if (!global) this.sql.exec('DELETE FROM usage WHERE day < ?', day);
      const write = (id, row, currentMinuteRequests) => {
        this.sql.exec('INSERT OR REPLACE INTO usage VALUES (?, ?, ?, ?, ?, ?)',
          id, day, minute, currentMinuteRequests + 1, (row?.requests ?? 0) + 1,
          (row?.characters ?? 0) + characters);
      };
      write('global', global, 0);
      write(userId, user, minuteRequests);
      return new Response(null, { status: 204 });
    });
  }
}
