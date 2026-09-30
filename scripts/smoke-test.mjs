import assert from 'node:assert/strict';

const api = process.env.API_URL ?? 'http://localhost:5080';
const frontend = process.env.FRONTEND_URL ?? 'http://localhost:4200';

async function checkHealth(baseUrl) {
  const response = await fetch(new URL('/api/health', baseUrl), {
    signal: AbortSignal.timeout(10_000)
  });
  assert.equal(response.status, 200, `Health request failed at ${baseUrl}`);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.deepEqual(await response.json(), { status: 'Healthy', service: 'My Library API' });
  console.log(`PASS health: ${baseUrl}/api/health`);
}

try {
  await checkHealth(api);
  const page = await fetch(frontend, { signal: AbortSignal.timeout(10_000) });
  assert.equal(page.status, 200, 'Frontend did not serve successfully');
  assert.match(await page.text(), /<app-root><\/app-root>/);
  console.log(`PASS application page: ${frontend}`);
  await checkHealth(frontend);
} catch (error) {
  console.error('Smoke check failed. Start both development servers first.');
  console.error(error);
  process.exitCode = 1;
}
