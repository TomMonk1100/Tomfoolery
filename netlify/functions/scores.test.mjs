import { describe, expect, it } from 'vitest';
import { createScoresHandler, normalizeScores } from './scores.mjs';

class FakeStore {
  constructor(scores) {
    this.data = scores || [];
    this.hasEntry = scores !== undefined;
    this.etag = '0';
    this.writeCount = 0;
  }

  async getWithMetadata() {
    // Let two callers observe the same version before either attempts its CAS.
    await Promise.resolve();
    if (!this.hasEntry) return null;
    return { data: structuredClone(this.data), etag: this.etag };
  }

  async setJSON(_key, value, options) {
    if (options.onlyIfMatch && options.onlyIfMatch !== this.etag) return { modified: false };
    if (options.onlyIfNew && this.hasEntry) return { modified: false };
    this.data = structuredClone(value);
    this.hasEntry = true;
    this.etag = String(Number(this.etag) + 1);
    this.writeCount += 1;
    return { modified: true, etag: this.etag };
  }
}

const request = (method, body, headers = {}) => new Request('https://example.test/api/scores', {
  method,
  headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const handlerFor = (store, now = () => 1_000) => createScoresHandler({
  storeFactory: () => store,
  now,
  sleep: async () => {},
});

describe('leaderboard score validation', () => {
  it('rejects null, arrays, null fields, and oversized request bodies', async () => {
    const store = new FakeStore();
    const handler = handlerFor(store);

    expect((await handler(request('POST', null))).status).toBe(400);
    expect((await handler(request('POST', []))).status).toBe(400);
    expect((await handler(request('POST', { name: 'Tom', level: null, difficulty: 'pilot' }))).status).toBe(400);

    const oversized = new Request('https://example.test/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(2_050), level: 1, difficulty: 'pilot' }),
    });
    expect((await handler(oversized)).status).toBe(413);
  });

  it('keeps the best existing score and safely ignores corrupt legacy rows', async () => {
    const store = new FakeStore([
      null,
      { name: 'TEST PILOT', level: 999, difficulty: 'ace', ts: 1 },
      { name: 'Tom', level: 8, difficulty: 'pilot', ts: 10 },
    ]);
    const handler = handlerFor(store);

    const kept = await handler(request('POST', { name: 'Tom', level: 7, difficulty: 'pilot' }));
    expect(kept.status).toBe(200);
    expect(await kept.json()).toMatchObject({ ok: true, kept: 'existing' });
    expect(store.writeCount).toBe(0);

    const listed = await handler(request('GET'));
    expect(await listed.json()).toEqual([{ name: 'Tom', level: 8, difficulty: 'pilot', ts: 10 }]);
  });
});

describe('leaderboard conditional writes', () => {
  it('retries a CAS conflict so concurrent submissions remain visible', async () => {
    const store = new FakeStore();
    const first = handlerFor(store, () => 1_000);
    const second = handlerFor(store, () => 1_001);

    const results = await Promise.all([
      first(request('POST', { name: 'ALPHA', level: 12, difficulty: 'pilot' })),
      second(request('POST', { name: 'BRAVO', level: 11, difficulty: 'ace' })),
    ]);
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(store.writeCount).toBe(2);

    const listed = await first(request('GET'));
    expect(await listed.json()).toEqual([
      { name: 'ALPHA', level: 12, difficulty: 'pilot', ts: 1_000 },
      { name: 'BRAVO', level: 11, difficulty: 'ace', ts: 1_001 },
    ]);
  });

  it('normalizes only valid legacy rows without throwing on a bad root', () => {
    expect(normalizeScores(null)).toEqual([]);
    expect(normalizeScores([{ name: 'A', level: '4', difficulty: 'cadet', ts: 2 }, { level: 3 }]))
      .toEqual([{ name: 'A', level: 4, difficulty: 'cadet', ts: 2 }]);
  });
});
