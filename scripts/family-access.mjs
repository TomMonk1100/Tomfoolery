import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://tommuncie.com';
const COOKIE_NAME = '__Host-tf-family';

// Restrict credentials and session cookies to this site's protected routes.
// Never follow redirects: even a server redirect must not carry our cookie away.
export function familyUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') ||
      /[\\\s\u0000-\u001f]/u.test(path)) {
    throw new Error('Use a relative /family/ or /images/family/ path.');
  }
  const url = new URL(path, ORIGIN);
  const decoded = decodeURIComponent(url.pathname);
  if (url.origin !== ORIGIN || decoded.includes('\\') ||
      decoded.split('/').some(segment => segment === '..' || segment === '.') ||
      !(decoded === '/family' || decoded.startsWith('/family/') || decoded.startsWith('/images/family/'))) {
    throw new Error('Only this site’s protected family paths are allowed.');
  }
  url.hash = '';
  return url;
}

export async function login(password, request = fetch) {
  if (!password) throw new Error('Family password is missing. See docs/family-access.md.');
  const response = await request(`${ORIGIN}/family/__auth`, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password, next: '/family/' }),
  });
  if (response.status !== 303 || response.headers.get('location') !== '/family/') {
    throw new Error(`Family login failed (HTTP ${response.status}); no page was saved.`);
  }
  const cookie = response.headers.getSetCookie()
    .find(value => value.startsWith(`${COOKIE_NAME}=`));
  if (!cookie || !/^__Host-tf-family=[a-f0-9]{64};/u.test(cookie) ||
      !/;\s*Secure(?:;|$)/iu.test(cookie) || !/;\s*HttpOnly(?:;|$)/iu.test(cookie)) {
    throw new Error('Family login did not return the expected secure session cookie.');
  }
  return cookie.split(';')[0];
}

export async function getFamily(path, cookie, request = fetch) {
  const response = await request(familyUrl(path), {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
    headers: { cookie },
  });
  if (response.status !== 200) {
    throw new Error(`Protected page request failed (HTTP ${response.status}).`);
  }
  return response;
}

async function passwordFromLocalFile() {
  // An explicit environment override allows other trusted local sessions.
  if (process.env.FAMILY_PAGE_PASSWORD) return process.env.FAMILY_PAGE_PASSWORD;
  try {
    const file = resolve(ROOT, '.env.family.local');
    await chmod(file, 0o600);
    return parseEnv(await readFile(file, 'utf8')).FAMILY_PAGE_PASSWORD;
  } catch {
    throw new Error('Create the private .env.family.local file. See docs/family-access.md.');
  }
}

async function main() {
  const [command, path = '/family/'] = process.argv.slice(2);
  if (!['check', 'fetch'].includes(command)) {
    throw new Error('Use npm run family:check or npm run family:fetch -- /family/path/.');
  }
  familyUrl(path); // Validate before opening credentials or sending any request.
  const cookie = await login(await passwordFromLocalFile());
  if (command === 'fetch') {
    const response = await getFamily(path, cookie);
    const type = response.headers.get('content-type') ?? '';
    const extension = type.includes('text/html') ? 'html' : 'bin';
    const directory = resolve(ROOT, '.family-access');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const output = resolve(directory, `latest.${extension}`);
    await writeFile(output, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
    await chmod(output, 0o600);
    console.log(`Authenticated response saved privately to ${output}`);
    return;
  }

  // Select real existing routes from the local import; do not invent record IDs.
  const records = Object.values(JSON.parse(await readFile(resolve(ROOT, 'src/data/shared-family-records.json'), 'utf8')));
  const person = records.find(record => record.kind === 'person');
  const record = records.find(record => record.kind !== 'person');
  const image = records.flatMap(record => record.images).find(path => path.startsWith('/images/family/'));
  if (!person || !record || !image) throw new Error('Local import is missing a person, record, or image.');
  const paths = ['/family/', `/family/person/${person.id}/`, `/family/details/${person.id}.json`, `/family/record/${record.kind}/${record.id}/`, image];
  for (const path of paths) {
    const anonymous = await fetch(familyUrl(path), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (anonymous.status !== 401) {
      throw new Error(`Anonymous access expected HTTP 401, received ${anonymous.status}.`);
    }
    await anonymous.body?.cancel();
    const authenticated = await getFamily(path, cookie);
    const type = authenticated.headers.get('content-type') ?? '';
    if (path.startsWith('/images/') ? !type.startsWith('image/') : path.endsWith('.json') ? !type.includes('application/json') : !type.includes('text/html')) {
      throw new Error('Protected route returned an unexpected content type.');
    }
    if ((await authenticated.arrayBuffer()).byteLength === 0) throw new Error('Protected route returned an empty body.');
    console.log(`PASS: ${path} — anonymous 401; authenticated 200`);
  }
  console.log('Family access works through the normal password gate. No credentials or cookies were saved.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // Suppress raw exceptions, which can include network headers or credentials.
    console.error('Family access failed. Check the local password, network, and live gate; see docs/family-access.md.');
    process.exitCode = 1;
  });
}
