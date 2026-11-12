const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('requires Cloudinary credentials before attempting an upload', async () => {
  const envKeys = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  const previousValues = envKeys.map(key => process.env[key]);
  envKeys.forEach(key => {
    process.env[key] = '';
  });

  try {
    const { uploadImage } = require('../backend/config/cloudinary');
    await assert.rejects(
      uploadImage({ buffer: Buffer.from('not an image') }),
      error => error.code === 'CLOUDINARY_NOT_CONFIGURED'
    );
  } finally {
    envKeys.forEach((key, index) => {
      if (previousValues[index] === undefined) delete process.env[key];
      else process.env[key] = previousValues[index];
    });
  }
});

test('streams a produce image to Cloudinary and returns its URL and public ID', async () => {
  const envKeys = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  const previousValues = envKeys.map(key => process.env[key]);
  envKeys.forEach((key, index) => {
    process.env[key] = `test-cloudinary-${index}`;
  });

  const cloudinary = require('cloudinary').v2;
  const originalUploadStream = cloudinary.uploader.upload_stream;
  let uploadedBuffer;
  let uploadOptions;
  cloudinary.uploader.upload_stream = (options, callback) => {
    uploadOptions = options;
    return {
      end(buffer) {
        uploadedBuffer = buffer;
        callback(null, {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
          public_id: `${options.folder}/${options.public_id}`
        });
      }
    };
  };

  try {
    const { uploadImage } = require('../backend/config/cloudinary');
    const buffer = Buffer.from('test image data');
    const result = await uploadImage({ buffer });

    assert.equal(uploadedBuffer, buffer);
    assert.equal(uploadOptions.folder, 'agrichain/produce');
    assert.equal(result.url, 'https://res.cloudinary.com/demo/image/upload/test.jpg');
    assert.ok(result.publicId.startsWith('agrichain/produce/'));
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
    envKeys.forEach((key, index) => {
      if (previousValues[index] === undefined) delete process.env[key];
      else process.env[key] = previousValues[index];
    });
  }
});

test('resolves Cloudinary and legacy local image URLs safely', () => {
  const configPath = path.join(__dirname, '../frontend/api-config.js');
  const source = fs.readFileSync(configPath, 'utf8');
  const context = {
    location: {
      hostname: 'localhost',
      port: '3000',
      protocol: 'http:',
      origin: 'http://localhost:3000'
    },
    window: {},
    URL
  };
  vm.runInNewContext(source, context);

  assert.equal(context.window.API_BASE_URL, 'http://localhost:5000');
  assert.equal(
    context.window.resolveImageUrl('/uploads/legacy.jpg'),
    'http://localhost:5000/uploads/legacy.jpg'
  );
  assert.equal(
    context.window.resolveImageUrl('https://res.cloudinary.com/demo/image/upload/item.jpg'),
    'https://res.cloudinary.com/demo/image/upload/item.jpg'
  );
  assert.equal(context.window.resolveImageUrl('javascript:alert(1)'), '');
});
