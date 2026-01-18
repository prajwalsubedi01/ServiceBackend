// src/middlewares/errorMiddleware.js

// 404 Not Found Middleware
export const notFound = (req, res, next) => {
  // req.originalUrl is only available if this is called inside Express route flow
  res.status(404);
  const error = new Error(`Not Found - ${req.originalUrl}`);
  next(error);
};

// Centralized Error Handling Middleware
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};
