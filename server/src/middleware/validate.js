export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const dataToValidate = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
      const parsed = schema.parse(dataToValidate);
      if (source === 'body') req.body = parsed;
      if (source === 'query') req.query = parsed;
      if (source === 'params') req.params = parsed;
      next();
    } catch (err) {
      if (err.errors) {
        const errorMessages = err.errors.map(e => `${e.path.join('.') || 'field'}: ${e.message}`);
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            details: errorMessages
          }
        });
      }
      next(err);
    }
  };
};
