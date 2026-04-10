const mongoSanitize = require("express-mongo-sanitize");

// xss-clean and express-mongo-sanitize default middleware both try to write
// to req.query which is read-only in Express 5.
// Custom middleware that only sanitises req.body and req.params.

const sanitiseRequest = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = mongoSanitize.sanitize(req.body);
  }
  if (req.params && typeof req.params === "object") {
    const cleaned = mongoSanitize.sanitize({ ...req.params });
    Object.assign(req.params, cleaned);
  }
  next();
};

module.exports = [sanitiseRequest];
