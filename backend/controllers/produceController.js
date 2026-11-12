const Produce = require('../models/Produce');
const { uploadImage, deleteImage } = require('../config/cloudinary');

// Create a new produce
const createProduce = async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can post produce' });
    }
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const quantity = typeof req.body.quantity === 'string' ? req.body.quantity.trim() : '';
    const pricePerKg = Number(req.body.pricePerKg);
    const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    if (
      !title ||
      !quantity ||
      !Number.isFinite(Number.parseFloat(quantity)) ||
      Number.parseFloat(quantity) <= 0 ||
      !Number.isFinite(pricePerKg) ||
      pricePerKg <= 0 ||
      !location
    ) {
      return res.status(400).json({ message: 'Enter a title, positive quantity and price, and location' });
    }

    let uploadedImage = null;
    if (req.file) {
      try {
        uploadedImage = await uploadImage(req.file);
      } catch (error) {
        console.error('Cloudinary image upload failed:', error.message);
        const status = error.code === 'CLOUDINARY_NOT_CONFIGURED' ? 503 : 502;
        const message = status === 503
          ? 'Image storage is not configured'
          : 'Could not upload the produce image';
        return res.status(status).json({ message });
      }
    }

    const newProduce = new Produce({
      title,
      quantity,
      pricePerKg,
      location,
      image: uploadedImage ? uploadedImage.url : null,
      imagePublicId: uploadedImage ? uploadedImage.publicId : undefined,
      postedBy: req.user.id
    });

    try {
      const savedProduce = await newProduce.save();
      return res.status(201).json(savedProduce);
    } catch (error) {
      if (uploadedImage) {
        try {
          await deleteImage(uploadedImage.publicId);
        } catch (cleanupError) {
          console.error('Could not clean up an unused Cloudinary image:', cleanupError.message);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error posting produce:', error.message);
    res.status(500).json({ message: 'Error posting produce' });
  }
};


const getAllProduces = async (req, res) => {
  try {
    const produceList = await Produce.find() 
    .select('title quantity pricePerKg location image isApproved isRejected rejectionReason')
    .populate('postedBy', 'name email phone');
    res.json(produceList);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all produce', error: error.message });
  }
};

const getAllProduceAdmin = async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { isApproved: true, isRejected: { $ne: true } };
    const produceList = await Produce.find(filter)
    .select('title quantity pricePerKg location image isApproved isRejected rejectionReason')
    .populate('postedBy', 'name email phone');
    res.json(produceList);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all produce', error: error.message });
  }
};


const getMyProduce = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized. Missing user ID." });
    }
    const userId = req.user.id;
    const produce = await Produce.find({ postedBy: userId })
    .select('title quantity pricePerKg location image isApproved isRejected rejectionReason')
    .populate('postedBy', 'name email');
    return res.status(200).json(produce);
  } catch (error) {
    console.error("🔥 Error fetching produce:", error);
    return res.status(500).json({
      message: "Error fetching produce details",
      error: error.message
    });
  }
};

const updateProduceStatus = async (req, res) => {
  try {
    const { isApproved, isRejected, rejectionReason } = req.body;
    const produceId = req.params.id;
    const updateData = {
      isApproved,
      isRejected,
      rejectionReason: isRejected ? rejectionReason : ""
    };
    const updatedProduce = await Produce.findByIdAndUpdate(
      produceId,
      updateData,
      { new: true }
    );
    if (!updatedProduce) {
      return res.status(404).json({ message: "Produce not found" });
    }
    res.json({ message: "Produce updated", produce: updatedProduce });
  } catch (error) {
    res.status(500).json({ message: "Error updating produce", error: error.message });
  }
};








module.exports = {
    createProduce,        //farmer
    getAllProduces,       //buyer
    getAllProduceAdmin,  //admin
    getMyProduce,         //farmer
    updateProduceStatus    // isApproved, isRejected, rejectionReason for produce
};
