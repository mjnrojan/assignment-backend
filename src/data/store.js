// In-memory data store for Phase 1A
// Data resets when the server restarts

const store = {
  users: [],
  courses: []
};

// Optional: Add some initial seed data if you want the API to not be empty on start
// store.users.push({
//   id: "123e4567-e89b-12d3-a456-426614174000",
//   name: "Test User",
//   email: "test@example.com",
//   createdAt: new Date().toISOString()
// });

module.exports = store;
