require("dotenv").config();

module.exports = {
  // Server
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || "development",
  
  // Database
  DB_URL: process.env.DB_URL || "mongodb://localhost:27017/cmsbackend",
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  
  // CORS
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
};
