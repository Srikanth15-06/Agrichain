const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const {
  addToCart,
  getCartItems,
  removeFromCart
} = require('../controllers/cartController');

router.post('/add', verifyToken, addToCart);
router.get('/', verifyToken, getCartItems);
router.delete('/:id', verifyToken, removeFromCart);

module.exports = router;
