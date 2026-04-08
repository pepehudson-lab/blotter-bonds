import { queryWithRetry } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { tabla } = req.query;
  if (!tabla) return res.status(400).json({ ok: false, error: 'Falta ?tabla=' });
  try {
    const result = await queryWithRetry(db => db.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tabla.replace(/'/g,"''")}'
      ORDER BY ORDINAL_POSITION
    `));
    res.json({ ok: true, columns: result.recordset });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
