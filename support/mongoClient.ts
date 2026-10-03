import { MongoClient, type Db } from 'mongodb';

const MONGO_URI = process.env['MONGO_URI'];

let cachedClient: MongoClient | null = null;

/**
 * Returns a connected, cached MongoClient — reused across calls in the same
 * worker process rather than opening a fresh connection per query.
 *
 * Direct DB access was dropped in 7e7b5583 ("MONGO_URI was never provisioned
 * for this project") in favor of IMAP-based OTP fetching; re-added here now
 * that a working MONGO_URI exists, for read-only DB-level assertions.
 */
export async function getMongoClient(): Promise<MongoClient> {
    if (cachedClient) return cachedClient;
    if (!MONGO_URI) {
        throw new Error('MONGO_URI env var is not set — required for direct DB assertions.');
    }
    const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    cachedClient = client;
    return client;
}

export async function getMongoDb(dbName: string): Promise<Db> {
    const client = await getMongoClient();
    return client.db(dbName);
}

/** Call from a suite's afterAll if it opened the connection, so the process can exit cleanly. */
export async function closeMongoClient(): Promise<void> {
    if (cachedClient) {
        await cachedClient.close();
        cachedClient = null;
    }
}
