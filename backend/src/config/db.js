const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[db] MONGODB_URI not set - running WITHOUT persistence. Room data will be lost on restart.');
    return null;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000
    });
    isConnected = true;
    console.log('[db] MongoDB connected');

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[db] MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      console.log('[db] MongoDB reconnected');
    });

    return mongoose.connection;
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    console.warn('[db] Continuing WITHOUT persistence. Room data will only live in memory.');
    return null;
  }
}

function isDbConnected() {
  return isConnected;
}

module.exports = { connectDB, isDbConnected };
