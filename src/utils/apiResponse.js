const successResponse = (res, statusCode, data = null, pagination = null, message = "OK") => {
  const payload = {
    success: true,
    message,
    data,
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return res.status(statusCode).json(payload);
};

const errorResponse = (res, statusCode, message, code = "ERROR_CODE", details = null) => {
  const payload = {
    success: false,
    message,
    code,
  };

  if (details) {
    payload.details = details;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  successResponse,
  errorResponse,
};
