import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // Cached on globalThis so hot reload in dev does not open a new connection each time.
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = (globalThis.mongooseCache ??= {
  conn: null,
  promise: null,
});

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) {
    // Guard against reusing a dropped or disconnecting socket when `bufferCommands: false`.
    if (cache.conn.connection.readyState === 1) return cache.conn;
    if (cache.conn.connection.readyState === 0 || cache.conn.connection.readyState === 3) {
      cache.conn = null;
      cache.promise = null;
    }
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Thiếu biến môi trường MONGODB_URI. Hãy khai báo trong .env.local.",
    );
  }

  cache.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: process.env.ENABLE_WORKER === "true" ? 20 : 10,
    minPoolSize: 0,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 30_000,
    autoIndex: process.env.NODE_ENV !== "production",
  });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Reset so the next call retries instead of reusing a rejected promise.
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
