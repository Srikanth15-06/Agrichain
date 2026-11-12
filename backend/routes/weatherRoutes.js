const express = require('express');

const router = express.Router();
const requestsByIp = new Map();
const rateWindowMs = 15 * 60 * 1000;
const maxRequestsPerWindow = 60;

router.get('/current', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({ message: 'Valid latitude and longitude are required' });
  }

  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: 'Weather service is not configured' });
  }

  const now = Date.now();
  const ip = req.ip;
  const previous = requestsByIp.get(ip);
  if (previous && now - previous.startedAt < rateWindowMs) {
    if (previous.count >= maxRequestsPerWindow) {
      res.set('Retry-After', String(Math.ceil((rateWindowMs - (now - previous.startedAt)) / 1000)));
      return res.status(429).json({ message: 'Weather request limit reached' });
    }
    previous.count += 1;
  } else {
    requestsByIp.set(ip, { startedAt: now, count: 1 });
  }

  if (requestsByIp.size > 1000) {
    for (const [requestIp, record] of requestsByIp) {
      if (now - record.startedAt >= rateWindowMs) requestsByIp.delete(requestIp);
    }
  }

  try {
    const query = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      appid: apiKey,
      units: 'metric'
    });
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${query}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) {
      console.error(`Weather provider returned ${response.status}`);
      return res.status(502).json({ message: 'Weather provider request failed' });
    }

    const weather = await response.json();
    if (
      !weather.name ||
      !Number.isFinite(Number(weather.main?.temp)) ||
      !weather.weather?.[0]?.description
    ) {
      return res.status(502).json({ message: 'Weather provider returned an invalid response' });
    }

    res.set('Cache-Control', 'private, max-age=300');
    return res.json({
      location: { name: weather.name },
      current: {
        temp_c: weather.main.temp,
        condition: { text: weather.weather[0].description }
      }
    });
  } catch (error) {
    console.error(`Weather provider request failed: ${error.message}`);
    return res.status(502).json({ message: 'Weather provider request failed' });
  }
});

module.exports = router;
