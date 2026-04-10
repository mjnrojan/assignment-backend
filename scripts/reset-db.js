/**
 * Reset Database Script
 * Drops all collections and starts fresh.
 * Usage: node scripts/reset-db.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { DB_URL } = require("../src/config/config");

const run = async () => {
  try {
    await mongoose.connect(DB_URL);
    console.log("Connected to database.");

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      await mongoose.connection.db.dropCollection(col.name);
      console.log(`  Dropped: ${col.name}`);
    }

    console.log("\nDatabase reset complete. All collections cleared.");
    process.exit(0);
  } catch (error) {
    console.error("Reset failed:", error.message);
    process.exit(1);
  }
};

run();
