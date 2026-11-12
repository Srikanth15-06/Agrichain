window.API_BASE_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? location.port === '3000'
      ? `${location.protocol}//${location.hostname}:5000`
      : location.origin
    : location.origin;

window.resolveImageUrl = image => {
  if (typeof image !== 'string' || !image.trim()) return '';
  try {
    const url = new URL(image, window.API_BASE_URL);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
};
