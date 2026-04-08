import { queryWithRetry, sql } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { emisora, serie, proveedor } = req.query;
  if (!emisora || !serie) return res.status(400).json({ ok: false, error: 'Faltan parámetros' });

  const em = emisora.toUpperCase().trim();
  const se = serie.toUpperCase().trim();

  try {
    const query = proveedor === 'PIP'
      ? `SELECT TOP 1 tv, emisora, serie, precio_limpio AS PrecioLimpio, precio_sucio AS PrecioSucio, tasa_cpn AS TasaCupon, fecha_vto AS Vencimiento, nombre_completo AS NombreCompleto, 'PIP' AS proveedor FROM vector_precios_gubernamental_pip WITH (NOLOCK) WHERE UPPER(TRIM(emisora))=@em AND UPPER(TRIM(serie))=@se ORDER BY fecha DESC`
      : `SELECT TOP 1 TV, Emisora, Serie, PrecioLimpio, PrecioSucio, TasaCuponVigente AS TasaCupon, CONVERT(varchar(10), DATEADD(day, DiasPorVencer, Fecha), 23) AS Vencimiento, Emisora AS NombreCompleto, 'Valmer' AS proveedor FROM vector_precios_gubernamental WITH (NOLOCK) WHERE UPPER(TRIM(Emisora))=@em AND UPPER(TRIM(Serie))=@se ORDER BY Fecha DESC`;

    const result = await queryWithRetry(db => {
      const r = db.request();
      r.input('em', sql.NVarChar, em);
      r.input('se', sql.NVarChar, se);
      return r.query(query);
    });

    if (!result.recordset.length) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
