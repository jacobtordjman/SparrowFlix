// functions/db/connection.js
import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

export async function connectDB(uri) {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    
    cachedClient = client;
    cachedDb = client.db('sparrowflix');
    
    return cachedDb;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}