const express = require('express');
const router = express.Router();
const {
  register,
  login,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
// const verifyToken = require('../middleware/authMiddleware');
// const { getProfile } = require('../controllers/profileController');

router.post('/register', register);       //verified
router.post('/login', login);              //verified
router.post('/forgot-password', forgotPassword);    //verified
router.post('/reset-password', resetPassword);

// router.get('/profile', verifyToken, getProfile);
module.exports = router;
