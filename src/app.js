const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const { NODE_ENV, CLIENT_URL } = require("./config/config");
const connectDB = require("./config/database");
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const recipeRoutes = require("./routes/recipe.routes");
const socialRoutes = require("./routes/social.routes");
const adminRoutes = require("./routes/admin.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const searchRoutes = require("./routes/search.routes");
const notificationRoutes = require("./routes/notification.routes");
const sanitise = require("./middleware/sanitise");
const { generalRateLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");

const app = express();
app.use(generalRateLimiter);

// Security + CORS middleware
app.use(helmet());
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(...sanitise);

// Request logging (development only)
if (NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Database connection
if (NODE_ENV !== "test") {
  connectDB();
}

// Health check - to verify server is running
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "RecipeNest Backend API",
    version: "2.0.0",
    status: "running",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationRoutes);

// Static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 404 handler - when route is not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
    code: "NOT_FOUND",
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
