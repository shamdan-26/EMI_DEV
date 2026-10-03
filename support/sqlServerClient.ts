import sql, { type ConnectionPool } from 'mssql';

const MSSQL_HOST     = process.env['MSSQL_HOST'];
const MSSQL_PORT     = Number(process.env['MSSQL_PORT'] ?? 1433);
const MSSQL_DATABASE = process.env['MSSQL_DATABASE'] ?? 'master';
const MSSQL_USER     = process.env['MSSQL_USER'];
const MSSQL_PASSWORD = process.env['MSSQL_PASSWORD'];

let cachedPool: ConnectionPool | null = null;

/**
 * Returns a connected, cached connection pool — reused across calls in the
 * same worker process rather than opening a fresh connection per query.
 *
 * `MSSQL_DATABASE` only sets the INITIAL connection database (SQL Server has
 * many — this repo's EMI microservices each own one, e.g. emi_wallet,
 * emi_transaction). Cross-database queries within the same instance switch
 * with `USE [dbname];` at the start of the query, same as any other T-SQL.
 */
export async function getSqlPool(): Promise<ConnectionPool> {
    if (cachedPool?.connected) return cachedPool;
    if (!MSSQL_HOST || !MSSQL_USER || !MSSQL_PASSWORD) {
        throw new Error('MSSQL_HOST, MSSQL_USER, and MSSQL_PASSWORD env vars must be set for direct SQL Server assertions.');
    }
    cachedPool = await sql.connect({
        server: MSSQL_HOST,
        port: MSSQL_PORT,
        database: MSSQL_DATABASE,
        user: MSSQL_USER,
        password: MSSQL_PASSWORD,
        options: { trustServerCertificate: true, encrypt: false },
        connectionTimeout: 15000,
    });
    return cachedPool;
}

/** Call from a suite's afterAll if it opened the connection, so the process can exit cleanly. */
export async function closeSqlPool(): Promise<void> {
    if (cachedPool) {
        await cachedPool.close();
        cachedPool = null;
    }
}
