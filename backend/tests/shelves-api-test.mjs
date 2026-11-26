// First: dotnet build backend/MyLibrary.Api --configuration Verification
// Then: node backend/tests/shelves-api-test.mjs (from the repository root)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

const directory = mkdtempSync(join(tmpdir(), 'mylibrary-shelves-'));
const database = join(directory, 'library.db');
const probe = createServer();
await new Promise(r => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port;
await new Promise(r => probe.close(r));
const baseUrl = `http://127.0.0.1:${port}`;
let api;
let exited;
let output = '';
async function start() {
  api = spawn('dotnet', [resolve('backend/MyLibrary.Api/bin/Verification/net10.0/MyLibrary.Api.dll')], {
    cwd: resolve('backend/MyLibrary.Api'), windowsHide: true,
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: baseUrl,
      ConnectionStrings__Library: `Data Source=${database}`, Logging__EventLog__LogLevel__Default: 'None' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout.on('data', data => { output += data; });
  api.stderr.on('data', data => { output += data; });
  exited = new Promise(r => api.once('exit', r));
  for (let i = 0; i < 100; i++) {
    if (api.exitCode !== null) throw new Error(output);
    try {
      if ((await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch { /* Wait for startup and development migrations. */ }
    await delay(100);
  }
  throw new Error(`API did not start. ${output}`);
}
async function stop() {
  if (api && api.exitCode === null) { api.kill(); await exited; }
}
async function request(path, method = 'GET', body, status = 200) {
  const response = await fetch(baseUrl + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text}\n${output}`);
  return { body: text ? JSON.parse(text) : null, headers: response.headers };
}
const shelves = '/api/shelves';
const books = '/api/library/books';
try {
  await start();
  assert.deepEqual((await request(shelves)).body, []);
  for (const invalid of [{}, { name: '   ' }, { name: 'x'.repeat(201) },
    { name: 'Shelf', room: 'x'.repeat(201) }, { name: 'Shelf', description: 'x'.repeat(2001) },
    { name: 'Shelf', bookIds: null }, { name: 'Shelf', bookIds: ['00000000-0000-0000-0000-000000000000'] },
    { name: 'Shelf', bookIds: [randomUUID()] }]) {
    await request(shelves, 'POST', invalid, 400);
  }
  assert.deepEqual((await request(shelves)).body, []);
  const first = (await request(books, 'POST', { title: 'First book', shelfLocation: 'Legacy location' }, 201)).body;
  const second = (await request(books, 'POST', { title: 'Second book' }, 201)).body;
  const created = await request(shelves, 'POST', {
    name: '  Favorites  ', room: ' Study ', description: ' My favorites ', bookIds: [first.id],
  }, 201);
  const shelf = created.body;
  assert.equal(created.headers.get('location'), `${shelves}/${shelf.id}`);
  assert.match(shelf.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(shelf, { id: shelf.id, name: 'Favorites', room: 'Study', description: 'My favorites', bookIds: [first.id] });
  assert.deepEqual((await request(`${shelves}/${shelf.id}`)).body, shelf);
  assert.equal((await request(`${books}/${first.id}`)).body.shelfId, shelf.id);
  assert.equal((await request(`${books}/${first.id}`)).body.title, 'First book');
  assert.equal((await request(`${books}/${first.id}`)).body.shelfLocation, 'Legacy location');
  const third = (await request(books, 'POST', { title: 'Book on selected shelf', shelfId: shelf.id }, 201)).body;
  assert.equal(third.shelfId, shelf.id);
  assert.deepEqual((await request(`${shelves}/${shelf.id}`)).body.bookIds.sort(), [first.id, third.id].sort());
  await request(books, 'POST', { title: 'Invalid shelf', shelfId: randomUUID() }, 400);
  await request(shelves, 'POST', { name: 'Duplicates', bookIds: [first.id, first.id] }, 400);

  await request(`${shelves}/${shelf.id}`, 'PUT', { name: 'Updated', room: ' Bedroom ', bookIds: [second.id] });
  assert.equal((await request(`${books}/${first.id}`)).body.shelfId, null);
  assert.equal((await request(`${books}/${third.id}`)).body.shelfId, null);
  const other = (await request(shelves, 'POST', { name: 'Another shelf' }, 201)).body;
  assert.deepEqual(other.bookIds, []);
  assert.equal(other.room, null);
  assert.equal(other.description, null);
  const moved = (await request(`${shelves}/${other.id}`, 'PUT', {
    name: 'Renamed shelf', room: 'Living room', description: '  ', bookIds: [second.id],
  })).body;
  assert.equal(moved.description, null);
  assert.deepEqual((await request(`${shelves}/${shelf.id}`)).body.bookIds, []);
  assert.equal((await request(`${books}/${second.id}`)).body.shelfId, other.id);
  assert.equal((await request(`${books}/${second.id}`)).body.title, 'Second book');
  await request(`${shelves}/${other.id}`, 'PUT', { name: 'Rejected update', bookIds: [randomUUID()] }, 400);
  await request(`${shelves}/${other.id}`, 'PUT', { name: '', bookIds: [] }, 400);
  assert.deepEqual((await request(`${shelves}/${other.id}`)).body, moved);
  await request(`${shelves}/${other.id}`, 'PUT', { ...moved, name: 'Renamed again' });
  const expected = (await request(`${shelves}/${other.id}`)).body;
  assert.deepEqual(expected.bookIds, [second.id]);
  assert.equal((await request(shelves)).body.length, 2);

  await stop();
  await start();
  assert.deepEqual((await request(`${shelves}/${other.id}`)).body, expected);
  await request(`${shelves}/${other.id}`, 'DELETE', undefined, 204);
  await request(`${shelves}/${other.id}`, 'GET', undefined, 404);
  assert.equal((await request(`${books}/${second.id}`)).body.shelfId, null);
  assert.equal((await request(books)).body.length, 3);
  assert.deepEqual((await request(books)).body.map(book => book.title).sort(),
    ['First book', 'Second book', 'Book on selected shelf'].sort());
  for (const method of ['GET', 'PUT', 'DELETE']) {
    await request(`${shelves}/${randomUUID()}`, method, method === 'PUT' ? { name: 'Missing' } : undefined, 404);
  }
  await request(`${shelves}/${shelf.id}`, 'DELETE', undefined, 204);
  assert.deepEqual((await request(shelves)).body, []);
  console.log('PASS: shelf CRUD, validation, book assignment, moving/removing books, restart persistence, and safe deletion.');
} finally {
  await stop();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith('mylibrary-shelves-'));
  rmSync(directory, { recursive: true, force: true });
}
