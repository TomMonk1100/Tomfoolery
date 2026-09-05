// Global leaderboard for the Moon Lander game.
// Netlify Function (v2 API) + Netlify Blobs for persistence.
// Bundled by Netlify's esbuild at build time (see netlify.toml);
// @netlify/blobs is declared in package.json dependencies.
//
// GET  /api/scores  -> top 25 [{name, level, difficulty, ts}]
// POST /api/scores  -> {name, level, difficulty}
import { getStore } from '@netlify/blobs';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const STORE_OPTIONS = { name: 'lander-leaderboard', consistency: 'strong' };
const SCORES_KEY = 'scores';
const MAX_BODY_BYTES = 2 * 1024;
const MAX_STORED_SCORES = 100;
const MAX_WRITE_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_POSTS_PER_WINDOW = 12;
const VALID_DIFFICULTIES = new Set(['cadet', 'pilot', 'ace']);

const response = (body, status = 200, extraHeaders = {}) => new Response(
  JSON.stringify(body),
  { status, headers: { ...JSON_HEADERS, ...extraHeaders } },
);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Stored data predates this validation. Keep valid legacy rows readable while
// making null, malformed entries, or a corrupt root value harmless.
export function normalizeScores(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!isRecord(row) || typeof row.name !== 'string' || !VALID_DIFFICULTIES.has(row.difficulty)) {
      return [];
    }
    const level = typeof row.level === 'number' ? row.level : Number(row.level);
    if (!Number.isInteger(level) || !Number.isFinite(level)) return [];
    const ts = typeof row.ts === 'number' && Number.isFinite(row.ts) ? row.ts : 0;
    return [{ name: row.name, level: Math.max(1, Math.min(999, level)), difficulty: row.difficulty, ts }];
  });
}

export function rankScores(value) {
  return normalizeScores(value)
    .filter((score) => score.name !== 'TEST PILOT')
    .sort((a, b) => b.level - a.level || a.ts - b.ts);
}

class PayloadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PayloadError';
  }
}

class PayloadTooLargeError extends PayloadError {}

async function readBody(req) {
  const contentLength = req.headers.get('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError('payload too large');
  }

  // Read by chunks so a client cannot bypass the Content-Length check with a
  // chunked request and make the function buffer an unbounded body.
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError('payload too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseLevel(value) {
  if (value === undefined) return 1;
  let parsed;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) throw new PayloadError('invalid payload');
    parsed = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    parsed = Number(value.trim());
  } else {
    throw new PayloadError('invalid payload');
  }
  // Keep the old endpoint's bounds for clients that send an out-of-range
  // integer, while rejecting values that are not score-shaped integers.
  return Math.max(1, Math.min(999, parsed));
}

export function parseScorePayload(body) {
  if (!isRecord(body)) throw new PayloadError('invalid payload');
  if ('name' in body && typeof body.name !== 'string') throw new PayloadError('invalid payload');
  if ('difficulty' in body && (typeof body.difficulty !== 'string' || !VALID_DIFFICULTIES.has(body.difficulty))) {
    throw new PayloadError('invalid payload');
  }

  const rawName = body.name === undefined
    ? ''
    : body.name.replace(/[^a-zA-Z0-9 _\-\.]/g, '').trim();
  const name = rawName.slice(0, 12) || 'ANON';
  const level = parseLevel(body.level);
  const difficulty = body.difficulty === undefined ? 'pilot' : body.difficulty;
  return { name, level, difficulty };
}

function clientKey(req, context) {
  if (context?.ip) return context.ip;
  const netlifyIp = req.headers.get('x-nf-client-connection-ip');
  if (netlifyIp) return netlifyIp;
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}

function makeRateLimiter(now) {
  const attempts = new Map();
  return (req, context) => {
    const key = clientKey(req, context);
    const current = now();
    const prior = attempts.get(key);
    const windowStart = prior && current - prior.startedAt < RATE_LIMIT_WINDOW_MS
      ? prior.startedAt
      : current;
    const count = prior && windowStart === prior.startedAt ? prior.count + 1 : 1;
    attempts.set(key, { startedAt: windowStart, count });

    // Keep this warm-instance guard bounded if a function instance sees many
    // distinct addresses. It is deliberately best effort; this board is not
    // presented as an anti-cheat or verified competitive system.
    if (attempts.size > 2048) {
      for (const [address, entry] of attempts) {
        if (current - entry.startedAt >= RATE_LIMIT_WINDOW_MS) attempts.delete(address);
      }
    }
    if (count > MAX_POSTS_PER_WINDOW) {
      const retryAfter = Math.max(1, Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - current) / 1000));
      return retryAfter;
    }
    return 0;
  };
}

async function readVersion(store) {
  const entry = await store.getWithMetadata(SCORES_KEY, { type: 'json', consistency: 'strong' });
  if (!entry) return { scores: [], etag: null };
  return { scores: rankScores(entry.data), etag: entry.etag || null };
}

async function updateScores(store, score, now, sleep) {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const { scores, etag } = await readVersion(store);
    const existing = scores.findIndex((row) => row.name === score.name && row.difficulty === score.difficulty);
    if (existing >= 0 && scores[existing].level >= score.level) {
      return { kept: 'existing' };
    }

    const next = existing >= 0 ? scores.toSpliced(existing, 1) : scores.slice();
    next.push({ ...score, ts: now() });
    next.sort((a, b) => b.level - a.level || a.ts - b.ts);
    const writeOptions = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const result = await store.setJSON(SCORES_KEY, next.slice(0, MAX_STORED_SCORES), writeOptions);
    // Keep the existing POST response shape (`{ ok: true }`) for a new row.
    if (result.modified) return {};
    if (attempt + 1 < MAX_WRITE_ATTEMPTS) await sleep(Math.min(25 * (2 ** attempt), 200));
  }
  throw new Error('score write contention');
}

export function createScoresHandler({ storeFactory = getStore, now = () => Date.now(), sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const allowPost = makeRateLimiter(now);
  return async (req, context) => {
    if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: JSON_HEADERS });

    const store = storeFactory(STORE_OPTIONS);
    if (req.method === 'GET') {
      const entry = await store.getWithMetadata(SCORES_KEY, { type: 'json', consistency: 'strong' });
      return response(rankScores(entry?.data).slice(0, 25));
    }

    if (req.method === 'POST') {
      const retryAfter = allowPost(req, context);
      if (retryAfter) return response({ error: 'rate limited' }, 429, { 'retry-after': String(retryAfter) });

      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (error) {
        if (error instanceof PayloadTooLargeError) return response({ error: 'payload too large' }, 413);
        return response({ error: 'bad json' }, 400);
      }

      let score;
      try {
        score = parseScorePayload(body);
      } catch {
        return response({ error: 'invalid payload' }, 400);
      }

      try {
        const result = await updateScores(store, score, now, sleep);
        return response({ ok: true, ...result });
      } catch {
        return response({ error: 'temporarily unavailable' }, 503, { 'retry-after': '1' });
      }
    }

    return response({ error: 'method not allowed' }, 405);
  };
}

export default createScoresHandler();
export const config = { path: '/api/scores' };
