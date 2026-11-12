const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  produce: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true },
  quantity: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cart', cartSchema);
