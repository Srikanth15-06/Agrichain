const mongoose = require('mongoose');
const Order = require('../models/Order');
const Produce = require('../models/Produce');

const placeOrder = async (req, res) => {
  if (req.user.role !== 'buyer') {
    return res.status(403).json({ message: 'Only buyers can place orders' });
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

    const order = await Order.create({
      produce: produce._id,
      quantity: String(quantityNumber),
      buyer: req.user.id,
      amount: produce.pricePerKg * quantityNumber,
      status: 'pending'
    });
    await order.populate('produce');
    return res.status(201).json(order);
  } catch (error) {
    return res.status(500).json({ message: 'Error placing order' });
  }
};

const getOrders = async (req, res) => {
  try {
    let query;
    if (req.user.role === 'buyer') {
      query = { buyer: req.user.id };
    } else if (req.user.role === 'farmer') {
      const produceIds = await Produce.find({ postedBy: req.user.id }).distinct('_id');
      query = { produce: { $in: produceIds } };
    } else if (req.user.role === 'admin') {
      query = {};
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const orders = await Order.find(query)
      .populate('produce')
      .populate('buyer', 'name email');
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching orders' });
  }
};

const updateOrderStatus = async (req, res) => {
  if (req.user.role !== 'farmer') {
    return res.status(403).json({ message: 'Only farmers can update order status' });
  }

  const { status } = req.body;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const order = await Order.findById(req.params.id).populate('produce');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (!order.produce || order.produce.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    order.status = status;
    await order.save();
    return res.json({ message: `Order ${status} successfully`, order });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating order status' });
  }
};

module.exports = {
  placeOrder,
  getOrders,
  updateOrderStatus,
  getMyOrders: getOrders
};
