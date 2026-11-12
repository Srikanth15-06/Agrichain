const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Produce = require('../models/Produce');
const User = require('../models/User');
const Order = require('../models/Order');
const verifyToken = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/authMiddleware');
const {
    getAllUsers,
    // getAllProduce,
    getAllOrders,
    getDashboardStats,
    updateProduceApproval,
    deleteProduce,
    deleteOrder,
    getUnverifiedFarmers,
    getUnapprovedProduce,
    rejectProduce,
    getApprovedProduce,
    getRejectedProduce,
    // adminController,
    // getAdminDashboard,
} = require('../controllers/adminController');





// Admin routes
router.get('/users', verifyToken, isAdmin, getAllUsers);
// router.get('/produce', verifyToken, isAdmin, getAllProduce);
router.get('/orders', verifyToken, isAdmin, getAllOrders);
router.get('/dashboard/stats', verifyToken, isAdmin, getDashboardStats);   //verified

router.get('/unverified-farmers', verifyToken, isAdmin, getUnverifiedFarmers);
router.get('/unapproved-produce', verifyToken, isAdmin, getUnapprovedProduce);
router.put('/reject-produce/:id', verifyToken, isAdmin, rejectProduce);
router.get('/produce/approved', verifyToken, isAdmin, getApprovedProduce);
router.get('/produce/rejected', verifyToken, isAdmin, getRejectedProduce);
// router.get("/profile", verifyToken, getProfile);
// router.get('/dashboard', verifyToken, isAdmin, getAdminDashboard);

router.put('/produce/approve/:id', verifyToken, isAdmin, updateProduceApproval);


router.delete('/produce/:id', verifyToken, isAdmin, deleteProduce);
router.delete('/order/:id', verifyToken, isAdmin, deleteOrder);

// 🟩 Admin dashboard
// router.get('/dashboard', verifyToken, (req, res) => {
//   if (req.user.role !== 'admin') {
//     return res.status(403).json({ message: 'Access denied. Admins only.' });
//   }
//   res.json({
//     message: `Welcome to admin dashboard, ${req.user.role}`,
//     user: req.user
//   });
// });


// GET /api/user/profile
// router.get('/profile', verifyToken, async (req, res) => {
//   const user = await User.findById(req.user.id).select('-password');
//   res.json(user);
// });


// ✅ Verify a farmer account
router.put('/verify-user/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, $or: [{ role: 'farmer' }, { role: { $exists: false } }] },
      { $set: { role: 'farmer', isVerified: true } },
      { new: true }
    ).select('-password -resetToken -resetTokenExpiry');
    if (!updatedUser) {
      const userExists = await User.exists({ _id: userId });
      return userExists
        ? res.status(400).json({ message: 'Only farmer accounts can be verified' })
        : res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User verified successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: 'Error verifying user', error: err.message });
  }
});

// 🔍 View all produce (posted by verified farmers)
router.get('/produce', verifyToken, isAdmin, async (req, res) => {
  try {
    // Populate postedBy and only include verified farmers
    const produce = await Produce.find()
      .populate({
        path: 'postedBy',
        match: { isVerified: true },
        select: 'name email isVerified',
      });
    // Filter out null (non-verified) postedBy entries
    const filtered = produce.filter(p => p.postedBy !== null);
    res.status(200).json(filtered);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching produce', error: err.message });
  }
});

// PUT /api/admin/order/:id → update order status
router.put('/order/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('buyer produce');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: `Order ${status} successfully`, order });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
});


module.exports = router;
