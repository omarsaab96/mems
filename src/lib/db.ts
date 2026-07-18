import mongoose from "mongoose";

type CachedConnection = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseConnection?: CachedConnection;
};

const cached = globalForMongoose.mongooseConnection ?? {
  connection: null,
  promise: null,
};

globalForMongoose.mongooseConnection = cached;

export async function connectDb() {
  if (cached.connection) return cached.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  cached.promise ??= mongoose.connect(uri, {
    bufferCommands: false,
  });
  cached.connection = await cached.promise;
  return cached.connection;
}
