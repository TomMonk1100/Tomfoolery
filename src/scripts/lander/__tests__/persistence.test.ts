import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeSchemaTag } from '../persistence';

// §3: "Write localStorage.setItem('lander-schema', '10') on first load of
// the new build." No jsdom in this project (plan §1 permits only vitest as
// a new dev-dependency), so a tiny in-memory Storage stand-in is installed
// for just this file rather than pulling in a browser DOM.
function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

describe('persistence: writeSchemaTag', () => {
  const original = (globalThis as any).localStorage;

  afterEach(() => {
    (globalThis as any).localStorage = original;
  });

  it('sets lander-schema to "10" when localStorage is available', () => {
    const fake = makeFakeLocalStorage();
    (globalThis as any).localStorage = fake;
    writeSchemaTag();
    expect(fake.getItem('lander-schema')).toBe('10');
  });

  it('never throws when localStorage is unavailable (e.g. private browsing / SSR)', () => {
    delete (globalThis as any).localStorage;
    expect(() => writeSchemaTag()).not.toThrow();
  });

  it('never throws when localStorage.setItem itself throws (quota exceeded, etc.)', () => {
    (globalThis as any).localStorage = {
      setItem: () => { throw new Error('QuotaExceededError'); },
      getItem: () => null,
    };
    expect(() => writeSchemaTag()).not.toThrow();
  });
});
