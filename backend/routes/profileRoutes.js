const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const verifyToken = require('../middleware/authMiddleware');
const { getProfile } = require('../controllers/profileController');
const { isAdmin } = require('../middleware/authMiddleware');

router.get('/profile', verifyToken, getProfile);    //verified


router.put('/users/:id/verify', verifyToken, isAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ role: 'farmer' }, { role: { $exists: false } }]
      },
      { $set: { role: 'farmer', isVerified: true } },
      { new: true }
    ).select('-password -resetToken -resetTokenExpiry');
    if (!updatedUser) {
      const userExists = await User.exists({ _id: req.params.id });
      return userExists
        ? res.status(400).json({ message: 'Only farmer accounts can be verified' })
        : res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User verified', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify user', error: error.message });
  }
});



router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
});




module.exports = router;
