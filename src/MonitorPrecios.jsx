import { useState, useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

/* ─── Utilidades ─────────────────────────────────────────────────────── */
const fmt2  = n => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(2);
const fmt4  = n => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(4);
const fmtF  = d => d ? d.slice(2).replace(/-/g, "/") : "";        // "2024-03-01" → "24/03/01"

const RANGOS = [
  { label: "1M", dias: 30 },
  { label: "3M", dias: 90 },
  { label: "6M", dias: 180 },
  { label: "1A", dias: 365 },
  { label: "MAX", dias: 0 },
];

const COLOR_V = "#5bc8fa";   // Valmer — azul
const COLOR_P = "#fbbf24";   // PIP    — dorado
const COLOR_G = "#3ddc84";   // positivo
const COLOR_R = "#f87171";   // negativo

/* ─── Cálculo de estadísticas ─────────────────────────────────────────── */
function calcStats(data, key) {
  const vals = data.map(r => r[key]).filter(v => v != null && !isNaN(v));
  if (!vals.length) return {};
  return {
    min:     Math.min(...vals),
    max:     Math.max(...vals),
    current: vals[vals.length - 1],
    change:  vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null,
  };
}

/* ─── Tooltip custom ──────────────────────────────────────────────────── */
function TooltipCustom({ active, payload, label, unit = "%" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#080b12", border: "1px solid #263040", borderRadius: 4,
      padding: "10px 14px", fontFamily: "IBM Plex Mono,monospace", fontSize: 10,
      boxShadow: "0 4px 20px rgba(0,0,0,.7)",
    }}>
      <div style={{ color: "#fbbf24", fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
          <span style={{ color: "#7a9ab0", minWidth: 60 }}>{p.name}</span>
          <span style={{ color: p.color, fontWeight: 700 }}>{fmt4(p.value)}{unit}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Tarjeta de stat ─────────────────────────────────────────────────── */
function StatCard({ label, value, change, color }) {
  const pos = change >= 0;
  return (
    <div style={{ background: "#0b0e16", border: "1px solid #182030", borderRadius: 4, padding: "10px 14px" }}>
      <div style={{ fontSize: 8, color: "#2a4050", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: color || "#dce8f8" }}>{value}</div>
      {change != null && (
        <div style={{ fontSize: 9, marginTop: 3, color: pos ? COLOR_G : COLOR_R }}>
          {pos ? "▲" : "▼"} {fmt4(Math.abs(change))} vs inicio
        </div>
      )}
    </div>
  );
}

/* ─── Gráfico individual ──────────────────────────────────────────────── */
function GraficoPrecio({ data, titulo, claveV, claveP, loading, unit = "%" }) {
  const intervalo = data.length > 200 ? Math.floor(data.length / 8)
                  : data.length > 60  ? Math.floor(data.length / 6) : "preserveStartEnd";

  return (
    <div style={{ background: "#0b0e16", border: "1px solid #182030", borderRadius: 4, padding: "16px 12px 8px" }}>
      <div style={{ fontSize: 9, color: "#3a5060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#c0ccdf", fontWeight: 700 }}>{titulo}</span>
        {loading && <span style={{ color: "#fbbf24" }}>Cargando…</span>}
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#101820" vertical={false} />
            <XAxis
              dataKey="fecha" tickFormatter={fmtF} interval={intervalo}
              tick={{ fill: "#2a4050", fontSize: 8, fontFamily: "IBM Plex Mono" }}
              tickLine={false} axisLine={{ stroke: "#101820" }}
            />
            <YAxis
              domain={["auto", "auto"]} tickCount={6}
              tickFormatter={v => fmt2(v)}
              tick={{ fill: "#2a4050", fontSize: 8, fontFamily: "IBM Plex Mono" }}
              tickLine={false} axisLine={false} width={46}
            />
            <Tooltip content={<TooltipCustom unit={unit} />} />
            <Legend
              wrapperStyle={{ fontSize: 8, fontFamily: "IBM Plex Mono", color: "#3a5060",
                letterSpacing: "1.5px", textTransform: "uppercase", paddingTop: 6 }}
            />
            <Line
              type="monotone" dataKey={claveV} name="Valmer"
              stroke={COLOR_V} strokeWidth={1.5} dot={false} connectNulls
              activeDot={{ r: 3, fill: COLOR_V }}
            />
            <Line
              type="monotone" dataKey={claveP} name="PIP"
              stroke={COLOR_P} strokeWidth={1.5} dot={false} connectNulls
              strokeDasharray="4 2"
              activeDot={{ r: 3, fill: COLOR_P }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Buscador de emisoras (igual al del modal) ───────────────────────── */
function BuscadorEmisoras({ emisoras, cargando, onSelect, selActual }) {
  const [abierto, setAbierto] = useState(false);
  const [busq, setBusq]       = useState("");

  const seleccionar = (e) => { onSelect(e); setAbierto(false); setBusq(""); };

  return (
    <div style={{ position: "relative", maxWidth: 580 }}>
      {/* Trigger */}
      <div
        onClick={() => { if (!cargando) { setAbierto(d => !d); setBusq(""); } }}
        style={{
          background: "#0b0e16", border: `1px solid ${abierto ? "#fbbf24" : "#1c2633"}`,
          borderRadius: abierto ? "3px 3px 0 0" : 3,
          padding: "10px 14px", cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center", transition: "border .15s",
        }}
      >
        {selActual
          ? <span style={{ fontSize: 12, color: "#f0e4c0", fontWeight: 700 }}>
              <span style={{ fontSize: 8, color: "#5bc8fa", background: "#050a14", border: "1px solid #143060",
                borderRadius: 2, padding: "1px 5px", marginRight: 8 }}>{selActual.tv}</span>
              {selActual.emisora} · {selActual.serie}
              <span style={{ marginLeft: 8, fontSize: 8, color: "#3a5060" }}>({selActual.proveedor})</span>
            </span>
          : <span style={{ fontSize: 12, color: "#3a5060" }}>
              {cargando ? "● Cargando emisoras…" : "— Selecciona un instrumento para monitorear —"}
            </span>
        }
        <span style={{ color: "#3a5060", fontSize: 10, transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
      </div>

      {/* Panel */}
      {abierto && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "#07090e", border: "1px solid #fbbf24", borderTop: "none",
          borderRadius: "0 0 4px 4px", boxShadow: "0 8px 32px rgba(0,0,0,.7)",
        }}>
          {/* Buscador */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #101820", background: "#050710" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 10, color: "#3a5060", fontSize: 13, pointerEvents: "none" }}>⌕</span>
              <input
                autoFocus placeholder="Escribe emisora, serie o TV…" value={busq}
                onChange={e => setBusq(e.target.value)} onClick={e => e.stopPropagation()}
                style={{
                  background: "#0b0e16", border: "1px solid #263040", borderRadius: 3,
                  color: "#dce8f8", fontSize: 12, padding: "8px 10px 8px 30px",
                  width: "100%", outline: "none", fontFamily: "IBM Plex Mono,monospace",
                }}
              />
              {busq && (
                <button onClick={e => { e.stopPropagation(); setBusq(""); }}
                  style={{ position: "absolute", right: 8, background: "none", border: "none",
                    color: "#3a5060", cursor: "pointer", fontSize: 13 }}>✕</button>
              )}
            </div>
          </div>

          {/* Lista */}
          {(() => {
            const q = busq.trim().toUpperCase();
            const fil = arr => q ? arr.filter(e => e.emisora.includes(q) || e.serie.includes(q) || e.tv.includes(q)) : arr;
            const valmer = fil(emisoras.filter(e => e.proveedor === "Valmer"));
            const pip    = fil(emisoras.filter(e => e.proveedor === "PIP"));
            const MAX    = 80;

            if (!valmer.length && !pip.length) return (
              <div style={{ padding: "20px", textAlign: "center", color: "#3a5060", fontSize: 11 }}>
                Sin resultados para "<span style={{ color: "#fbbf24" }}>{busq}</span>"
              </div>
            );

            const renderGrupo = (arr, prov, color, bg, border) => arr.length === 0 ? null : (
              <div key={prov}>
                <div style={{ padding: "5px 12px", fontSize: 8, letterSpacing: 2, color, background: bg,
                  borderBottom: `1px solid ${border}`, textTransform: "uppercase", fontWeight: 800,
                  display: "flex", justifyContent: "space-between" }}>
                  <span>{prov}</span>
                  <span style={{ opacity: .6 }}>{arr.length}{arr.length > MAX ? ` (top ${MAX})` : ""}</span>
                </div>
                {arr.slice(0, MAX).map(e => {
                  const activo = selActual?.emisora === e.emisora && selActual?.serie === e.serie && selActual?.proveedor === prov;
                  return (
                    <div key={`${e.tv}|${e.emisora}|${e.serie}|${prov}`}
                      onClick={() => seleccionar({ ...e, proveedor: prov })}
                      style={{ padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center",
                        gap: 10, background: activo ? "#0f1a0f" : "transparent", borderBottom: "1px solid #0b0e16" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = activo ? "#0f1a0f" : "#0d111a"}
                      onMouseLeave={ev => ev.currentTarget.style.background = activo ? "#0f1a0f" : "transparent"}
                    >
                      <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 5px", borderRadius: 2,
                        background: "#080e18", color: "#5bc8fa", border: "1px solid #143060", minWidth: 28, textAlign: "center" }}>{e.tv}</span>
                      <span style={{ color: "#dce8f8", fontWeight: 700, fontSize: 12, flex: 1 }}>{e.emisora}</span>
                      <span style={{ color: "#3a5060", fontSize: 11 }}>{e.serie}</span>
                      {activo && <span style={{ color: COLOR_G, fontSize: 10 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            );

            return (
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {renderGrupo(valmer, "Valmer", "#5bc8fa", "#050a14", "#101828")}
                {renderGrupo(pip,    "PIP",    "#fbbf24", "#0a0800", "#201400")}
                <div style={{ padding: "6px 12px", fontSize: 8, color: "#2a3a4a", letterSpacing: 1,
                  borderTop: "1px solid #101820", textAlign: "center" }}>
                  {valmer.length + pip.length} resultados · afina la búsqueda para ver más
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Overlay cierre */}
      {abierto && (
        <div onClick={() => { setAbierto(false); setBusq(""); }}
          style={{ position: "fixed", inset: 0, zIndex: 199 }} />
      )}
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────────────────── */
export default function MonitorPrecios({ emisoras, cargandoEmisoras }) {
  const [instrSel, setInstrSel] = useState(null);
  const [rango,    setRango]    = useState("3M");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [rawV,     setRawV]     = useState([]);
  const [rawP,     setRawP]     = useState([]);

  /* Fetch histórico cuando cambia instrumento o rango */
  useEffect(() => {
    if (!instrSel) return;
    setLoading(true); setError(null);
    const dias = RANGOS.find(r => r.label === rango)?.dias ?? 90;
    fetch(`/api/historico?emisora=${instrSel.emisora}&serie=${instrSel.serie}&dias=${dias}`)
      .then(r => r.json())
      .then(json => {
        if (!json.ok) throw new Error(json.error);
        setRawV(json.valmer || []);
        setRawP(json.pip    || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [instrSel, rango]);

  /* Merge de datos para recharts */
  const chartData = useMemo(() => {
    const map = {};
    rawV.forEach(r => { map[r.fecha] = { ...map[r.fecha], fecha: r.fecha, tasaV: r.tasa, stV: r.sobretasa, pxV: r.precioLimpio }; });
    rawP.forEach(r => { map[r.fecha] = { ...map[r.fecha], fecha: r.fecha, tasaP: r.tasa, stP: r.sobretasa, pxP: r.precioLimpio }; });
    return Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [rawV, rawP]);

  /* Estadísticas */
  const stats = useMemo(() => ({
    tasaV:  calcStats(rawV, "tasa"),
    stV:    calcStats(rawV, "sobretasa"),
    tasaP:  calcStats(rawP, "tasa"),
    stP:    calcStats(rawP, "sobretasa"),
  }), [rawV, rawP]);

  return (
    <div>
      <style>{`
        .rng-btn{background:none;border:1px solid #1c2633;color:#3a5060;cursor:pointer;
          padding:5px 14px;border-radius:2px;font-family:inherit;font-size:9px;
          letter-spacing:2px;text-transform:uppercase;font-weight:700;transition:all .15s}
        .rng-btn:hover{color:#b0bccf;border-color:#3a5060}
        .rng-btn.activo{background:#181000;border-color:#fbbf24;color:#fbbf24}
      `}</style>

      {/* ── Cabecera y selector ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontSize: 9, color: "#2a4050", letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>
            Instrumento · Tasa y Sobretasa Histórica
          </div>
          <BuscadorEmisoras
            emisoras={emisoras} cargando={cargandoEmisoras}
            onSelect={setInstrSel} selActual={instrSel}
          />
        </div>

        {/* Selector de rango */}
        {instrSel && (
          <div style={{ display: "flex", gap: 4, alignSelf: "flex-end" }}>
            {RANGOS.map(r => (
              <button key={r.label} className={`rng-btn${rango === r.label ? " activo" : ""}`}
                onClick={() => setRango(r.label)}>{r.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── Estado vacío ── */}
      {!instrSel && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#1c2633" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Selecciona un instrumento para ver su histórico</div>
          <div style={{ fontSize: 9, marginTop: 6, color: "#1a2530" }}>Valmer · PIP · Tasa · Sobretasa</div>
        </div>
      )}

      {/* ── Error ── */}
      {instrSel && error && (
        <div style={{ background: "#120608", border: "1px solid #301418", borderRadius: 4, padding: "14px 18px",
          color: "#f87171", fontSize: 11, marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Contenido principal ── */}
      {instrSel && !error && (
        <>
          {/* Info del instrumento */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 2, background: "#050a14",
              color: "#5bc8fa", border: "1px solid #143060", fontWeight: 800, letterSpacing: 1 }}>{instrSel.tv}</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#f0e4c0", letterSpacing: 1 }}>{instrSel.emisora}</span>
            <span style={{ fontSize: 13, color: "#3a5060" }}>·</span>
            <span style={{ fontSize: 13, color: "#c0ccdf", fontWeight: 700 }}>Serie {instrSel.serie}</span>
            {loading && <span style={{ fontSize: 9, color: "#fbbf24", letterSpacing: 1, marginLeft: 8 }}>● Actualizando…</span>}
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#2a4050" }}>
              {rawV.length} obs. Valmer · {rawP.length} obs. PIP
            </span>
          </div>

          {/* Stats cards — 2 filas: Valmer | PIP */}
          {[
            { label: "VALMER", color: COLOR_V, tasaS: stats.tasaV, stS: stats.stV },
            { label: "PIP",    color: COLOR_P, tasaS: stats.tasaP, stS: stats.stP },
          ].filter(r => r.tasaS.current != null).map(row => (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 8, color: row.color, letterSpacing: 2, textTransform: "uppercase",
                marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 20, height: 2, background: row.color, display: "inline-block", borderRadius: 1 }} />
                {row.label}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr) repeat(4,1fr)", gap: 8 }}>
                <StatCard label="Tasa Actual"   value={`${fmt4(row.tasaS.current)}%`}  change={row.tasaS.change}  color={row.color} />
                <StatCard label="Tasa Mínima"   value={`${fmt4(row.tasaS.min)}%`}       color="#3a5060" />
                <StatCard label="Tasa Máxima"   value={`${fmt4(row.tasaS.max)}%`}       color="#3a5060" />
                <StatCard label="Rango Tasa"    value={`${fmt4((row.tasaS.max||0)-(row.tasaS.min||0))}%`} color="#7a9ab0" />
                <StatCard label="Sobretasa Act" value={`${fmt4(row.stS.current)}%`}    change={row.stS.change}   color={row.color} />
                <StatCard label="ST Mínima"     value={`${fmt4(row.stS.min)}%`}         color="#3a5060" />
                <StatCard label="ST Máxima"     value={`${fmt4(row.stS.max)}%`}         color="#3a5060" />
                <StatCard label="Rango ST"      value={`${fmt4((row.stS.max||0)-(row.stS.min||0))}%`}  color="#7a9ab0" />
              </div>
            </div>
          ))}

          {/* Gráficas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 6 }}>
            <GraficoPrecio
              data={chartData} titulo="Tasa / Rendimiento (%)"
              claveV="tasaV" claveP="tasaP"
              loading={loading} unit="%"
            />
            <GraficoPrecio
              data={chartData} titulo="Sobretasa (%)"
              claveV="stV" claveP="stP"
              loading={loading} unit="%"
            />
          </div>

          {/* Footer con leyenda de estilos de línea */}
          <div style={{ display: "flex", gap: 20, marginTop: 10, padding: "8px 0",
            borderTop: "1px solid #101820", fontSize: 9, color: "#2a4050", letterSpacing: 1 }}>
            <span><span style={{ color: COLOR_V }}>──</span> Valmer (línea continua)</span>
            <span><span style={{ color: COLOR_P }}>╌╌</span> PIP (línea punteada)</span>
            <span style={{ marginLeft: "auto" }}>Fuente: BD {instrSel.proveedor} · rango {rango}</span>
          </div>
        </>
      )}
    </div>
  );
}
