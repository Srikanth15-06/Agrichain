const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '.env') });

const uploadDirectory = require('./config/uploadDirectory');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const produceRoutes = require('./routes/produceRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cartRoutes = require('./routes/cartRoutes');
const contractRoutes = require('./routes/contractRoutes');
const weatherRoutes = require('./routes/weatherRoutes');

const app = express();
const frontendDirectory = path.join(__dirname, '../frontend');

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));

const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
  ...(process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5000',
        'http://127.0.0.1:5000'
      ])
].map(origin => origin && origin.trim().replace(/\/+$/, '')).filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  }
}));

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/readyz', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', profileRoutes);
app.use('/api/produce', produceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/uploads', express.static(uploadDirectory));
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});
app.use(express.static(frontendDirectory));
app.use((req, res) => {
  res.status(404).send('Not found');
});

async function start() {
  await connectDB();
  const port = Number(process.env.PORT) || 5000;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`AgriChain listening on port ${port}`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

if (require.main === module) {
  start()
    .then(server => {
      const shutdown = () => {
        server.close(async () => {
          await mongoose.disconnect();
          process.exit(0);
        });
      };
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    })
    .catch(error => {
      console.error(`AgriChain startup failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { app, start };
