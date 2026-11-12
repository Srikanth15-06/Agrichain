const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Contract = require('../models/Contract');
const Order = require('../models/Order');
const mongoose = require('mongoose');

const generatePDF = async ({ seller, buyer, items }) => {
  const doc = new PDFDocument();
  const filename = `Contract_${seller._id}_${Date.now()}.pdf`;
  const contractDir = path.join(__dirname, '../contracts');
  await fs.promises.mkdir(contractDir, { recursive: true });
  const filePath = path.join(contractDir, filename);
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    doc.on('error', reject);
    stream.on('error', reject);
    stream.on('finish', resolve);
    doc.pipe(stream);
    doc.fontSize(12).text(`
Seller's Name: ${seller.name}
Seller's Address: ${seller.address || 'N/A'}

Buyer's Name: ${buyer.name}
Buyer's Address: ${buyer.address || 'N/A'}

This agreement is made on ${new Date().toDateString()}.

Crop Details:
${items.map(i => `- ${i.name} | Qty: ${i.quantity} | Price: ₹${i.price}`).join('\n')}

Total Amount: ₹${totalAmount}

Terms:
- As per Indian Contract Act, 1872
- Seller guarantees crops are in good condition
- Buyer has verified the quality
- Disputes subject to Indian courts

Signatures:
Seller: __________________
Buyer: __________________
Date: ${new Date().toDateString()}
  `);
    doc.end();
  });

  return { filePath, totalAmount };
};

exports.createContracts = async (req, res) => {
  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ message: 'Only buyers can generate contracts' });
    }

    const { orderId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'A valid orderId is required' });
    }

    const order = await Order.findById(orderId).populate('produce').populate('buyer', 'name address');
    if (!order || !order.produce || !order.buyer) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.buyer._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to generate this contract' });
    }
    if (!order.stripeSessionId) {
      return res.status(409).json({ message: 'A paid order is required to generate a contract' });
    }

    const produce = order.produce;
    const quantity = Number(order.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(produce.pricePerKg)) {
      return res.status(400).json({ message: 'Order details are invalid' });
    }

    const seller = await User.findById(produce.postedBy);
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const items = [{ name: produce.title, quantity, price: produce.pricePerKg }];
    const { filePath, totalAmount } = await generatePDF({ seller, buyer: order.buyer, items });
    await Contract.create({
      buyer: order.buyer._id,
      seller: seller._id,
      items,
      totalAmount,
      filePath
    });

    return res.download(filePath, path.basename(filePath));
  } catch (err) {
    console.error('Contract generation failed:', err.message);
    return res.status(500).json({ message: 'Server error while creating contract' });
  }
};
