const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto && forwardedProto !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  if (!forwardedProto && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};

module.exports = httpsRedirect;
