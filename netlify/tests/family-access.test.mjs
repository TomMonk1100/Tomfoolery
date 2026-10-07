import { describe, expect, it, vi } from 'vitest';
import { familyUrl, getFamily, login, ORIGIN } from '../../scripts/family-access.mjs';

const COOKIE = `__Host-tf-family=${'a'.repeat(64)}`;
const successfulLogin = () => new Response(null, {
  status: 303,
  headers: { location: '/family/', 'set-cookie': `${COOKIE}; Path=/; Secure; HttpOnly; SameSite=Lax` },
});

describe('private family access helper', () => {
  it.each(['/family/', '/family/person/person-id/', '/family/details/person-id.json', '/family/record/source/source-id/', '/images/family/photo.jpg'])('allows a protected local path: %s', path => {
    expect(familyUrl(path).href).toBe(`${ORIGIN}${path}`);
  });

  it.each([
    'https://example.com/family/', '//example.com/family/', '/coffee',
    '/family/../../api/scores', '/family/%2e%2e/coffee',
    '/family/%2e%2e%2fcoffee', '/family/\\example.com',
    '/family/%5cexample.com', '/family/\nexample.com',
  ])('rejects paths that could expose a session or leave family scope: %s', async path => {
    const request = vi.fn();
    await expect(getFamily(path, COOKIE, request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it('logs in with the normal POST and retains only the cookie pair', async () => {
    const request = vi.fn(async () => successfulLogin());
    expect(await login('test-only-password', request)).toBe(COOKIE);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/family/__auth`);
    expect(options.redirect).toBe('manual');
    expect(options.method).toBe('POST');
    expect(options.body.get('password')).toBe('test-only-password');
    expect(options.body.get('next')).toBe('/family/');
  });

  it('does not request the network without a password', async () => {
    const request = vi.fn();
    await expect(login('', request)).rejects.toThrow('missing');
    expect(request).not.toHaveBeenCalled();
  });

  it.each([401, 503])('fails closed after a rejected login (HTTP %s)', async status => {
    await expect(login('test-only-password', async () => new Response(null, { status }))).rejects.toThrow('login failed');
  });

  it('rejects an unexpected login redirect even when a cookie is present', async () => {
    const response = successfulLogin();
    response.headers.set('location', 'https://example.com/');
    await expect(login('test-only-password', async () => response)).rejects.toThrow('login failed');
  });

  it.each(['', `${COOKIE}; Path=/`, '__Host-tf-family=forged; Secure; HttpOnly'])('rejects missing or unexpected session cookies', async value => {
    const response = successfulLogin();
    response.headers.set('set-cookie', value);
    await expect(login('test-only-password', async () => response)).rejects.toThrow('secure session cookie');
  });

  it('fetches with the cookie but refuses to follow a protected-page redirect', async () => {
    const request = vi.fn(async () => new Response(null, {
      status: 302, headers: { location: 'https://example.com/' },
    }));
    await expect(getFamily('/family/', COOKIE, request)).rejects.toThrow('HTTP 302');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]).toMatchObject({ redirect: 'manual', headers: { cookie: COOKIE } });
  });
});
