const mongoose = require("mongoose");
const config   = require("./index");

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  let uri = config.mongoUri;

  // If no real MongoDB is available, start an in-memory server automatically
  // (development / demo mode only)
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    isConnected = true;
    console.log("MongoDB connected:", mongoose.connection.host);
  } catch (err) {
    console.warn("Real MongoDB not reachable, starting in-memory MongoDB for demo...");
    try {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      await mongoose.connect(uri);
      isConnected = true;
      console.log("✓ In-memory MongoDB started (demo mode):", uri);
      console.warn("NOTE: Data will NOT persist after server restarts in demo mode.");
    } catch (memErr) {
      console.error("Failed to start MongoDB:", memErr.message);
      console.error("Install MongoDB or set a valid MONGO_URI in .env");
      if (config.nodeEnv !== "test") process.exit(1);
    }
  }
}

module.exports = { connectDB };
