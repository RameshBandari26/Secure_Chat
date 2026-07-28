const mongoose = require("mongoose");
const dns = require("dns");

// -----------------------------------------------------------------
// Fix for Windows machines where Node's built-in DNS resolver (c-ares)
// fails to perform the SRV lookup that "mongodb+srv://" URIs require,
// even though the OS resolver (nslookup) succeeds. Symptom:
//   MongoDB connection error: querySrv ECONNREFUSED _mongodb._tcp....
// Pointing Node explicitly at public DNS servers works around it.
// -----------------------------------------------------------------
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// -----------------------------------------------------------------
// This is the core "link to MongoDB via Mongoose" example:
//   1. mongoose.connect(uri) opens the connection using the URI
//      stored in your .env file (MONGO_URL).
//   2. Once connected, every model (User, Message, ...) that was
//      created with mongoose.model(...) automatically uses this
//      connection to read/write documents.
// -----------------------------------------------------------------
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
