const express = require("express");
const cors = require("cors");
const path = require("path");

const { PORT, NODE_ENV, CLIENT_URL } = require("./config/config");
const connectDB = require("./config/database");
const userRoutes = require("./routes/user.routes");
const courseRoutes = require("./routes/course.routes");

const app = express();

// CORS middleware - allows frontend to connect
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

// Body parsing middleware - to read JSON data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development only)
if (NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Database connection
connectDB();

// Health check - to verify server is running
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Course Management System API",
    version: "1.0.0",
    status: "running",
  });
});

// API routes
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);

// Static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 404 handler - when route is not found
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    statusCode,
  });
});

module.exports = app;
