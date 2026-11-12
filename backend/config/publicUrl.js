const getPublicUrl = req => {
  const configuredUrl = process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (req) {
    return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
  }

  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
};

module.exports = getPublicUrl;
