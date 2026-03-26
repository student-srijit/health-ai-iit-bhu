import { MongoClient, type Db } from "mongodb";
import { getMongoConfig } from "./env";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getMongoDb(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  const cfg = getMongoConfig();

  if (!cachedClient) {
    cachedClient = new MongoClient(cfg.uri, {
      // Force IPv4 to avoid common macOS DNS SRV resolution issues (ENOTFOUND)
      family: 4, 
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(cfg.dbName);
  return cachedDb;
}