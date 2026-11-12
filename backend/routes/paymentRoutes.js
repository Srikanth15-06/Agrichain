const express = require('express');
const router = express.Router();
const { createCheckoutSession, stripeWebhook, generateInvoice } = require('../controllers/paymentController');
const verifyToken = require('../middleware/authMiddleware');

// ✅ This MUST be here
router.post('/webhook', express.raw({ type: 'json' }), stripeWebhook);

router.post('/create-checkout-session', verifyToken, createCheckoutSession);
router.get('/invoice/:id', verifyToken, generateInvoice);

module.exports = router;
