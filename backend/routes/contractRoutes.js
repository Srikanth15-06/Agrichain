const express = require('express');
const router = express.Router();
const { createContracts } = require('../controllers/contractController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/generate', verifyToken, createContracts);

module.exports = router;
