const express = require('express');
const cors    = require('cors');
const sql     = require('mssql');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbConfig = {
  server:   process.env.MSSQL_SERVER   || 'mdin3.cke3mhvwnvhc.us-west-2.rds.amazonaws.com',
  database: process.env.MSSQL_DATABASE || 'mdin',
  user:     process.env.MSSQL_USER     || 'sa2',
  password: process.env.MSSQL_PASSWORD || 'cv934oct',
  options:  { encrypt: true, trustServerCertificate: true },
  connectTimeout:  30000,
  requestTimeout:  60000,
  pool: { max: 5, min: 0, idleTimeoutMillis: 60000 },
};

let pool;
async function getPool() {
  // Reconecta si el pool no existe, está desconectado, o si la conexión subyacente fue reseteada
  if (!pool || !pool.connected) {
    try { if (pool) await pool.close(); } catch (_) {}
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

// Wrapper con auto-retry en caso de ECONNRESET u otros errores de red
async function queryWithRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const db = await getPool();
      return await fn(db);
    } catch (err) {
      const esRed = ['ECONNRESET','ECONNREFUSED','ETIMEDOUT','ESOCKET'].some(c => err.message?.includes(c) || err.code === c);
      if (esRed && i < retries) {
        console.warn(`[retry ${i+1}] ${err.message} — reconectando pool…`);
        try { if (pool) await pool.close(); } catch (_) {}
        pool = null;
        await new Promise(r => setTimeout(r, 800));
        continue;
      }
      throw err;
    }
  }
}

// GET /api/emisoras
// Devuelve lista unificada (Valmer + PIP) de TV, Emisora, Serie de la fecha más reciente
app.get('/api/emisoras', async (req, res) => {
  try {
    const result = await queryWithRetry(db => db.request().query(`
      SELECT DISTINCT
        UPPER(TRIM(TV))      AS tv,
        UPPER(TRIM(Emisora)) AS emisora,
        UPPER(TRIM(Serie))   AS serie,
        'Valmer'             AS proveedor
      FROM vector_precios_gubernamental WITH (NOLOCK)
      WHERE Fecha = (SELECT MAX(Fecha) FROM vector_precios_gubernamental WITH (NOLOCK))

      UNION

      SELECT DISTINCT
        UPPER(TRIM(tv))      AS tv,
        UPPER(TRIM(emisora)) AS emisora,
        UPPER(TRIM(serie))   AS serie,
        'PIP'                AS proveedor
      FROM vector_precios_gubernamental_pip WITH (NOLOCK)
      WHERE fecha = (SELECT MAX(fecha) FROM vector_precios_gubernamental_pip WITH (NOLOCK))

      ORDER BY emisora, serie
    `));

    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    console.error('[/api/emisoras]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/precio?emisora=BONO&serie=240620&proveedor=Valmer
// Devuelve el precio limpio/sucio de una emisora específica
app.get('/api/precio', async (req, res) => {
  const { emisora, serie, proveedor } = req.query;
  if (!emisora || !serie) return res.status(400).json({ ok: false, error: 'Faltan parámetros' });

  try {
    const em = emisora.toUpperCase().trim();
    const se = serie.toUpperCase().trim();

    const query = proveedor === 'PIP' ? `
        SELECT TOP 1 tv, emisora, serie,
          precio_limpio AS PrecioLimpio, precio_sucio AS PrecioSucio,
          tasa_cpn AS TasaCupon, fecha_vto AS Vencimiento,
          nombre_completo AS NombreCompleto, 'PIP' AS proveedor
        FROM vector_precios_gubernamental_pip WITH (NOLOCK)
        WHERE UPPER(TRIM(emisora))=@em AND UPPER(TRIM(serie))=@se ORDER BY fecha DESC`
      : `
        SELECT TOP 1 TV, Emisora, Serie,
          PrecioLimpio, PrecioSucio, TasaCuponVigente AS TasaCupon,
          NULL AS Vencimiento, Emisora AS NombreCompleto, 'Valmer' AS proveedor
        FROM vector_precios_gubernamental WITH (NOLOCK)
        WHERE UPPER(TRIM(Emisora))=@em AND UPPER(TRIM(Serie))=@se ORDER BY Fecha DESC`;

    const result = await queryWithRetry(db => {
      const r = db.request();
      r.input('em', sql.NVarChar, em);
      r.input('se', sql.NVarChar, se);
      return r.query(query);
    });

    if (!result.recordset.length)
      return res.status(404).json({ ok: false, error: 'No encontrado' });

    res.json({ ok: true, data: result.recordset[0] });
  } catch (err) {
    console.error('[/api/precio]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/historico?emisora=BONO&serie=240620&dias=90  (dias=0 → MAX)
app.get('/api/historico', async (req, res) => {
  const { emisora, serie, dias = '0' } = req.query;
  if (!emisora || !serie)
    return res.status(400).json({ ok: false, error: 'Faltan parámetros: emisora y serie' });

  try {
    const em   = emisora.toUpperCase().trim();
    const se   = serie.toUpperCase().trim();
    const dias_ = parseInt(dias, 10) || 0;

    const makeReq = (db, em, se, dias_) => {
      const r = db.request();
      r.input('em',   sql.NVarChar, em);
      r.input('se',   sql.NVarChar, se);
      r.input('dias', sql.Int,      dias_);
      return r;
    };

    const [resV, resP] = await Promise.all([
      queryWithRetry(db => makeReq(db, em, se, dias_).query(`
        SELECT CONVERT(varchar(10), Fecha, 23) AS fecha,
               CAST(Rendimiento  AS FLOAT) AS tasa,
               CAST(Sobretasa    AS FLOAT) AS sobretasa,
               CAST(PrecioLimpio AS FLOAT) AS precioLimpio
        FROM vector_precios_gubernamental WITH (NOLOCK)
        WHERE UPPER(TRIM(Emisora))=@em AND UPPER(TRIM(Serie))=@se
          AND (@dias=0 OR Fecha>=DATEADD(day,-@dias,GETDATE()))
        ORDER BY Fecha ASC`)),
      queryWithRetry(db => makeReq(db, em, se, dias_).query(`
        SELECT CONVERT(varchar(10), fecha, 23) AS fecha,
               CAST(tasa_rend    AS FLOAT) AS tasa,
               CAST(sobretasa    AS FLOAT) AS sobretasa,
               CAST(precio_limpio AS FLOAT) AS precioLimpio
        FROM vector_precios_gubernamental_pip WITH (NOLOCK)
        WHERE UPPER(TRIM(emisora))=@em AND UPPER(TRIM(serie))=@se
          AND (@dias=0 OR fecha>=DATEADD(day,-@dias,GETDATE()))
        ORDER BY fecha ASC`)),
    ]);

    res.json({ ok: true, valmer: resV.recordset, pip: resP.recordset });
  } catch (err) {
    console.error('[/api/historico]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ API corriendo en http://localhost:${PORT}`);
  console.log(`   GET /api/emisoras  — lista Valmer + PIP`);
  console.log(`   GET /api/precio    — precio por emisora/serie`);
});
