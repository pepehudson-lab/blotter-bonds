import { queryWithRetry } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const result = await queryWithRetry(db => db.request().query(`
      SELECT DISTINCT UPPER(TRIM(TV)) AS tv, UPPER(TRIM(Emisora)) AS emisora, UPPER(TRIM(Serie)) AS serie, 'Valmer' AS proveedor
      FROM vector_precios_gubernamental WITH (NOLOCK)
      WHERE Fecha = (SELECT MAX(Fecha) FROM vector_precios_gubernamental WITH (NOLOCK))
      UNION
      SELECT DISTINCT UPPER(TRIM(tv)) AS tv, UPPER(TRIM(emisora)) AS emisora, UPPER(TRIM(serie)) AS serie, 'PIP' AS proveedor
      FROM vector_precios_gubernamental_pip WITH (NOLOCK)
      WHERE fecha = (SELECT MAX(fecha) FROM vector_precios_gubernamental_pip WITH (NOLOCK))
      ORDER BY emisora, serie
    `));
    res.json({ ok: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
