export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      message: `Resource not found: ${req.method} ${req.originalUrl}`
    }
  });
}

export function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('API Error:', err);
  }

  // Handle Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: { message: 'File is too large. Maximum size is 2MB.' }
    });
  }

  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: { message: err.message }
    });
  }

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: {
      message: (isProd && statusCode === 500) ? 'Internal server error' : (err.message || 'Internal server error'),
      details: isProd ? null : (err.details || null)
    }
  });
}
