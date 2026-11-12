const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Produce = require('../models/Produce');

// Add to cart
const addToCart = async (req, res) => {
  if (req.user.role !== 'buyer') {
    return res.status(403).json({ message: 'Only buyers can use a cart' });
  }

  try {
    const { produceId, quantity } = req.body;
    const quantityNumber = Number(quantity);
    if (
      !mongoose.Types.ObjectId.isValid(produceId) ||
      !Number.isFinite(quantityNumber) ||
      quantityNumber <= 0
    ) {
      return res.status(400).json({ message: 'A valid produceId and positive quantity are required' });
    }

    const produce = await Produce.findById(produceId);
    if (!produce || !produce.isApproved || produce.isRejected) {
      return res.status(404).json({ message: 'Approved produce not found' });
    }

    const availableQuantity = Number.parseFloat(produce.quantity);
    const existingItems = await Cart.find({ buyer: req.user.id, produce: produceId });
    const quantityInCart = existingItems.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    if (Number.isFinite(availableQuantity) && quantityNumber + quantityInCart > availableQuantity) {
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }

    const buyerId = req.user.id;
    const cartItem = new Cart({
      buyer: buyerId,
      produce: produceId,
      quantity: String(quantityNumber)
    });
    await cartItem.save();
    res.status(201).json({ message: 'Added to cart', cartItem });
  } catch (err) {
    res.status(500).json({ message: 'Error adding to cart', error: err.message });
  }
};

// Get user's cart
const getCartItems = async (req, res) => {
  if (req.user.role !== 'buyer') {
    return res.status(403).json({ message: 'Only buyers can use a cart' });
  }

  try {
    const items = await Cart.find({ buyer: req.user.id }).populate('produce');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cart items', error: err.message });
  }
};

// Remove from cart
const removeFromCart = async (req, res) => {
  if (req.user.role !== 'buyer') {
    return res.status(403).json({ message: 'Only buyers can use a cart' });
  }

  try {
    const itemId = req.params.id;
    const deleted = await Cart.findOneAndDelete({ _id: itemId, buyer: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing item', error: err.message });
  }
};

module.exports = {
  addToCart,
  getCartItems,
  removeFromCart
};
