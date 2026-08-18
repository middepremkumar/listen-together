function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[errorHandler]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || 'Something went wrong on the server. Please try again.'
  });
}

module.exports = { notFoundHandler, errorHandler };
