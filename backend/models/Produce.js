const mongoose = require('mongoose');

const produceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  quantity: {
    type: String,
    required: true,
  },
  pricePerKg: {
    type: Number,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  image: {
    type: String,
  },
  imagePublicId: {
    type: String,
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
   isApproved: {
      type: Boolean,
      default: false, // Only visible if approved
  },
  isRejected: {
    type: Boolean,
    default: false,
  },
  rejectionReason: {
    type: String,
    default: ''
  }
}, 
{ timestamps: true });

module.exports = mongoose.model('Produce', produceSchema);
