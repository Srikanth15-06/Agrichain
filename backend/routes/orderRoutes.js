const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const {
  placeOrder,
  getOrders,
  updateOrderStatus
} = require('../controllers/orderController');

router.post('/', verifyToken, placeOrder);
router.get('/', verifyToken, getOrders);
router.get('/my-orders', verifyToken, getOrders);
router.get('/my', verifyToken, getOrders);
router.get('/orders/my', verifyToken, getOrders);
router.get('/farmer-orders', verifyToken, getOrders);
router.put('/update-status/:id', verifyToken, updateOrderStatus);

module.exports = router;
