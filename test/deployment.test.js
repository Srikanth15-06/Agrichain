const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-that-is-not-used-for-auth';
const { app } = require('../backend/server');
const server = app.listen(0);

before(() => new Promise(resolve => server.once('listening', resolve)));
after(() => new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve());
}));

const baseUrl = () => `http://127.0.0.1:${server.address().port}`;

test('serves health, readiness, and frontend assets', async () => {
  const health = await fetch(`${baseUrl()}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const readiness = await fetch(`${baseUrl()}/readyz`);
  assert.ok([200, 503].includes(readiness.status));

  const frontend = await fetch(`${baseUrl()}/`);
  assert.equal(frontend.status, 200);
  assert.match(await frontend.text(), /<!DOCTYPE html/i);

  const config = await fetch(`${baseUrl()}/api-config.js`);
  assert.equal(config.status, 200);
  assert.match(await config.text(), /API_BASE_URL/);
});

test('returns a clear API 404 and validates weather coordinates', async () => {
  const missingRoute = await fetch(`${baseUrl()}/api/not-a-route`);
  assert.equal(missingRoute.status, 404);
  assert.deepEqual(await missingRoute.json(), { message: 'API route not found' });

  const invalidCoordinates = await fetch(`${baseUrl()}/api/weather/current?lat=100&lon=0`);
  assert.equal(invalidCoordinates.status, 400);
});
