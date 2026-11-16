import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

let replSet: MongoMemoryReplSet | null = null;

/**
 * Starts an in-memory MongoDB replica set (needed to test transactions) and points MONGODB_URI at it.
 * Call before importing code that uses `connectToDatabase`.
 */
export async function startTestDatabase(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri("movie_test");
}

export async function stopTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  await replSet?.stop();
  replSet = null;
}
