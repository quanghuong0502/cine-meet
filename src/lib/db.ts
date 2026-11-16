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
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Thiếu biến môi trường MONGODB_URI. Hãy khai báo trong .env.local.",
    );
  }

  cache.promise ??= mongoose.connect(uri, { bufferCommands: false });

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Reset so the next call retries instead of reusing a rejected promise.
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
