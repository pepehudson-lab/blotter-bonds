import { queryWithRetry, sql } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { emisora, serie, dias = '0' } = req.query;
  if (!emisora || !serie)
    return res.status(400).json({ ok: false, error: 'Faltan parámetros: emisora y serie' });

  try {
    const em    = emisora.toUpperCase().trim();
    const se    = serie.toUpperCase().trim();
    const dias_ = parseInt(dias, 10) || 0;

    const makeReq = (db) => {
      const r = db.request();
      r.input('em',   sql.NVarChar, em);
      r.input('se',   sql.NVarChar, se);
      r.input('dias', sql.Int,      dias_);
      return r;
    };

    const [resV, resP] = await Promise.all([
      queryWithRetry(db => makeReq(db).query(`
        SELECT CONVERT(varchar(10), Fecha, 23) AS fecha,
               CAST(Rendimiento  AS FLOAT) AS tasa,
               CAST(Sobretasa    AS FLOAT) AS sobretasa,
               CAST(PrecioLimpio AS FLOAT) AS precioLimpio
        FROM vector_precios_gubernamental WITH (NOLOCK)
        WHERE UPPER(TRIM(Emisora))=@em AND UPPER(TRIM(Serie))=@se
          AND (@dias=0 OR Fecha>=DATEADD(day,-@dias,GETDATE()))
        ORDER BY Fecha ASC`)),
      queryWithRetry(db => makeReq(db).query(`
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
    res.status(500).json({ ok: false, error: err.message });
  }
}
