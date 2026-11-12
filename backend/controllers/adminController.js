const User = require('../models/User');
const Produce = require('../models/Produce');
const Order = require('../models/Order');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -resetToken -resetTokenExpiry');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// Get all produce
// const getAllProduce = async (req, res) => {
//   try {
//     const produce = await Produce.find().populate('postedBy', 'name email');
//     res.json(produce);
//   } catch (error) {
//     res.status(500).json({ message: 'Error fetching produce', error: error.message });
//   }
// };

// Get all orders
const getAllOrders = async (req, res) => {
    try {
    const orders = await Order.find()
      .populate({
        path: 'produce',
        populate: { path: 'postedBy', select: 'name email' }
      })
      .populate('buyer', 'name email');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders', error: err.message });
  }
};

// backend/controllers/adminController.js
// const getAdminDashboard = (req, res) => {
//   if (req.user.role !== 'admin') {
//     return res.status(403).json({ message: 'Access denied. Admins only.' });
//   }
//   res.json({ message: 'Welcome Admin! This is the dashboard.' });
// };

// Get dashboard stats    verified
const getDashboardStats = async (req, res) => {
  try {
    const farmerFilter = {
      $or: [{ role: 'farmer' }, { role: { $exists: false } }]
    };
    const totalUsers = await User.countDocuments();
    const totalBuyers = await User.countDocuments({ role: 'buyer' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalFarmers = await User.countDocuments(farmerFilter);
    const totalOrders = await Order.countDocuments();
    const totalProduce = await Produce.countDocuments();
    const verifiedFarmers = await User.countDocuments({ ...farmerFilter, isVerified: true });
    const unverifiedFarmers = await User.countDocuments({ ...farmerFilter, isVerified: { $ne: true } });
    const verifiedProduce = await Produce.countDocuments({ isApproved: true });
    const unverifiedProduce = await Produce.countDocuments({ isApproved: false });

    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const acceptedOrders = await Order.countDocuments({ status: 'accepted' });
    const rejectedOrders = await Order.countDocuments({ status: 'rejected' });

    // Unique buyers who placed orders
    const buyersPlacedOrders = await Order.distinct('buyer');
    const totalBuyersPlacedOrders = buyersPlacedOrders.length;
    res.json({
      totalUsers,
      totalBuyers,
      totalAdmins,
      totalFarmers,
      verifiedFarmers,
      unverifiedFarmers,
      totalOrders,
      totalProduce,
      verifiedProduce,
      unverifiedProduce,

      totalBuyersPlacedOrders,
      pendingOrders,
      acceptedOrders,
      rejectedOrders
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
};

// Delete a produce by ID
const deleteProduce = async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    if (!produce) {
      return res.status(404).json({ message: 'Produce not found' });
    }

    const isOwner = produce.postedBy.toString() === req.user.id;
    const isAdminUser = req.user.role === 'admin';

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ message: 'Not authorized to delete this produce' });
    }

    await produce.deleteOne();
    res.json({ message: 'Produce deleted successfully', produce });

  } catch (error) {
    res.status(500).json({ message: 'Error deleting produce', error: error.message });
  }
};

// Approve or reject produce
const updateProduceApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;
    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({ message: 'isApproved must be a boolean' });
    }
    const produce = await Produce.findByIdAndUpdate(
      id,
      { isApproved },
      { new: true }
    );
    if (!produce) {
      return res.status(404).json({ message: 'Produce not found' });
    }
    res.json({
      message: isApproved ? 'Produce approved successfully' : 'Produce rejected',
      produce,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating produce status', error: err.message });
  }
};

// Delete an order by ID
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully', order });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting order', error: error.message });
  }
};


const getUnverifiedFarmers = async (req, res) => {
  try {
    const unverified = await User.find({
      $and: [
        { $or: [{ role: 'farmer' }, { role: { $exists: false } }] },
        { isVerified: { $ne: true } }
      ]
    })
      .select('-password -resetToken -resetTokenExpiry');
    res.json(unverified);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unverified farmers', error: error.message });
  }
};

const getUnapprovedProduce = async (req, res) => {
  try {
    const unapproved = await Produce.find({ isApproved: false }).populate('postedBy', 'name email');
    res.json(unapproved);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unapproved produce', error: error.message });
  }
};

// Reject produce
const rejectProduce = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const produce = await Produce.findById(id);
    if (!produce) {
      return res.status(404).json({ message: 'Produce not found' });
    }
    produce.isRejected = true;
    produce.isApproved = false;
    produce.rejectionReason = reason || 'Not specified';
    await produce.save();
    res.json({
      message: 'Produce rejected successfully',
      produce,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting produce', error: error.message });
  }
};


// Get all approved produce
const getApprovedProduce = async (req, res) => {
  try {
    const approved = await Produce.find({ isApproved: true, isRejected: { $ne: true } }).populate('postedBy', 'name email');
    res.json(approved);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching approved produce', error: error.message });
  }
};

// Get all rejected produce
const getRejectedProduce = async (req, res) => {
  try {
    const rejected = await Produce.find({ isRejected: true }).populate('postedBy', 'name email');
    res.json(rejected);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rejected produce', error: error.message });
  }
};

module.exports = {
    getAllUsers,
    // getAllProduce,
    getAllOrders,
    // getAdminDashboard,
    getDashboardStats,
    updateProduceApproval,
    deleteProduce,
    deleteOrder,
    getUnverifiedFarmers,
    getUnapprovedProduce,
    rejectProduce,
    getApprovedProduce,
    getRejectedProduce
};
