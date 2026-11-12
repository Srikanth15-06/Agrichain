const express = require('express');
const router = express.Router();
const Produce = require('../models/Produce');
const verifyToken = require('../middleware/authMiddleware');
const {isAdmin} = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { deleteImage } = require('../config/cloudinary');

const { createProduce, getAllProduces,getMyProduce, getAllProduceAdmin,updateProduceStatus} = require('../controllers/produceController');

router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id);
    if (!produce) return res.status(404).json({ message: "Produce not found" });
    if (produce.imagePublicId) {
      try {
        await deleteImage(produce.imagePublicId);
      } catch (error) {
        console.error('Could not delete produce image from Cloudinary:', error.message);
        const status = error.code === 'CLOUDINARY_NOT_CONFIGURED' ? 503 : 502;
        return res.status(status).json({ message: 'Could not delete the produce image' });
      }
    }
    await produce.deleteOne();
    res.status(200).json({ message: "Produce deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
});




router.get('/my', verifyToken, getMyProduce);

router.post('/', verifyToken, upload.single('image'), createProduce);

// 🔍 Get specific produce
router.get('/:id', async (req, res) => {
  try {
    const produce = await Produce.findById(req.params.id).populate('postedBy', 'name email');
    if (!produce) return res.status(404).json({ message: 'Produce not found' });
    res.json(produce);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching produce details' });
  }
});

router.get('/', verifyToken, getAllProduceAdmin);

// In produceRoutes.js
router.get("/all",verifyToken, getAllProduces);

router.put('/admin/update/:id', verifyToken, isAdmin, updateProduceStatus);


module.exports = router;
