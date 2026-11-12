const User = require('../models/User');

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -__v');
    if (!user) return res.status(404).json({ message: "User not found" });
    
    res.json(user); // ✅ This sends actual user data
  } catch (err) {
    console.error("Error fetching profile:", err.message);
    res.status(500).json({ message: "Error fetching user data", error: err.message });
  }
};

module.exports = { getProfile };
