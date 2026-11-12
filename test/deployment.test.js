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

test('maps OpenWeatherMap data to the frontend weather response', async () => {
  const previousKey = process.env.WEATHER_API_KEY;
  const originalFetch = global.fetch;
  process.env.WEATHER_API_KEY = 'test-weather-key';
  let requestedUrl;

  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.openweathermap.org/')) {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({
        name: 'Hyderabad',
        main: { temp: 30.1 },
        weather: [{ description: 'haze' }]
      }), { status: 200 });
    }
    return originalFetch(url, options);
  };

  try {
    const response = await fetch(`${baseUrl()}/api/weather/current?lat=17.3753&lon=78.4744`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      location: { name: 'Hyderabad' },
      current: { temp_c: 30.1, condition: { text: 'haze' } }
    });
    assert.equal(requestedUrl.hostname, 'api.openweathermap.org');
    assert.equal(requestedUrl.searchParams.get('lat'), '17.3753');
    assert.equal(requestedUrl.searchParams.get('lon'), '78.4744');
    assert.equal(requestedUrl.searchParams.get('units'), 'metric');
    assert.equal(requestedUrl.searchParams.get('appid'), 'test-weather-key');
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.WEATHER_API_KEY;
    else process.env.WEATHER_API_KEY = previousKey;
  }
});
