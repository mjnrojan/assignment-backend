const mongoose = require("mongoose");
require("dotenv").config();
const { DB_URL } = require("./src/config/config");

const migrate = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(DB_URL);
    console.log("Connected.");

    const db = mongoose.connection.db;
    const profilesCollection = db.collection("profiles");
    const usersCollection = db.collection("rnusers");

    const profiles = await profilesCollection.find({}).toArray();
    console.log(`Found ${profiles.length} profiles to migrate.`);

    for (const profile of profiles) {
      console.log(`Migrating profile for userId: ${profile.userId}`);
      
      const updateData = {
        biography: profile.biography || "",
        profileImage: profile.profileImage || "",
        profileImagePublicId: profile.profileImagePublicId || "",
        socialLinks: profile.socialLinks || {},
        specialisations: profile.specialisations || [],
        contactEmail: profile.contactEmail || "",
        businessCategory: profile.businessCategory || "",
      };

      await usersCollection.updateOne(
        { _id: profile.userId },
        { $set: updateData }
      );
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

migrate();
