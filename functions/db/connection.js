// functions/db/connection.js - MongoDB connection via connection string
import { MongoClient } from 'mongodb';

let client;

export async function connectDB(env) {
  if (!client) {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
  }
  const dbName = env.MONGODB_DATABASE || 'sparrowflix';
  return client.db(dbName);
}
