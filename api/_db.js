import sql from 'mssql';

const dbConfig = {
  server:   process.env.MSSQL_SERVER   || 'mdin3.cke3mhvwnvhc.us-west-2.rds.amazonaws.com',
  database: process.env.MSSQL_DATABASE || 'mdin',
  user:     process.env.MSSQL_USER     || 'sa2',
  password: process.env.MSSQL_PASSWORD || 'cv934oct',
  options:  { encrypt: true, trustServerCertificate: true },
  connectTimeout: 30000,
  requestTimeout: 60000,
  pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
};

let pool;
export async function getPool() {
  if (!pool || !pool.connected) {
    try { if (pool) await pool.close(); } catch (_) {}
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

export async function queryWithRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const db = await getPool();
      return await fn(db);
    } catch (err) {
      const isNet = ['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ESOCKET'].some(c => err.message?.includes(c) || err.code === c);
      if (isNet && i < retries) {
        try { if (pool) await pool.close(); } catch (_) {}
        pool = null;
        await new Promise(r => setTimeout(r, 800));
        continue;
      }
      throw err;
    }
  }
}

export { sql };
