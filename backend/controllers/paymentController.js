const Stripe = require('stripe');
const Order = require('../models/Order');
const Produce = require('../models/Produce');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const getPublicUrl = require('../config/publicUrl');

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const deliveryAndHandlingFeePaise = 5000;

const createCheckoutSession = async (req, res) => {
  if (req.user.role !== 'buyer') {
    return res.status(403).json({ message: 'Only buyers can create checkout sessions' });
  }
  if (!stripe) {
    return res.status(503).json({ message: 'Card payments are not configured' });
  }

  const { produceId, quantity } = req.body;
  const quantityNumber = Number(quantity);
  if (
    !mongoose.Types.ObjectId.isValid(produceId) ||
    !Number.isFinite(quantityNumber) ||
    quantityNumber <= 0
  ) {
    return res.status(400).json({ message: 'A valid produceId and positive quantity are required' });
  }

  try {
    const produce = await Produce.findById(produceId);
    if (!produce || !produce.isApproved || produce.isRejected) {
      return res.status(404).json({ message: 'Approved produce not found' });
    }

    const availableQuantity = Number.parseFloat(produce.quantity);
    if (Number.isFinite(availableQuantity) && quantityNumber > availableQuantity) {
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }

    const subtotalPaise = Math.round(produce.pricePerKg * quantityNumber * 100);
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise <= 0) {
      return res.status(400).json({ message: 'Produce price is invalid' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: { name: produce.title },
            unit_amount: subtotalPaise + deliveryAndHandlingFeePaise
          },
          quantity: 1
        }
      ],
      metadata: {
        produceId: produce._id.toString(),
        buyerId: req.user.id,
        quantity: String(quantityNumber)
      },
      success_url: `${getPublicUrl(req)}/buyers/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getPublicUrl(req)}/buyers/cancel.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error.message);
    return res.status(500).json({ message: 'Failed to create checkout session' });
  }
};

const stripeWebhook = async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Stripe webhooks are not configured' });
  }

  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).send('Invalid webhook signature');
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ received: true });
  }

  const metadata = session.metadata || {};
  if (!metadata.produceId || !metadata.buyerId || !metadata.quantity) {
    console.error('Completed Stripe session is missing required order metadata');
    return res.status(500).json({ message: 'Order metadata is incomplete' });
  }

  try {
    const existingOrder = await Order.findOne({ stripeSessionId: session.id });
    if (!existingOrder) {
      await Order.create({
        produce: metadata.produceId,
        buyer: metadata.buyerId,
        quantity: metadata.quantity,
        amount: session.amount_total / 100,
        currency: session.currency,
        paymentMethod: session.payment_method_types?.[0] || 'card',
        stripeSessionId: session.id,
        status: 'pending'
      });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ received: true });
    }
    console.error('Failed to save paid Stripe order:', error.message);
    return res.status(500).json({ message: 'Failed to save paid order' });
  }
};

const generateInvoice = async (req, res) => {
  try {
    const orderQuery = mongoose.Types.ObjectId.isValid(req.params.id)
      ? Order.findById(req.params.id)
      : Order.findOne({ stripeSessionId: req.params.id });
    const order = await orderQuery
      .populate('buyer', 'name email')
      .populate('produce', 'title pricePerKg');
    if (!order || !order.buyer || !order.produce || !order.stripeSessionId) {
      return res.status(404).json({ message: 'Paid order not found or still processing' });
    }
    if (req.user.role !== 'admin' && order.buyer._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this invoice' });
    }

    const invoiceDirectory = path.join(__dirname, '../invoices');
    await fs.promises.mkdir(invoiceDirectory, { recursive: true });
    const filePath = path.join(invoiceDirectory, `invoice_${order._id}.pdf`);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.on('error', error => {
      console.error('Invoice PDF generation failed:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Could not generate invoice' });
      } else {
        res.destroy(error);
      }
    });
    stream.on('error', error => {
      console.error('Invoice file write failed:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Could not generate invoice' });
      } else {
        res.destroy(error);
      }
    });

    doc.pipe(stream);
    doc.fontSize(20).text('AgriChain Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order ID: ${order._id}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
    doc.text(`Buyer: ${order.buyer.name} (${order.buyer.email})`);
    doc.moveDown();
    doc.fontSize(14).text('Produce Purchased:');
    doc.fontSize(12).text(`Title: ${order.produce.title}`);
    doc.text(`Quantity: ${order.quantity} kg`);
    doc.text(`Price per Kg: INR ${order.produce.pricePerKg}`);
    doc.text(`Amount paid: INR ${order.amount}`);
    doc.text(`Payment Method: ${order.paymentMethod || 'Card'}`);
    doc.end();

    stream.on('finish', () => {
      res.download(filePath, `invoice_${order._id}.pdf`);
    });
  } catch (error) {
    console.error('Invoice request failed:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Could not generate invoice' });
    }
    return res.destroy(error);
  }
};

module.exports = {
  createCheckoutSession,
  stripeWebhook,
  generateInvoice
};
