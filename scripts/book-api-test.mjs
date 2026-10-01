// Deterministic API/adapter integration tests, using an HTTP provider stub.
// First: dotnet build backend/MyLibrary.Api -o backend/MyLibrary.Api/bin/verification
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

let mode = 'success';
const requests = [];
const volume = {
  id: 'edition-1', volumeInfo: {
    title: 'Example', subtitle: 'An edition', authors: ['First Author', 'Second Author'],
    publishedDate: '2021-03-04', industryIdentifiers: [
      { type: 'ISBN_13', identifier: '9781234567890' },
      { type: 'ISBN_10', identifier: '123456789X' },
      { type: 'OTHER', identifier: 'internal' },
    ], printType: 'BOOK', publisher: 'Example Press', description: '<p>A book &amp; its story.</p>',
    pageCount: 240, language: 'en', imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
  }, saleInfo: { isEbook: true },
};
const upstream = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  requests.push(url);
  res.setHeader('Content-Type', 'application/json');
  if (mode === 'timeout') return;
  if (mode === 'offline') { req.socket.destroy(); return; }
  if (mode === 'error') { res.writeHead(429); res.end('{}'); return; }
  if (mode === 'malformed') { res.end('invalid JSON'); return; }
  if (url.pathname.endsWith('/missing')) { res.writeHead(404); res.end('{}'); return; }
  if (url.pathname === '/volumes') {
    res.end(JSON.stringify(mode === 'empty' ? { totalItems: 0 } : { items: [volume,
      { id: 'edition-2', volumeInfo: { title: 'Example' } }], totalItems: 2 }));
  } else {
    res.end(JSON.stringify(mode === 'unsafe-cover' ? {
      ...volume, volumeInfo: { ...volume.volumeInfo, imageLinks: { thumbnail: 'http://127.0.0.1/private' } },
    } : volume));
  }
});
await new Promise(r => upstream.listen(0, '127.0.0.1', r));
const probe = createServer();
await new Promise(r => probe.listen(0, '127.0.0.1', r));
const apiPort = probe.address().port;
await new Promise(r => probe.close(r));
const api = `http://127.0.0.1:${apiPort}`;
const processUnderTest = spawn('dotnet', [resolve('backend/MyLibrary.Api/bin/verification/MyLibrary.Api.dll')], {
  cwd: resolve('backend/MyLibrary.Api'), windowsHide: true,
  env: { ...process.env, ASPNETCORE_URLS: api, Books__Provider: 'GoogleBooks',
    Books__BaseUrl: `http://127.0.0.1:${upstream.address().port}/`, Books__ApiKey: 'test-key' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
processUnderTest.stdout.on('data', chunk => { output += chunk; });
processUnderTest.stderr.on('data', chunk => { output += chunk; });
const exited = new Promise(r => processUnderTest.on('exit', r));
const get = path => fetch(api + path, { signal: AbortSignal.timeout(15000) });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await get('/api/health')).ok; } catch { /* wait for startup */ }
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, output);
  for (const path of ['/api/books', '/api/books?query=%20', '/api/books?query=test&field=bad', `/api/books?query=${'x'.repeat(201)}`])
    assert.equal((await get(path)).status, 400);
  assert.equal(requests.length, 0, 'Invalid searches must not reach the provider');

  for (const [field, query, expected] of [
    ['title', 'Example', 'intitle:Example'], ['author', 'First Author', 'inauthor:First Author'],
    ['isbn', '978-1 234567890', 'isbn:9781234567890'], ['all', 'books & stories', 'books & stories'],
  ]) {
    const response = await get(`/api/books?${new URLSearchParams({ query: ` ${query} `, field })}`);
    assert.equal(response.status, 200);
    const { books } = await response.json();
    assert.equal(requests.at(-1).searchParams.get('q'), expected);
    assert.equal(requests.at(-1).searchParams.get('key'), 'test-key');
    assert.equal(books.length, 2, 'Different editions remain separate');
    assert.deepEqual(books[0], {
      id: 'edition-1', title: 'Example', subtitle: 'An edition', authors: ['First Author', 'Second Author'],
      publicationYear: 2021, isbns: ['9781234567890', '123456789X'], format: 'eBook',
      coverUrl: '/api/books/edition-1/cover', publisher: 'Example Press',
      description: ' A book & its story. ', pageCount: 240, language: 'en',
    });
    assert.deepEqual(books[1].authors, []);
    assert.equal(books[1].publicationYear, null);
    assert.equal(books[1].coverUrl, null);
  }
  assert.equal((await (await get('/api/books/edition-1')).json()).pageCount, 240);
  assert.equal((await get('/api/books/missing')).status, 404);
  mode = 'unsafe-cover';
  assert.equal((await get('/api/books/edition-1/cover')).status, 404);
  mode = 'empty';
  assert.deepEqual(await (await get('/api/books?query=missing')).json(), { books: [] });
  for (mode of ['error', 'malformed', 'offline', 'timeout']) {
    const response = await get('/api/books?query=test');
    assert.equal(response.status, 503, mode);
    assert.equal((await response.json()).title, 'Book service unavailable');
  }
  assert.ok(!output.includes('test-key'), 'API keys must not appear in logs');
  console.log('PASS book API: validation, search fields, edition mapping, details, missing metadata, cover URL safety, empty results, errors, timeout, and key redaction');
} catch (error) {
  console.error(output.replaceAll('test-key', '[redacted]'));
  throw error;
} finally {
  processUnderTest.kill();
  await exited;
  upstream.closeAllConnections();
  await new Promise(r => upstream.close(r));
}
