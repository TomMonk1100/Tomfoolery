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

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: JSON_HEADERS });
  }

  // Strong consistency: GETs are fresh and the POST read-modify-write
  // doesn't clobber recent submissions.
  const store = getStore({ name: 'lander-leaderboard', consistency: 'strong' });
  const clean = (rows) => rows.filter((s) => s.name !== 'TEST PILOT');

  if (req.method === 'GET') {
    const scores = clean((await store.get('scores', { type: 'json' })) || []);
    return new Response(JSON.stringify(scores.slice(0, 25)), { headers: JSON_HEADERS });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: JSON_HEADERS });
    }
    const name = String(body.name || '').replace(/[^a-zA-Z0-9 _\-\.]/g, '').trim().slice(0, 12) || 'ANON';
    const level = Math.max(1, Math.min(999, parseInt(body.level, 10) || 1));
    const difficulty = ['cadet', 'pilot', 'ace'].includes(body.difficulty) ? body.difficulty : 'pilot';

    const scores = clean((await store.get('scores', { type: 'json' })) || []);
    // One row per pilot name+difficulty — keep their best.
    const existing = scores.findIndex((s) => s.name === name && s.difficulty === difficulty);
    if (existing >= 0) {
      if (scores[existing].level >= level) {
        return new Response(JSON.stringify({ ok: true, kept: 'existing' }), { headers: JSON_HEADERS });
      }
      scores.splice(existing, 1);
    }
    scores.push({ name, level, difficulty, ts: Date.now() });
    scores.sort((a, b) => b.level - a.level || a.ts - b.ts);
    await store.setJSON('scores', scores.slice(0, 100));
    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: JSON_HEADERS });
};

export const config = { path: '/api/scores' };
