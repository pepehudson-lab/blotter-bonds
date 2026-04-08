const sql = require('mssql');

const config = {
  server: 'mdin3.cke3mhvwnvhc.us-west-2.rds.amazonaws.com',
  database: 'mdin',
  user: 'sa2',
  password: 'cv934oct',
  options: { encrypt: true, trustServerCertificate: true },
  connectTimeout: 15000,
};

async function main() {
  const pool = await sql.connect(config);
  console.log('✅ Conectado a SQL Server\n');

  // Columnas de valmer
  const cols1 = await pool.request().query(`
    SELECT TOP 0 * FROM vector_precios_gubernamental
  `);
  console.log('=== vector_precios_gubernamental (Valmer) ===');
  console.log('Columnas:', cols1.recordset.columns ? Object.keys(cols1.recordset.columns) : 'N/A');

  // Columnas de pip
  const cols2 = await pool.request().query(`
    SELECT TOP 0 * FROM vector_precios_gubernamental_pip
  `);
  console.log('\n=== vector_precios_gubernamental_pip (PIP) ===');
  console.log('Columnas:', cols2.recordset.columns ? Object.keys(cols2.recordset.columns) : 'N/A');

  // Muestra de datos valmer
  const sample1 = await pool.request().query(`SELECT TOP 3 * FROM vector_precios_gubernamental`);
  console.log('\n--- Sample Valmer ---');
  console.log(JSON.stringify(sample1.recordset, null, 2));

  // Muestra de datos pip
  const sample2 = await pool.request().query(`SELECT TOP 3 * FROM vector_precios_gubernamental_pip`);
  console.log('\n--- Sample PIP ---');
  console.log(JSON.stringify(sample2.recordset, null, 2));

  await pool.close();
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
