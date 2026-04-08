import React, { useState, useMemo, useEffect, useCallback } from "react";
import MonitorPrecios from "./MonitorPrecios.jsx";
import { sb, sbAdmin } from "./supabase.js";

// Valores por defecto — se sobreescriben con localStorage si existen
const CONTRAPARTES_DEFAULT = [
  "Goldman Sachs", "JPMorgan", "Morgan Stanley", "Barclays", "Deutsche Bank",
  "HSBC", "Citigroup", "BNP Paribas", "UBS", "Santander", "BBVA", "Banorte",
  "Banamex", "Scotiabank MX", "Inbursa", "Société Générale", "Natixis", "CaixaBank"
];
const OPERADORES_DEFAULT = ["J. Rivera", "M. Chen", "S. Park", "A. López", "C. Vega"];

const lsGet = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };

// Las emisoras se cargan dinámicamente desde la BD (ver useEffect en el componente)

const TIPOS_VENCIMIENTO = ["Bullet", "Amortizable", "Putable", "Convertible", "Sinking Fund", "Perpetuo"];
const CALIFICACIONES    = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "BB+", "BB", "B+"];
const MONEDAS           = ["USD", "MXN", "EUR"];

const genId = () => `AGY-${Date.now()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;

const fmt      = (n, d = 2) => n == null ? "-" : Number(n).toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtFecha = (s) => { if (!s) return "-"; const [y,m,d] = s.slice(0,10).split("-"); return `${d}/${m}/${y}`; };
const fmtMon = (n, mon = "USD") => {
  if (n == null) return "-";
  const sym = mon === "MXN" ? "MX$" : mon === "EUR" ? "€" : "$";
  const abs = Math.abs(n);
  const s   = abs >= 1e6 ? sym + fmt(abs / 1e6, 2) + "M" : sym + fmt(abs, 0);
  return n < 0 ? `-${s}` : s;
};
// Helpers P&L: signo explícito y color semántico
const pnlSigno = (n) => (n == null ? "" : n >= 0 ? "+" : "");   // fmtMon ya pone "-" para negativos
const pnlColor = (n) => (n == null ? "#b0bccf" : n >= 0 ? "#3ddc84" : "#f87171");
const fmtPnl   = (n, mon) => `${pnlSigno(n)}${fmtMon(n, mon)}`;  // "+$12,500" o "-$3,000"
const fmtDif   = (n, d=3) => n == null ? "-" : `${n >= 0 ? "+" : ""}${fmt(n, d)}`;  // "+0.350" o "-0.200"

const DATOS_INICIALES = [
  // Precio sucio = precio DIRECTO por título en moneda del bono (no % del par)
  // Importe = pxSucio × Títulos  |  Nominal = Títulos × V.N.
  { id:"AGY-2007", fecha:"2026-03-30", emisor:"CETES 280217",  isin:"",             tipo:"Gubernamental", cupon:0,     vencimiento:"2028-02-17", tipoVenc:"Bullet",      calificacion:"AAA",  moneda:"MXN", titulos:800000, valorNominal:10,   tipoCambio:1,     compradorCp:"Santander",      pxCompra:8.6008, vendedorCp:"Deutsche Bank",    pxVenta:8.5980, operador:"A. López",  estatus:"Booked" },
  { id:"AGY-2000", fecha:"2024-03-01", emisor:"US Treasury",   isin:"US912810TM06", tipo:"Gubernamental", cupon:4.25,  vencimiento:"2034-02-15", tipoVenc:"Bullet",      calificacion:"AAA",  moneda:"USD", titulos:5000,   valorNominal:1000, tipoCambio:17.15, compradorCp:"Goldman Sachs",  pxCompra:987.50, vendedorCp:"JPMorgan",         pxVenta:984.50, operador:"J. Rivera", estatus:"Liquidada" },
  { id:"AGY-2001", fecha:"2024-03-05", emisor:"Mexico Bonos",  isin:"MX0MGO0000Y6", tipo:"Gubernamental", cupon:8.50,  vencimiento:"2029-05-31", tipoVenc:"Bullet",      calificacion:"BBB+", moneda:"MXN", titulos:200000, valorNominal:100,  tipoCambio:1,     compradorCp:"Banorte",        pxCompra:99.95,  vendedorCp:"BBVA",             pxVenta:99.60,  operador:"M. Chen",  estatus:"Liquidada" },
  { id:"AGY-2002", fecha:"2024-03-10", emisor:"German Bund",   isin:"DE0001102614", tipo:"Gubernamental", cupon:2.30,  vencimiento:"2033-02-15", tipoVenc:"Bullet",      calificacion:"AAA",  moneda:"EUR", titulos:3000,   valorNominal:1000, tipoCambio:18.72, compradorCp:"Deutsche Bank",  pxCompra:972.00, vendedorCp:"BNP Paribas",      pxVenta:968.50, operador:"J. Rivera", estatus:"Liquidada" },
  { id:"AGY-2003", fecha:"2024-03-12", emisor:"PEMEX",         isin:"US706451DH72", tipo:"Corporativo",   cupon:6.50,  vencimiento:"2041-01-23", tipoVenc:"Amortizable", calificacion:"BB+",  moneda:"USD", titulos:2000,   valorNominal:1000, tipoCambio:17.15, compradorCp:"Citigroup",      pxCompra:880.00, vendedorCp:"Barclays",         pxVenta:875.00, operador:"S. Park",  estatus:"Liquidada" },
  { id:"AGY-2004", fecha:"2024-03-15", emisor:"América Móvil", isin:"US02364WAB35", tipo:"Corporativo",   cupon:6.375, vencimiento:"2035-03-01", tipoVenc:"Bullet",      calificacion:"A-",   moneda:"MXN", titulos:150000, valorNominal:100,  tipoCambio:1,     compradorCp:"Inbursa",        pxCompra:94.25,  vendedorCp:"Scotiabank MX",    pxVenta:94.75,  operador:"M. Chen",  estatus:"Pendiente" },
  { id:"AGY-2005", fecha:"2024-03-18", emisor:"Apple Inc.",    isin:"US037833DV97", tipo:"Corporativo",   cupon:3.75,  vencimiento:"2047-11-13", tipoVenc:"Amortizable", calificacion:"AA+",  moneda:"USD", titulos:1500,   valorNominal:1000, tipoCambio:17.15, compradorCp:"Morgan Stanley", pxCompra:958.50, vendedorCp:"UBS",              pxVenta:954.00, operador:"J. Rivera", estatus:"Liquidada" },
  { id:"AGY-2006", fecha:"2024-03-20", emisor:"Telefónica",    isin:"XS1044969937", tipo:"Corporativo",   cupon:3.875, vencimiento:"2032-04-06", tipoVenc:"Bullet",      calificacion:"BBB+", moneda:"EUR", titulos:4000,   valorNominal:1000, tipoCambio:18.72, compradorCp:"Santander",      pxCompra:978.00, vendedorCp:"Société Générale", pxVenta:974.50, operador:"S. Park",  estatus:"Pendiente" },
];

const calcPnl = (t) => {
  // Precio sucio = precio DIRECTO por título en la moneda del bono (no % del par)
  // Importe = pxSucio × Títulos
  const titulos = t.titulos      || 0;
  const vn      = t.valorNominal || 100;
  const tc      = t.tipoCambio   || 1;   // tipo de cambio a MXN (1 si ya es MXN)
  const nominal = titulos * vn;           // nominal total en moneda del bono

  const importeCompra    = t.pxCompra * titulos;          // precio directo × títulos (moneda del bono)
  const importeVenta     = t.pxVenta  * titulos;          // precio directo × títulos (moneda del bono)
  const importeCompraMXN = importeCompra * tc;            // convertido a MXN
  const importeVentaMXN  = importeVenta  * tc;            // convertido a MXN
  const diferencial      = t.pxCompra - t.pxVenta;       // diferencial en precio por título
  const pnl              = importeCompraMXN - importeVentaMXN; // P&L en MXN

  return { nominal, importeCompra, importeVenta, importeCompraMXN, importeVentaMXN, diferencial, pnl };
};

const statusClass = (s) => {
  if (s === "Liquidada")        return "p-liq";
  if (s === "Pendiente")        return "p-pend";
  if (s === "Cancelada")        return "p-canc";
  if (s === "Booked")           return "p-booked";
  if (s === "Booked/Corregido") return "p-corr";
  return "p-pend";
};

const colorCalif = (r) => {
  if (!r) return "#8a9ab0";
  if (r.startsWith("AAA")) return "#3ddc84";
  if (r.startsWith("AA"))  return "#5bc8fa";
  if (r.startsWith("A") && !r.startsWith("AA")) return "#f5c842";
  if (r.startsWith("BBB")) return "#f5a842";
  if (r.startsWith("BB"))  return "#ff8c5c";
  return "#f87171";
};

export default function BlotterBondsINVEX() {
  const [tab, setTab]           = useState("blotter");
  // Operaciones persisten en localStorage — sobreviven recargas y actualizaciones de código
  const [operaciones, setOps]    = useState([]);
  const [contrapartes,  setCp]  = useState(CONTRAPARTES_DEFAULT);
  const [operadores,    setOps2]= useState(OPERADORES_DEFAULT);
  const [calificaciones,setCal] = useState(CALIFICACIONES);
  const [tiposVenc,     setTV]  = useState(TIPOS_VENCIMIENTO);
  const [monedas,       setMon] = useState(MONEDAS);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filaExp, setFilaExp]   = useState(null);
  const [seleccionadas, setSelec] = useState(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [filtroCp, setFiltroCp] = useState("Todas");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroMon, setFiltroMon]   = useState("Todas");
  const [colOrden, setColOrden] = useState("fecha");
  const [dirOrden, setDirOrden] = useState("desc");
  const [plantillaSel, setPlantillaSel] = useState("");
  const [emisoras, setEmisoras]         = useState([]);
  const [cargandoEmisoras, setCargando] = useState(false);
  const [dropdownAbierto, setDropdown]  = useState(false);
  const [busqEmisora, setBusqEmisora]   = useState("");
  const [modoCorreccion, setModoCorr]   = useState(null); // ticket que se está corrigiendo

  // ── AUTH (Supabase) ───────────────────────────────────────────────────────
  const [usuarios,    setUsuarios]  = useState([]);
  const [sesion,      setSesion]    = useState(null);
  const [loginUser,   setLoginUser] = useState("");
  const [loginPwd,    setLoginPwd]  = useState("");
  const [loginError,  setLoginError] = useState("");
  const [appCargando, setAppCargando] = useState(true);

  // DB field mappers
  const mapOpToDb = (op) => ({
    id: op.id, fecha: op.fecha, emisor: op.emisor, isin: op.isin || null,
    tipo: op.tipo, cupon: op.cupon || null, vencimiento: op.vencimiento || null,
    tipo_venc: op.tipoVenc || null, calificacion: op.calificacion || null,
    moneda: op.moneda, titulos: op.titulos, valor_nominal: op.valorNominal,
    tipo_cambio: op.tipoCambio || 1, comprador_cp: op.compradorCp || null,
    px_compra: op.pxCompra, vendedor_cp: op.vendedorCp || null,
    px_venta: op.pxVenta, operador: op.operador || null,
    estatus: op.estatus || 'Booked', notas: op.notas || null,
  });
  const mapOpFromDb = (row) => ({
    id: row.id, fecha: row.fecha, emisor: row.emisor, isin: row.isin,
    tipo: row.tipo, cupon: Number(row.cupon || 0), vencimiento: row.vencimiento,
    tipoVenc: row.tipo_venc, calificacion: row.calificacion, moneda: row.moneda,
    titulos: Number(row.titulos), valorNominal: Number(row.valor_nominal),
    tipoCambio: Number(row.tipo_cambio || 1), compradorCp: row.comprador_cp,
    pxCompra: Number(row.px_compra), vendedorCp: row.vendedor_cp,
    pxVenta: Number(row.px_venta), operador: row.operador,
    estatus: row.estatus, notas: row.notas,
  });

  const cargarDatos = useCallback(async () => {
    const [{ data: ops }, { data: cps }, { data: ops2 }, { data: cals }, { data: tvs }, { data: mons }, { data: usrs }] = await Promise.all([
      sb.from('operaciones').select('*').order('fecha', { ascending: false }),
      sb.from('contrapartes').select('nombre').order('nombre'),
      sb.from('operadores').select('nombre').order('nombre'),
      sb.from('calificaciones').select('nombre'),
      sb.from('tipos_venc').select('nombre'),
      sb.from('monedas').select('nombre'),
      sb.from('profiles').select('*').order('creado'),
    ]);
    if (ops)        setOps(ops.map(mapOpFromDb));
    if (cps?.length) setCp(cps.map(r => r.nombre));
    if (ops2?.length) setOps2(ops2.map(r => r.nombre));
    if (cals?.length) setCal(cals.map(r => r.nombre));
    if (tvs?.length)  setTV(tvs.map(r => r.nombre));
    if (mons?.length) setMon(mons.map(r => r.nombre));
    if (usrs)       setUsuarios(usrs);
  }, []); // eslint-disable-line

  // Restore session on mount
  useEffect(() => {
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile && profile.activo) {
          setSesion({ id: profile.id, nombre: profile.nombre, usuario: profile.usuario, rol: profile.rol });
          await cargarDatos();
        } else {
          await sb.auth.signOut();
        }
      }
      setAppCargando(false);
    });
  }, [cargarDatos]);

  // Real-time: refresh operaciones when any user makes changes
  useEffect(() => {
    if (!sesion) return;
    const ch = sb.channel('ibb-ops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operaciones' }, async () => {
        const { data } = await sb.from('operaciones').select('*').order('fecha', { ascending: false });
        if (data) setOps(data.map(mapOpFromDb));
      })
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [sesion]); // eslint-disable-line

  const loginUsuario = async () => {
    setLoginError("");
    const { data, error } = await sb.auth.signInWithPassword({
      email: `${loginUser.trim()}@ibb.mx`,
      password: loginPwd,
    });
    if (error) { setLoginError("Usuario o contraseña incorrectos"); return; }
    const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
    if (!profile || !profile.activo) {
      await sb.auth.signOut();
      setLoginError("Usuario inactivo. Contacta al administrador.");
      return;
    }
    setSesion({ id: profile.id, nombre: profile.nombre, usuario: profile.usuario, rol: profile.rol });
    setTab("blotter");
    setLoginError("");
    setLoginPwd("");
    await cargarDatos();
  };

  const logoutUsuario = async () => {
    await sb.auth.signOut();
    setSesion(null);
    setLoginUser(""); setLoginPwd(""); setLoginError("");
    setOps([]); setCp(CONTRAPARTES_DEFAULT); setOps2(OPERADORES_DEFAULT);
    setCal(CALIFICACIONES); setTV(TIPOS_VENCIMIENTO); setMon(MONEDAS);
    setUsuarios([]);
  };

  // Supabase-synced setters for master lists
  const makeSyncedSetter = (setter, tabla) => (upd) => setter(prev => {
    const next = typeof upd === 'function' ? upd(prev) : upd;
    const toAdd    = next.filter(x => !prev.includes(x));
    const toRemove = prev.filter(x => !next.includes(x));
    if (toAdd.length)    sb.from(tabla).insert(toAdd.map(nombre => ({ nombre }))).then();
    if (toRemove.length) sb.from(tabla).delete().in('nombre', toRemove).then();
    return next;
  });
  const setCpDB   = makeSyncedSetter(setCp,   'contrapartes');
  const setOps2DB = makeSyncedSetter(setOps2, 'operadores');
  const setCalDB  = makeSyncedSetter(setCal,  'calificaciones');
  const setTVDB   = makeSyncedSetter(setTV,   'tipos_venc');
  const setMonDB  = makeSyncedSetter(setMon,  'monedas');
  // ─────────────────────────────────────────────────────────────────────────

  const formVacio = { fecha: new Date().toISOString().slice(0, 10), emisor: "", isin: "", tipo: "Gubernamental", cupon: "", vencimiento: "", tipoVenc: "Bullet", calificacion: "A", moneda: "MXN", titulos: "", valorNominal: "100", tipoCambio: "1", compradorCp: "", pxCompra: "", vendedorCp: "", pxVenta: "", operador: "", estatus: "Booked" };
  const [form, setForm] = useState(formVacio);
  const sF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Carga emisoras desde la BD al montar
  useEffect(() => {
    setCargando(true);
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/emisoras`)
      .then(r => r.json())
      .then(({ data }) => setEmisoras(data || []))
      .catch(() => setEmisoras([]))
      .finally(() => setCargando(false));
  }, []);

  const aplicarPlantilla = async (key) => {
    if (!key) return;
    const [emisora, serie, proveedor] = key.split('|');
    if (!emisora || !serie) return;
    setPlantillaSel(key);
    // Pre-llena emisor y serie
    setForm(f => ({ ...f, emisor: `${emisora} ${serie}`, tipo: "Gubernamental", moneda: "MXN" }));
    // Intenta obtener precio y datos del bono
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/precio?emisora=${emisora}&serie=${serie}&proveedor=${proveedor}`);
      const json = await res.json();
      if (json.ok) {
        const d = json.data;
        setForm(f => ({
          ...f,
          emisor:      `${emisora} ${serie}`,
          cupon:       d.TasaCupon ?? f.cupon,
          vencimiento: d.Vencimiento ? new Date(d.Vencimiento).toISOString().slice(0,10) : f.vencimiento,
          pxCompra:    d.PrecioLimpio ? parseFloat(d.PrecioLimpio).toFixed(4) : f.pxCompra,
          pxVenta:     d.PrecioLimpio ? parseFloat(d.PrecioLimpio).toFixed(4) : f.pxVenta,
        }));
      }
    } catch { /* si falla el precio, solo continúa con emisor/serie */ }
  };

  const cerrarModal = () => {
    setMostrarForm(false);
    setModoCorr(null);
    setForm(formVacio);
    setPlantillaSel("");
    setDropdown(false);
    setBusqEmisora("");
  };

  const registrarOp = async () => {
    if (!form.emisor || !form.titulos || !form.valorNominal || !form.pxCompra || !form.pxVenta || !form.compradorCp || !form.vendedorCp) return;
    const newOp = {
      ...form,
      id:           genId(),
      titulos:      parseFloat(form.titulos),
      valorNominal: parseFloat(form.valorNominal),
      tipoCambio:   parseFloat(form.tipoCambio) || 1,
      pxCompra:     parseFloat(form.pxCompra),
      pxVenta:      parseFloat(form.pxVenta),
      cupon:        parseFloat(form.cupon),
      estatus:      "Booked",
    };
    setOps(prev => [newOp, ...prev]);
    await sb.from('operaciones').insert(mapOpToDb(newOp));
    cerrarModal();
  };

  const abrirCorreccion = (ticket) => {
    setModoCorr(ticket);
    setForm({ ...ticket, pxCompra: String(ticket.pxCompra), pxVenta: String(ticket.pxVenta), titulos: String(ticket.titulos || ""), valorNominal: String(ticket.valorNominal || 100), tipoCambio: String(ticket.tipoCambio || 1), cupon: String(ticket.cupon), estatus: "Booked/Corregido" });
    setPlantillaSel("");
    setMostrarForm(true);
    setFilaExp(null);
  };

  const confirmarCorreccion = async () => {
    if (!form.emisor || !form.titulos || !form.valorNominal || !form.pxCompra || !form.pxVenta || !form.compradorCp || !form.vendedorCp) return;
    const updatedOp = { ...form, id: modoCorreccion.id,
      titulos:      parseFloat(form.titulos),
      valorNominal: parseFloat(form.valorNominal),
      tipoCambio:   parseFloat(form.tipoCambio) || 1,
      pxCompra:     parseFloat(form.pxCompra),
      pxVenta:      parseFloat(form.pxVenta),
      cupon:        parseFloat(form.cupon),
      estatus:      "Booked/Corregido",
    };
    setOps(prev => prev.map(t => t.id === modoCorreccion.id ? updatedOp : t));
    await sb.from('operaciones').update(mapOpToDb(updatedOp)).eq('id', modoCorreccion.id);
    cerrarModal();
  };

  const cancelarOp = async (id) => {
    setOps(prev => prev.map(t => t.id === id ? { ...t, estatus: "Cancelada" } : t));
    await sb.from('operaciones').update({ estatus: "Cancelada" }).eq('id', id);
    setFilaExp(null);
  };

  const toggleSelec = (id) => setSelec(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleTodas = (lista) => setSelec(prev => prev.size === lista.length && lista.every(t => prev.has(t.id)) ? new Set() : new Set(lista.map(t => t.id)));
  const cancelarBulk = async () => {
    if (!seleccionadas.size) return;
    if (!window.confirm(`¿Cancelar ${seleccionadas.size} operación(es) seleccionada(s)?`)) return;
    const ids = [...seleccionadas];
    setOps(prev => prev.map(t => ids.includes(t.id) ? { ...t, estatus: "Cancelada" } : t));
    await sb.from('operaciones').update({ estatus: "Cancelada" }).in('id', ids);
    setSelec(new Set());
  };
  const eliminarBulk = async () => {
    if (!seleccionadas.size) return;
    if (!window.confirm(`¿Eliminar permanentemente ${seleccionadas.size} operación(es)? Esta acción no se puede deshacer.`)) return;
    const ids = [...seleccionadas];
    setOps(prev => prev.filter(t => !ids.includes(t.id)));
    await sb.from('operaciones').delete().in('id', ids);
    setSelec(new Set());
    setFilaExp(null);
  };

  const enriquecidas = useMemo(() => operaciones.map(t => ({ ...t, ...calcPnl(t) })), [operaciones]);

  // P&L total en MXN — todos ya convertidos con tipoCambio
  const pnlTotalMXN = useMemo(() => enriquecidas.reduce((s, t) => s + t.pnl, 0), [enriquecidas]);

  // Aggregados por moneda (en la moneda original + equivalente MXN)
  const pnlPorMoneda = useMemo(() => {
    const m = {};
    enriquecidas.forEach(t => {
      if (!m[t.moneda]) m[t.moneda] = { pnl: 0, pnlMXN: 0, nominal: 0 };
      m[t.moneda].pnl    += (t.importeCompra - t.importeVenta);  // en moneda original
      m[t.moneda].pnlMXN += t.pnl;                                // en MXN
      m[t.moneda].nominal += t.nominal;
    });
    return m;
  }, [enriquecidas]);

  const difPromedio  = enriquecidas.length ? enriquecidas.reduce((s, t) => s + t.diferencial, 0) / enriquecidas.length : 0;

  // P&L acumulado TDY / MTD / YTD — solo operaciones vivas (no Canceladas)
  const pnlAcumulado = useMemo(() => {
    const hoy  = new Date().toISOString().slice(0, 10);
    const mes  = hoy.slice(0, 7);
    const anio = hoy.slice(0, 4);
    const vivas = enriquecidas.filter(t => t.estatus !== "Cancelada");
    const calcPeriodo = (lista) => {
      const total = lista.reduce((s, t) => s + t.pnl, 0);
      const porMoneda = {};
      lista.forEach(t => {
        if (!porMoneda[t.moneda]) porMoneda[t.moneda] = { pnlMXN: 0, ops: 0 };
        porMoneda[t.moneda].pnlMXN += t.pnl;
        porMoneda[t.moneda].ops++;
      });
      return { total, ops: lista.length, porMoneda };
    };
    return {
      hoy,
      tdy: calcPeriodo(vivas.filter(t => (t.fecha || "").slice(0, 10) === hoy)),
      mtd: calcPeriodo(vivas.filter(t => (t.fecha || "").slice(0, 7)  === mes)),
      ytd: calcPeriodo(vivas.filter(t => (t.fecha || "").slice(0, 4)  === anio)),
      totalVivas: vivas.length,
    };
  }, [enriquecidas]);

  const filtradas = useMemo(() => {
    let lista = enriquecidas;
    if (filtroCp   !== "Todas") lista = lista.filter(t => t.compradorCp === filtroCp || t.vendedorCp === filtroCp);
    if (filtroTipo !== "Todos") lista = lista.filter(t => t.tipo === filtroTipo);
    if (filtroMon  !== "Todas") lista = lista.filter(t => t.moneda === filtroMon);
    if (busqueda) lista = lista.filter(t => [t.emisor, t.isin, t.id, t.compradorCp, t.vendedorCp].join(" ").toLowerCase().includes(busqueda.toLowerCase()));
    return [...lista].sort((a, b) => {
      let av = a[colOrden], bv = b[colOrden];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return dirOrden === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [enriquecidas, filtroCp, filtroTipo, filtroMon, busqueda, colOrden, dirOrden]);

  const ordenar = (col) => { if (colOrden === col) setDirOrden(d => d === "asc" ? "desc" : "asc"); else { setColOrden(col); setDirOrden("asc"); } };
  const SI = ({ col }) => <span style={{ color: "#2a3a4a", fontSize: 9 }}>{colOrden === col ? (dirOrden === "asc" ? "↑" : "↓") : "⇅"}</span>;

  const reporteCp = useMemo(() => {
    const mapa = {};
    enriquecidas.forEach(t => {
      [["compra", t.compradorCp, t.nominal], ["venta", t.vendedorCp, t.nominal]].forEach(([rol, nombre, nom]) => {
        if (!mapa[nombre]) mapa[nombre] = { nombre, comoComprador: 0, comoVendedor: 0, ops: 0, nomCompra: 0, nomVenta: 0 };
        mapa[nombre].ops++;
        if (rol === "compra") { mapa[nombre].comoComprador++; mapa[nombre].nomCompra += nom; }
        else                  { mapa[nombre].comoVendedor++;  mapa[nombre].nomVenta  += nom; }
      });
    });
    return Object.values(mapa).sort((a, b) => (b.nomCompra + b.nomVenta) - (a.nomCompra + a.nomVenta));
  }, [enriquecidas]);

  const reporteOperador = useMemo(() => {
    const mapa = {};
    enriquecidas.forEach(t => {
      const k = t.operador || "Sin asignar";
      if (!mapa[k]) mapa[k] = { operador: k, ops: 0, nominal: 0, pnl: 0, totalDif: 0 };
      mapa[k].ops++; mapa[k].nominal += t.nominal; mapa[k].pnl += t.pnl; mapa[k].totalDif += t.diferencial;
    });
    return Object.values(mapa).sort((a, b) => b.pnl - a.pnl);
  }, [enriquecidas]);

  const colorMon = { USD: "#3ddc84", MXN: "#f87171", EUR: "#818cf8" };

  return (
    <div style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", background: "#07090e", minHeight: "100vh", color: "#b0bccf" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px;background:#07090e}
        ::-webkit-scrollbar-thumb{background:#1c2633;border-radius:3px}
        .tab{background:none;border:none;color:#3a5060;font-family:inherit;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;padding:10px 16px;border-bottom:2px solid transparent;transition:all .2s;font-weight:600}
        .tab.on{color:#fbbf24;border-bottom-color:#fbbf24}
        .tab:hover:not(.on){color:#7a9ab0}
        input,select{background:#0b0e16;border:1px solid #1c2633;color:#c0ccdf;font-family:inherit;font-size:12px;padding:8px 10px;border-radius:3px;outline:none;width:100%;transition:border .2s}
        input:focus,select:focus{border-color:#fbbf24}
        select option{background:#0b0e16}
        .btn-gold{font-family:inherit;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;padding:9px 20px;border-radius:3px;font-weight:700;transition:all .15s;background:#221800;border:1px solid #fbbf24;color:#fbbf24}
        .btn-gold:hover{background:#fbbf24;color:#050810}
        .btn-ghost{background:none;border:1px solid #1c2633;color:#3a5060;cursor:pointer;padding:8px 16px;border-radius:3px;font-family:inherit;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;transition:all .15s}
        .btn-ghost:hover{color:#b0bccf;border-color:#3a5060}
        .card{background:#0b0e16;border:1px solid #182030;border-radius:4px}
        .th{background:#050710;color:#2a4050;font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:9px 10px;text-align:left;border-bottom:1px solid #101820;cursor:pointer;white-space:nowrap;user-select:none;transition:color .15s}
        .th:hover{color:#7a9ab0}
        .td{padding:8px 10px;font-size:11px;border-bottom:1px solid #0b0e16;white-space:nowrap;vertical-align:middle}
        .fila:hover .td{background:#0d111a}
        .pill{display:inline-block;padding:2px 7px;border-radius:2px;font-size:9px;font-weight:700;letter-spacing:1px}
        .p-gub{background:#071422;color:#5bc8fa;border:1px solid #143060}
        .p-corp{background:#181208;color:#fbbf24;border:1px solid #302810}
        .p-liq{background:#071408;color:#3ddc84;border:1px solid #143820}
        .p-pend{background:#181208;color:#f5a842;border:1px solid #302810}
        .p-canc{background:#180708;color:#f87171;border:1px solid #301418}
        .p-booked{background:#060e1a;color:#5bc8fa;border:1px solid #143060}
        .p-corr{background:#1a0e00;color:#fb923c;border:1px solid #502800}
        .p-usd{background:#071408;color:#3ddc84;border:1px solid #143820}
        .p-mxn{background:#180709;color:#f87171;border:1px solid #301418}
        .p-eur{background:#07071a;color:#818cf8;border:1px solid #141434}
        .modal-bg{position:fixed;inset:0;background:rgba(3,5,10,.9);z-index:100;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}
        .modal{background:#07090e;border:1px solid #263040;border-radius:6px;width:840px;max-height:92vh;overflow-y:auto}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
        .lbl{font-size:9px;color:#2a4050;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
        .hr{border:none;border-top:1px solid #101820}
        .pos{color:#3ddc84}.neg{color:#f87171}
        .cb-cell{width:32px;padding:0 8px;text-align:center;border-bottom:1px solid #0b0e16;vertical-align:middle}
        .cb-cell input[type=checkbox]{width:13px;height:13px;cursor:pointer;accent-color:#fbbf24;background:#0b0e16;border:1px solid #2a4050;border-radius:2px}
        .bulk-bar{display:flex;align-items:center;gap:8px;background:#0b0f1c;border:1px solid #2a3850;border-radius:3px;padding:6px 14px;animation:fadeIn .15s}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .btn-red{font-family:inherit;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;padding:7px 16px;border-radius:3px;font-weight:700;transition:all .15s;background:#180708;border:1px solid #f87171;color:#f87171}
        .btn-red:hover{background:#f87171;color:#050810}
        .btn-cancel-bulk{font-family:inherit;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;padding:7px 16px;border-radius:3px;font-weight:700;transition:all .15s;background:#181208;border:1px solid #f5a842;color:#f5a842}
        .btn-cancel-bulk:hover{background:#f5a842;color:#050810}
        .p-admin{background:#071422;color:#5bc8fa;border:1px solid #143060}
        .p-trader{background:#071408;color:#3ddc84;border:1px solid #143820}
        .login-bg{position:fixed;inset:0;background:#03050a;z-index:200;display:flex;align-items:center;justify-content:center}
        .login-card{background:#07090e;border:1px solid #263040;border-radius:8px;width:360px;padding:36px 32px}
        .btn-login{font-family:inherit;font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;padding:11px 0;border-radius:3px;font-weight:700;transition:all .15s;background:#221800;border:1px solid #fbbf24;color:#fbbf24;width:100%}
        .btn-login:hover{background:#fbbf24;color:#050810}
        .btn-logout{background:none;border:1px solid #1c2633;color:#3a5060;cursor:pointer;padding:6px 12px;border-radius:3px;font-family:inherit;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;transition:all .15s}
        .btn-logout:hover{color:#f87171;border-color:#f87171}
      `}</style>

      {/* ── LOADING SCREEN ───────────────────────────────────────────────── */}
      {appCargando && (
        <div className="login-bg" style={{ flexDirection: "column", gap: 16 }}>
          <img src="/logoinvex.svg" alt="INVEX" style={{ height: 20, filter: "brightness(0) invert(1)", opacity: .6 }} />
          <div style={{ fontSize: 10, color: "#2a4050", letterSpacing: 3 }}>CARGANDO…</div>
        </div>
      )}

      {/* ── LOGIN SCREEN ─────────────────────────────────────────────────── */}
      {!appCargando && !sesion && (
        <div className="login-bg">
          <div className="login-card">
            {/* Branding */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <img src="/logoinvex.svg" alt="INVEX" style={{ height: 20, filter: "brightness(0) invert(1)", opacity: .85, marginBottom: 14 }} />
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24", letterSpacing: 6, lineHeight: 1 }}>IBB</div>
              <div style={{ fontSize: 9, color: "#3a5060", letterSpacing: 3, marginTop: 4 }}>INVEX BOND BLOTTER</div>
              <div style={{ width: 40, height: 1, background: "#fbbf2440", margin: "16px auto 0" }} />
            </div>
            {/* Form */}
            <div style={{ marginBottom: 12 }}>
              <div className="lbl" style={{ marginBottom: 5 }}>Usuario</div>
              <input
                value={loginUser} onChange={e => setLoginUser(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loginUsuario()}
                placeholder="tu usuario" autoFocus autoComplete="username"
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div className="lbl" style={{ marginBottom: 5 }}>Contraseña</div>
              <input
                type="password" value={loginPwd} onChange={e => setLoginPwd(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loginUsuario()}
                placeholder="••••••••" autoComplete="current-password"
                style={{ width: "100%" }}
              />
            </div>
            {loginError && (
              <div style={{ fontSize: 10, color: "#f87171", marginBottom: 14, textAlign: "center", letterSpacing: .5 }}>
                ✕ {loginError}
              </div>
            )}
            <button className="btn-login" onClick={loginUsuario}>Iniciar Sesión</button>
            <div style={{ fontSize: 9, color: "#2a3a4a", marginTop: 16, textAlign: "center", letterSpacing: .5 }}>
              Contacta al administrador para restablecer tu contraseña
            </div>
          </div>
        </div>
      )}

      {/* ENCABEZADO */}
      <div style={{ background: "#040610", borderBottom: "1px solid #101820" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Logo INVEX */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/logoinvex.svg"
                alt="INVEX"
                style={{ height: 22, width: "auto", filter: "brightness(0) invert(1)", opacity: 0.92 }}
              />
              <div style={{ width: 1, height: 24, background: "#fbbf2430" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fbbf24", letterSpacing: 4, lineHeight: 1 }}>IBB</div>
                <div style={{ fontSize: 8, color: "#3a5060", letterSpacing: 2, marginTop: 3 }}>INVEX BOND BLOTTER</div>
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: "#182030" }} />
            <div>
              <div style={{ fontSize: 9, color: "#3a5060", letterSpacing: 2 }}>Renta Fija · Mesa de Agencia · USD · MXN · EUR</div>
            </div>
            <div style={{ width: 1, height: 28, background: "#182030", margin: "0 8px" }} />
            <div style={{ fontSize: 9, color: "#3a5060" }}>
              <span style={{ color: "#fbbf24" }}>●</span>&nbsp;EN VIVO &nbsp;
              <span style={{ color: "#b0bccf" }}>{new Date().toLocaleString("es-MX")}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {sesion && (
              <>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#b0bccf", letterSpacing: .5 }}>{sesion.nombre}</div>
                  <div style={{ marginTop: 2 }}><span className={`pill p-${sesion.rol}`}>{sesion.rol.toUpperCase()}</span></div>
                </div>
                <button className="btn-logout" onClick={logoutUsuario}>⏻ Salir</button>
                <div style={{ width: 1, height: 24, background: "#182030" }} />
              </>
            )}
            <button className="btn-gold" onClick={() => setMostrarForm(true)}>＋ Registrar Operación</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, padding: "0 24px", marginTop: 8 }}>
          {[["blotter","Blotter"],["pnl","Reporte P&L"],["cp","Contrapartes"],["operador","Operadores"],["moneda","Por Moneda"],["monitor","Monitor Precios"],
            ...(sesion?.rol === "admin" ? [["admin","⚙ Administración"]] : [])
          ].map(([k,v]) => (
            <button key={k} className={`tab${tab===k?" on":""}`} onClick={() => setTab(k)}>{v}</button>
          ))}
        </div>
      </div>

      {/* BARRA DE RESUMEN — FILA 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 1, background: "#101820" }}>
        {[
          ["Operaciones",      operaciones.length,                                                         ""],
          ["Diferencial Prom.",fmtDif(difPromedio) + " pts",                                              ""],
          ["Gubern. / Corp.",  `${enriquecidas.filter(t=>t.tipo==="Gubernamental").length} / ${enriquecidas.filter(t=>t.tipo==="Corporativo").length}`, ""],
        ].map(([l,v]) => (
          <div key={l} style={{ background: "#07090e", padding: "9px 18px" }}>
            <div className="lbl">{l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#dce8f8", letterSpacing: .5 }}>{v}</div>
          </div>
        ))}
        {/* P&L total en MXN */}
        <div style={{ background: "#07090e", padding: "9px 18px" }}>
          <div className="lbl" style={{ marginBottom: 4 }}>P&L Total (MXN)</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: pnlColor(pnlTotalMXN), letterSpacing: .5 }}>{fmtPnl(pnlTotalMXN, "MXN")}</div>
        </div>
        {/* Desglose por moneda */}
        <div style={{ background: "#07090e", padding: "9px 18px", gridColumn: "span 2" }}>
          <div className="lbl" style={{ marginBottom: 5 }}>Desglose por moneda (equiv. MXN)</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {["USD","MXN","EUR"].map(mon => {
              const d = pnlPorMoneda[mon];
              if (!d) return null;
              return (
                <div key={mon} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span className={`pill p-${mon.toLowerCase()}`} style={{ fontSize: 8 }}>{mon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: pnlColor(d.pnlMXN) }}>{fmtPnl(d.pnlMXN, "MXN")}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BARRA DE RESUMEN — FILA 2: P&L ACUMULADO TDY / MTD / YTD */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#101820", borderBottom: "1px solid #101820" }}>
        {[
          { key: "tdy", label: "TDY", sublabel: "Hoy",         color: "#3ddc84", dimColor: "#143820" },
          { key: "mtd", label: "MTD", sublabel: "Mes en curso", color: "#5bc8fa", dimColor: "#0d1a28" },
          { key: "ytd", label: "YTD", sublabel: "Año en curso", color: "#fbbf24", dimColor: "#201400" },
        ].map(({ key, label, sublabel, color, dimColor }) => {
          const p = pnlAcumulado[key];
          return (
            <div key={key} style={{ background: "#07090e", padding: "7px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              {/* Badge periodo */}
              <div style={{ background: dimColor, border: `1px solid ${color}22`, borderRadius: 3, padding: "3px 8px", minWidth: 38, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color, letterSpacing: 2, lineHeight: 1 }}>{label}</div>
                <div style={{ fontSize: 7, color: color + "80", letterSpacing: 1, marginTop: 1, textTransform: "uppercase" }}>{sublabel}</div>
              </div>
              {/* Valor P&L */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: p.ops > 0 ? 15 : 12, fontWeight: 900, color: p.ops > 0 ? pnlColor(p.total) : "#1c2633", letterSpacing: .3, lineHeight: 1 }}>
                  {p.ops > 0 ? `${pnlSigno(p.total)}MX$${fmt(p.total, 0)}` : "—"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                  {p.ops > 0
                    ? ["USD","MXN","EUR"].filter(m => p.porMoneda[m]).map(m => (
                        <span key={m} style={{ fontSize: 9, color: pnlColor(p.porMoneda[m].pnlMXN) }}>
                          <span className={`pill p-${m.toLowerCase()}`} style={{ fontSize: 7, marginRight: 3 }}>{m}</span>
                          {pnlSigno(p.porMoneda[m].pnlMXN)}MX${fmt(p.porMoneda[m].pnlMXN, 0)}
                        </span>
                      ))
                    : <span style={{ fontSize: 9, color: "#1c2633", letterSpacing: .5 }}>Sin ops en este período</span>
                  }
                </div>
              </div>
              {/* Conteo ops vivas */}
              <div style={{ textAlign: "right", borderLeft: "1px solid #0f1820", paddingLeft: 12 }}>
                <div style={{ fontSize: 9, color: "#2a4050", letterSpacing: 1, textTransform: "uppercase" }}>Ops vivas</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: p.ops > 0 ? "#c0ccdf" : "#1c2633" }}>{p.ops}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* BLOTTER */}
        {tab === "blotter" && <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ maxWidth: 270 }} placeholder="🔍  Buscar emisor, ISIN, contraparte…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <select style={{ width: 170 }} value={filtroCp} onChange={e => setFiltroCp(e.target.value)}>
              <option value="Todas">Todas las Contrapartes</option>
              {contrapartes.map(c => <option key={c}>{c}</option>)}
            </select>
            <select style={{ width: 140 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="Todos">Todos los Tipos</option>
              <option>Gubernamental</option><option>Corporativo</option>
            </select>
            <select style={{ width: 110 }} value={filtroMon} onChange={e => setFiltroMon(e.target.value)}>
              <option value="Todas">Todas las Monedas</option>
              {monedas.map(c => <option key={c}>{c}</option>)}
            </select>
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#3a5060", letterSpacing: 1 }}>{filtradas.length} OPERACIÓN{filtradas.length !== 1 ? "ES" : ""}</span>
          </div>

          {seleccionadas.size > 0 && (
            <div className="bulk-bar" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", letterSpacing: 1 }}>
                {seleccionadas.size} OPERACIÓN{seleccionadas.size !== 1 ? "ES" : ""} SELECCIONADA{seleccionadas.size !== 1 ? "S" : ""}
              </span>
              <div style={{ width: 1, height: 16, background: "#2a3850", margin: "0 4px" }} />
              <button className="btn-cancel-bulk" onClick={cancelarBulk}>✕ Cancelar Selección</button>
              <button className="btn-red" onClick={eliminarBulk}>🗑 Eliminar Selección</button>
              <button className="btn-ghost" style={{ marginLeft: 4 }} onClick={() => setSelec(new Set())}>Limpiar Selección</button>
            </div>
          )}

          <div className="card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="th cb-cell" style={{ cursor: "default" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox"
                      checked={filtradas.length > 0 && filtradas.every(t => seleccionadas.has(t.id))}
                      onChange={() => toggleTodas(filtradas)}
                      title="Seleccionar todas"
                    />
                  </th>
                  {[["id","ID"],["fecha","Fecha"],["emisor","Bono"],["tipo","Tipo"],["calificacion","Cal."],["moneda","Mon."],["titulos","Títulos"],["valorNominal","V.N."],["nominal","Nominal"],["compradorCp","Comprador"],["pxCompra","Px.S. Cpa"],["importeCompraMXN","Imp.Cpa MXN"],["vendedorCp","Vendedor"],["pxVenta","Px.S. Vta"],["importeVentaMXN","Imp.Vta MXN"],["diferencial","Dif.pts"],["pnl","P&L MXN"],["operador","Operador"],["estatus","Estatus"]].map(([c,l]) => (
                    <th key={c} className="th" onClick={() => ordenar(c)}>{l} <SI col={c}/></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => (
                  <React.Fragment key={t.id}>
                  <tr className="fila" style={{ cursor: "pointer", background: seleccionadas.has(t.id) ? "#0d1525" : undefined }} onClick={() => setFilaExp(filaExp === t.id ? null : t.id)}>
                    <td className="cb-cell" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={seleccionadas.has(t.id)} onChange={() => toggleSelec(t.id)} />
                    </td>
                    <td className="td" style={{ color: "#fbbf24", fontWeight: 700, fontSize: 10 }}>{t.id}</td>
                    <td className="td" style={{ color: "#3a5060", fontSize: 10 }}>{fmtFecha(t.fecha)}</td>
                    <td className="td">
                      <div style={{ color: "#dce8f8", fontWeight: 600, fontSize: 12 }}>{t.emisor}</div>
                      <div style={{ color: "#2a4050", fontSize: 9, marginTop: 1 }}>{t.isin}</div>
                    </td>
                    <td className="td"><span className={`pill p-${t.tipo==="Gubernamental"?"gub":"corp"}`}>{t.tipo==="Gubernamental"?"GUB":"CORP"}</span></td>
                    <td className="td" style={{ fontWeight: 700, fontSize: 11, color: colorCalif(t.calificacion) }}>{t.calificacion}</td>
                    <td className="td"><span className={`pill p-${t.moneda.toLowerCase()}`}>{t.moneda}</span></td>
                    {/* Títulos, Valor Nominal, Nominal Total */}
                    <td className="td" style={{ textAlign: "right", color: "#c0ccdf", fontWeight: 700 }}>{t.titulos ? Number(t.titulos).toLocaleString("es-MX") : "-"}</td>
                    <td className="td" style={{ textAlign: "right", color: "#3a5060" }}>{t.valorNominal ? fmt(t.valorNominal, 0) : "-"}</td>
                    <td className="td" style={{ textAlign: "right", color: "#7a9ab0", fontWeight: 700, background: "#07090e", borderLeft: "1px solid #0f1820" }}>
                      {t.nominal ? fmtMon(t.nominal, t.moneda) : "-"}
                    </td>
                    {/* Compra */}
                    <td className="td">
                      <div style={{ color: "#3ddc84", fontWeight: 600, fontSize: 11 }}>{t.compradorCp}</div>
                      <div style={{ color: "#143020", fontSize: 9 }}>COMPRADOR</div>
                    </td>
                    <td className="td" style={{ textAlign: "right", color: "#3ddc84", fontWeight: 800, fontSize: 12 }}>{fmt(t.pxCompra,4)}</td>
                    <td className="td" style={{ textAlign: "right", color: "#3ddc84", fontWeight: 700, fontSize: 11 }}>MX${fmt(t.importeCompraMXN,0)}</td>
                    {/* Venta */}
                    <td className="td">
                      <div style={{ color: "#f87171", fontWeight: 600, fontSize: 11 }}>{t.vendedorCp}</div>
                      <div style={{ color: "#301418", fontSize: 9 }}>VENDEDOR</div>
                    </td>
                    <td className="td" style={{ textAlign: "right", color: "#f87171", fontWeight: 800, fontSize: 12 }}>{fmt(t.pxVenta,4)}</td>
                    <td className="td" style={{ textAlign: "right", color: "#f87171", fontWeight: 700, fontSize: 11 }}>MX${fmt(t.importeVentaMXN,0)}</td>
                    {/* Diferencial y P&L */}
                    <td className="td" style={{ textAlign: "right" }}>
                      <span style={{ color: pnlColor(t.diferencial), fontWeight: 800, background: t.diferencial>=0?"#181000":"#180608", border: `1px solid ${t.diferencial>=0?"#302010":"#401020"}`, borderRadius: 3, padding: "2px 7px", fontSize: 11 }}>{fmtDif(t.diferencial,4)}</span>
                    </td>
                    <td className="td" style={{ textAlign: "right", fontWeight: 900, fontSize: 13, color: pnlColor(t.pnl) }}>MX${fmt(t.pnl,0)}</td>
                    <td className="td" style={{ color: "#3a5060", fontSize: 10 }}>{t.operador}</td>
                    <td className="td">
                      <span className={`pill ${statusClass(t.estatus)}`}>{t.estatus}</span>
                    </td>
                  </tr>
                  {filaExp === t.id && (
                    <tr key={t.id+"-x"} style={{ background: "#060810" }}>
                      <td colSpan={20} style={{ padding: "14px 16px 16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr 1fr", gap: 12 }}>
                          <div style={{ background: "#071208", border: "1px solid #143020", borderRadius: 4, padding: 14 }}>
                            <div className="lbl" style={{ color: "#3ddc84", marginBottom: 8 }}>▲ Comprador — Paga al Desk</div>
                            <div style={{ color: "#3ddc84", fontWeight: 800, fontSize: 14 }}>{t.compradorCp}</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#3ddc84", margin: "4px 0 2px" }}>{fmt(t.pxCompra,4)} <span style={{fontSize:10,color:"#3a6040"}}>px sucio</span></div>
                            <div style={{ fontSize: 11, color: "#3ddc84", fontWeight: 700 }}>Importe: {fmtMon(t.importeCompra, t.moneda)}</div>
                            {t.moneda!=="MXN"&&<div style={{ fontSize: 10, color: "#3a6040" }}>= MX${fmt(t.importeCompraMXN,0)} · TC {fmt(t.tipoCambio,4)}</div>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a08", border: "1px solid #282010", borderRadius: 4, gap: 3 }}>
                            <div style={{ fontSize: 18, color: "#fbbf24" }}>⇄</div>
                            <div style={{ fontSize: 11, fontWeight: 900, color: pnlColor(t.diferencial) }}>{fmtDif(t.diferencial,4)}</div>
                            <div style={{ fontSize: 9, color: "#60500a" }}>pts</div>
                          </div>
                          <div style={{ background: "#120708", border: "1px solid #301418", borderRadius: 4, padding: 14 }}>
                            <div className="lbl" style={{ color: "#f87171", marginBottom: 8 }}>▼ Vendedor — Recibe del Desk</div>
                            <div style={{ color: "#f87171", fontWeight: 800, fontSize: 14 }}>{t.vendedorCp}</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#f87171", margin: "4px 0 2px" }}>{fmt(t.pxVenta,4)} <span style={{fontSize:10,color:"#603040"}}>px sucio</span></div>
                            <div style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>Importe: {fmtMon(t.importeVenta, t.moneda)}</div>
                            {t.moneda!=="MXN"&&<div style={{ fontSize: 10, color: "#603040" }}>= MX${fmt(t.importeVentaMXN,0)} · TC {fmt(t.tipoCambio,4)}</div>}
                          </div>
                          <div style={{ background: "#080e08", border: "1px solid #1c3020", borderRadius: 4, padding: 14 }}>
                            <div className="lbl" style={{ color: pnlColor(t.pnl), marginBottom: 8 }}>{t.pnl >= 0 ? "Ingreso" : "Pérdida"} de Agencia (MXN)</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: pnlColor(t.pnl), margin: "4px 0 4px" }}>MX${fmt(t.pnl,0)}</div>
                            {t.moneda!=="MXN"&&<div style={{fontSize:9,color:"#3a5040",marginBottom:6}}>{fmtPnl(t.importeCompra-t.importeVenta,t.moneda)} × TC {fmt(t.tipoCambio,4)}</div>}
                            <div style={{ fontSize: 10, color: "#3a5040", lineHeight: 1.6 }}>
                              Títulos: {Number(t.titulos).toLocaleString("es-MX")} × V.N. {fmt(t.valorNominal,0)}<br/>
                              Nominal: {fmtMon(t.nominal, t.moneda)}<br/>
                              Bono: {t.cupon}% cpn · Vto. {fmtFecha(t.vencimiento)}<br/>
                              Calificación: <span style={{ color: colorCalif(t.calificacion) }}>{t.calificacion}</span> · {t.tipoVenc}
                            </div>
                          </div>
                        </div>
                        {/* ACCIONES */}
                        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginTop:12, paddingTop:12, borderTop:"1px solid #101820" }}>
                          <span style={{ fontSize:9, color:"#2a4050", letterSpacing:1 }}>ESTATUS ACTUAL:</span>
                          <span className={`pill ${statusClass(t.estatus)}`} style={{fontSize:8}}>{t.estatus}</span>
                          {t.estatus !== "Cancelada" && (
                            <>
                              <button
                                className="btn-ghost"
                                style={{ borderColor:"#143060", color:"#5bc8fa", fontSize:10, marginLeft:8 }}
                                onClick={e => { e.stopPropagation(); abrirCorreccion(t); }}
                              >✎ Corregir Ticket</button>
                              <button
                                className="btn-ghost"
                                style={{ borderColor:"#301418", color:"#f87171", fontSize:10 }}
                                onClick={e => { e.stopPropagation(); if (window.confirm(`¿Cancelar el ticket ${t.id}?`)) cancelarOp(t.id); }}
                              >✕ Cancelar Ticket</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 7, fontSize: 9, color: "#2a3a4a", letterSpacing: 1 }}>HAZ CLIC EN CUALQUIER FILA PARA VER EL DESGLOSE DE LA OPERACIÓN</div>
        </>}

        {/* REPORTE P&L */}
        {tab === "pnl" && <>
          <div style={{ fontSize: 9, color: "#3a5060", marginBottom: 14, letterSpacing: 1.5, textTransform: "uppercase" }}>
            P&L Agencia = (Precio Venta − Precio Compra) ÷ 100 × Nominal &nbsp;·&nbsp; La mesa gana el diferencial entre ambos precios
          </div>

          {/* ── P&L ACUMULADO TDY / MTD / YTD ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#fbbf24", letterSpacing: 2.5, textTransform: "uppercase" }}>P&L Acumulado</div>
              <div style={{ height: 1, flex: 1, background: "#101820" }} />
              <div style={{ fontSize: 9, color: "#2a4050", letterSpacing: 1 }}>
                Solo operaciones vivas · <span style={{ color: "#5bc8fa" }}>{pnlAcumulado.totalVivas}</span> ops · Ref. {fmtFecha(pnlAcumulado.hoy)}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { key: "tdy", label: "TDY", sublabel: "Hoy",           color: "#3ddc84", bg: "#050e08", border: "#0d2014" },
                { key: "mtd", label: "MTD", sublabel: "Mes en curso",   color: "#5bc8fa", bg: "#05090e", border: "#0d1a28" },
                { key: "ytd", label: "YTD", sublabel: "Año en curso",   color: "#fbbf24", bg: "#0a0800", border: "#201400" },
              ].map(({ key, label, sublabel, color, bg, border }) => {
                const p = pnlAcumulado[key];
                const monedas = ["USD", "MXN", "EUR"].filter(m => p.porMoneda[m]);
                return (
                  <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 5, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
                    {/* Etiqueta de periodo */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color, letterSpacing: 3, lineHeight: 1 }}>{label}</div>
                        <div style={{ fontSize: 9, color: "#2a4050", letterSpacing: 1.5, marginTop: 3, textTransform: "uppercase" }}>{sublabel}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#2a4050", letterSpacing: 1 }}>OPS VIVAS</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: p.ops > 0 ? "#c0ccdf" : "#2a4050" }}>{p.ops}</div>
                      </div>
                    </div>
                    {/* P&L total */}
                    <div style={{ fontSize: p.ops > 0 ? 24 : 18, fontWeight: 900, color: p.ops > 0 ? pnlColor(p.total) : "#1c2633", letterSpacing: .5, marginBottom: 8, lineHeight: 1 }}>
                      {p.ops > 0 ? `${pnlSigno(p.total)}MX$${fmt(p.total, 0)}` : "—"}
                    </div>
                    {/* Desglose por moneda */}
                    {p.ops > 0 && monedas.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: `1px solid ${border}`, paddingTop: 10, marginTop: 4 }}>
                        {monedas.map(m => (
                          <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className={`pill p-${m.toLowerCase()}`} style={{ fontSize: 8 }}>{m}</span>
                              <span style={{ fontSize: 9, color: "#2a4050" }}>{p.porMoneda[m].ops} op{p.porMoneda[m].ops !== 1 ? "s" : ""}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pnlColor(p.porMoneda[m].pnlMXN) }}>
                              {pnlSigno(p.porMoneda[m].pnlMXN)}MX${fmt(p.porMoneda[m].pnlMXN, 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.ops === 0 && (
                      <div style={{ fontSize: 9, color: "#1c2633", letterSpacing: 1 }}>Sin operaciones en este período</div>
                    )}
                    {/* Fondo decorativo */}
                    <div style={{ position: "absolute", right: -10, bottom: -10, fontSize: 56, opacity: 0.04, fontWeight: 900, color, lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              ["Diferencial Prom./Op.",  fmtDif(difPromedio) + " pts",                                                                                           pnlColor(difPromedio)],
              ["Mejor Op. (P&L)",        (() => { const b=[...enriquecidas].sort((a,b)=>b.pnl-a.pnl)[0]; return b?`${b.id} ${fmtPnl(b.pnl,b.moneda)}`:"-"; })(),"#3ddc84"],
              ["Peor Op. (P&L)",         (() => { const b=[...enriquecidas].sort((a,b)=>a.pnl-b.pnl)[0]; return b?`${b.id} ${fmtPnl(b.pnl,b.moneda)}`:"-"; })(),pnlColor(-1)],
              ["Total Ops.",             enriquecidas.length + " operaciones",                                                                                   "#c0ccdf"],
            ].map(([l,v,c]) => (
              <div key={l} className="card" style={{ padding: "14px 18px" }}>
                <div className="lbl">{l}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["ID","Fecha","Emisor","Mon.","Títulos","V.N.","Nominal","TC","Comprador","Px.S.Cpa","Imp.Cpa","Imp.Cpa MXN","Vendedor","Px.S.Vta","Imp.Vta","Imp.Vta MXN","Dif.pts","Dif.bps","P&L MXN"].map(h=><th key={h} className="th">{h}</th>)}</tr>
              </thead>
              <tbody>
                {enriquecidas.map((t,i)=>(
                  <tr key={t.id} className="fila" style={{background:i%2===0?"#06080d":"#07090e"}}>
                    <td className="td" style={{color:"#fbbf24",fontWeight:700,fontSize:10}}>{t.id}</td>
                    <td className="td" style={{color:"#3a5060",fontSize:10}}>{fmtFecha(t.fecha)}</td>
                    <td className="td" style={{color:"#dce8f8",fontSize:11}}>{t.emisor}</td>
                    <td className="td"><span className={`pill p-${t.moneda.toLowerCase()}`}>{t.moneda}</span></td>
                    <td className="td" style={{textAlign:"right",color:"#c0ccdf"}}>{t.titulos?Number(t.titulos).toLocaleString("es-MX"):"-"}</td>
                    <td className="td" style={{textAlign:"right",color:"#3a5060"}}>{fmt(t.valorNominal,0)}</td>
                    <td className="td" style={{textAlign:"right",color:"#7a9ab0",fontWeight:700}}>{t.nominal?fmtMon(t.nominal,t.moneda):"-"}</td>
                    <td className="td" style={{textAlign:"right",color:"#3a5060",fontSize:10}}>{t.moneda!=="MXN"?fmt(t.tipoCambio,4):"—"}</td>
                    <td className="td" style={{color:"#3ddc84",fontWeight:600}}>{t.compradorCp}</td>
                    <td className="td" style={{textAlign:"right",color:"#3ddc84",fontWeight:800}}>{fmt(t.pxCompra,4)}</td>
                    <td className="td" style={{textAlign:"right",color:"#3ddc84"}}>{fmtMon(t.importeCompra,t.moneda)}</td>
                    <td className="td" style={{textAlign:"right",color:"#3ddc84",fontWeight:700}}>MX${fmt(t.importeCompraMXN,0)}</td>
                    <td className="td" style={{color:"#f87171",fontWeight:600}}>{t.vendedorCp}</td>
                    <td className="td" style={{textAlign:"right",color:"#f87171",fontWeight:800}}>{fmt(t.pxVenta,4)}</td>
                    <td className="td" style={{textAlign:"right",color:"#f87171"}}>{fmtMon(t.importeVenta,t.moneda)}</td>
                    <td className="td" style={{textAlign:"right",color:"#f87171",fontWeight:700}}>MX${fmt(t.importeVentaMXN,0)}</td>
                    <td className="td" style={{textAlign:"right",color:pnlColor(t.diferencial),fontWeight:800}}>{fmtDif(t.diferencial,4)}</td>
                    <td className="td" style={{textAlign:"right",color:pnlColor(t.diferencial)}}>{fmtDif(t.diferencial*100,2)}</td>
                    <td className="td" style={{textAlign:"right",fontWeight:900,fontSize:13,color:pnlColor(t.pnl)}}>MX${fmt(t.pnl,0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:"#060912"}}>
                  <td colSpan={14} className="td" style={{fontWeight:700,fontSize:9,letterSpacing:2,color:"#2a4050",textTransform:"uppercase"}}>P&L Total Consolidado en MXN</td>
                  <td colSpan={4} className="td" style={{textAlign:"right"}}>
                    <div style={{display:"flex",gap:14,justifyContent:"flex-end",alignItems:"center",flexWrap:"wrap"}}>
                      {["USD","MXN","EUR"].map(mon => {
                        const d = pnlPorMoneda[mon];
                        if (!d) return null;
                        return (
                          <span key={mon} style={{display:"flex",alignItems:"baseline",gap:5}}>
                            <span className={`pill p-${mon.toLowerCase()}`} style={{fontSize:8}}>{mon}</span>
                            <span style={{fontWeight:700,fontSize:11,color:pnlColor(d.pnlMXN)}}>MX${fmt(d.pnlMXN,0)}</span>
                          </span>
                        );
                      })}
                      <span style={{borderLeft:"1px solid #182030",paddingLeft:14,fontWeight:900,fontSize:15,color:pnlColor(pnlTotalMXN)}}>TOTAL MX${fmt(pnlTotalMXN,0)}</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>}

        {/* REPORTE CONTRAPARTES */}
        {tab === "cp" && <>
          <div style={{ fontSize: 9, color: "#3a5060", marginBottom: 14, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Cada entidad aparece con su(s) rol(es) como comprador y/o vendedor en las operaciones de agencia
          </div>
          <div className="card" style={{ overflow: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Contraparte","Como Comprador","Nominal Compra","Como Vendedor","Nominal Venta","Total Ops.","Nominal Total","Dist. Compra/Venta"].map(h=><th key={h} className="th">{h}</th>)}</tr>
              </thead>
              <tbody>
                {reporteCp.map((r,i)=>{
                  const tot = r.comoComprador + r.comoVendedor;
                  const pctC = tot ? r.comoComprador/tot*100 : 50;
                  return(
                    <tr key={r.nombre} className="fila" style={{background:i%2===0?"#06080d":"#07090e"}}>
                      <td className="td" style={{color:"#dce8f8",fontWeight:700}}>{r.nombre}</td>
                      <td className="td" style={{textAlign:"right",color:"#3ddc84",fontWeight:700}}>{r.comoComprador}</td>
                      <td className="td" style={{textAlign:"right",color:"#3ddc84"}}>{fmtMon(r.nomCompra)}</td>
                      <td className="td" style={{textAlign:"right",color:"#f87171",fontWeight:700}}>{r.comoVendedor}</td>
                      <td className="td" style={{textAlign:"right",color:"#f87171"}}>{fmtMon(r.nomVenta)}</td>
                      <td className="td" style={{textAlign:"right"}}>{r.ops}</td>
                      <td className="td" style={{textAlign:"right",color:"#c0ccdf",fontWeight:600}}>{fmtMon(r.nomCompra+r.nomVenta)}</td>
                      <td className="td" style={{minWidth:180}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{flex:1,height:8,background:"#0e1820",borderRadius:4,overflow:"hidden",display:"flex"}}>
                            <div style={{width:`${pctC}%`,background:"#3ddc84",opacity:.75}}/>
                            <div style={{flex:1,background:"#f87171",opacity:.6}}/>
                          </div>
                          <span style={{fontSize:9,color:"#3a5060",whiteSpace:"nowrap"}}>{fmt(pctC,0)}% C</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {reporteCp.map(r=>(
              <div key={r.nombre} className="card" style={{padding:14,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:"linear-gradient(#3ddc84,#f87171)",borderRadius:"4px 0 0 4px"}}/>
                <div style={{fontWeight:800,color:"#dce8f8",marginBottom:10,fontSize:13}}>{r.nombre}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div className="lbl">Como Comprador</div><div style={{color:"#3ddc84",fontWeight:700}}>{r.comoComprador} op{r.comoComprador!==1?"s":""}</div><div style={{fontSize:10,color:"rgba(61,220,132,.5)"}}>{fmtMon(r.nomCompra)}</div></div>
                  <div><div className="lbl">Como Vendedor</div><div style={{color:"#f87171",fontWeight:700}}>{r.comoVendedor} op{r.comoVendedor!==1?"s":""}</div><div style={{fontSize:10,color:"rgba(248,113,113,.5)"}}>{fmtMon(r.nomVenta)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* REPORTE OPERADORES */}
        {tab === "operador" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
            {reporteOperador.map(r=>(
              <div key={r.operador} className="card" style={{padding:18,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,width:4,height:"100%",background:"#fbbf24",borderRadius:"4px 0 0 4px"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div style={{fontWeight:900,color:"#f0e4c0",fontSize:15}}>{r.operador}</div>
                    <div style={{fontSize:10,color:"#3a5060",marginTop:2}}>{r.ops} operación{r.ops!==1?"es":""} de agencia</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:900,fontSize:18,color:pnlColor(r.pnl)}}>{fmtPnl(r.pnl)}</div>
                    <div style={{fontSize:9,color:"#3a5060",letterSpacing:1}}>P&L TOTAL</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                  {[["Nominal",fmtMon(r.nominal)],["P&L Promedio",fmtPnl(r.pnl/r.ops)],["Dif. Promedio",fmtDif(r.totalDif/r.ops)+" pts"]].map(([l,v])=>(
                    <div key={l} className="card" style={{padding:"8px 10px"}}>
                      <div className="lbl">{l}</div>
                      <div style={{fontSize:11,fontWeight:700,color:"#c0ccdf"}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{borderTop:"1px solid #101820",paddingTop:10}}>
                  {enriquecidas.filter(t=>(t.operador||"Sin asignar")===r.operador).map(t=>(
                    <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #090c14",fontSize:10,gap:6}}>
                      <span style={{color:"#fbbf24",minWidth:70}}>{t.id}</span>
                      <span style={{color:"#3a5060",flex:1,overflow:"hidden",textOverflow:"ellipsis"}}>{t.emisor}</span>
                      <span style={{color:"#3ddc84"}}>{t.compradorCp.split(" ")[0]}</span>
                      <span style={{color:"#fbbf24"}}>→</span>
                      <span style={{color:"#f87171"}}>{t.vendedorCp.split(" ")[0]}</span>
                      <span style={{color:pnlColor(t.pnl),fontWeight:800,minWidth:70,textAlign:"right"}}>MX${fmt(t.pnl,0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* POR MONEDA */}
        {tab === "moneda" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {monedas.map(mon=>{
              const datos   = enriquecidas.filter(t=>t.moneda===mon);
              const pnl     = datos.reduce((s,t)=>s+t.pnl,0);
              const nom     = datos.reduce((s,t)=>s+t.nominal,0);
              const difProm = datos.length?datos.reduce((s,t)=>s+t.diferencial,0)/datos.length:0;
              const c       = colorMon[mon];
              return(
                <div key={mon} className="card" style={{padding:20,borderTop:`3px solid ${c}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <span className={`pill p-${mon.toLowerCase()}`} style={{fontSize:13,padding:"5px 14px"}}>{mon}</span>
                    <span style={{fontSize:11,color:"#3a5060"}}>{datos.length} operacion{datos.length!==1?"es":""}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    {[["P&L MXN",`MX$${fmt(pnl,0)}`,pnlColor(pnl)],["Nominal Total",fmtMon(nom,mon),"#c0ccdf"],["Dif. Promedio",fmtDif(difProm,4)+" pts",pnlColor(difProm)],["Gub./Corp.",`${datos.filter(t=>t.tipo==="Gubernamental").length} / ${datos.filter(t=>t.tipo==="Corporativo").length}`,"#7a9ab0"]].map(([l,v,col])=>(
                      <div key={l} className="card" style={{padding:"10px 12px"}}>
                        <div className="lbl">{l}</div>
                        <div style={{fontWeight:800,color:col,fontSize:13}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {datos.length===0
                    ? <div style={{fontSize:10,color:"#2a3a4a",textAlign:"center",padding:"20px 0"}}>Sin operaciones en {mon}</div>
                    : (
                      <div style={{borderTop:"1px solid #101820",paddingTop:12}}>
                        <div className="lbl" style={{marginBottom:8}}>Operaciones</div>
                        {datos.map(t=>(
                          <div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #090c14",fontSize:10,gap:6}}>
                            <span style={{color:"#fbbf24",minWidth:68}}>{t.id}</span>
                            <span style={{color:"#3a5060",flex:1,overflow:"hidden",textOverflow:"ellipsis"}}>{t.emisor}</span>
                            <span style={{color:pnlColor(t.pnl),fontWeight:800}}>{fmtPnl(t.pnl,mon)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              );
            })}
          </div>
        )}

        {/* MONITOR DE PRECIOS */}
        {tab === "monitor" && (
          <MonitorPrecios emisoras={emisoras} cargandoEmisoras={cargandoEmisoras} />
        )}

        {/* ADMINISTRACIÓN */}
        {tab === "admin" && <AdminPanel
          contrapartes={contrapartes}  setCp={setCpDB}
          operadores={operadores}      setOps2={setOps2DB}
          calificaciones={calificaciones} setCal={setCalDB}
          tiposVenc={tiposVenc}        setTV={setTVDB}
          monedas={monedas}            setMon={setMonDB}
          cpDefault={CONTRAPARTES_DEFAULT}
          opsDefault={OPERADORES_DEFAULT}
          calDefault={CALIFICACIONES}
          tvDefault={TIPOS_VENCIMIENTO}
          monDefault={MONEDAS}
          usuarios={usuarios}          setUsuarios={setUsuarios}
          sesionId={sesion?.id}
        />}

      </div>

      {/* MODAL REGISTRO DE OPERACIÓN */}
      {mostrarForm && (
        <div className="modal-bg" onClick={e => e.target===e.currentTarget && cerrarModal()}>
          <div className="modal">
            <div style={{padding:"18px 24px",borderBottom:`1px solid ${modoCorreccion?"#502800":"#1c2633"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                {modoCorreccion ? (
                  <>
                    <div style={{fontSize:13,fontWeight:800,color:"#fb923c",letterSpacing:2}}>✎ CORREGIR OPERACIÓN — {modoCorreccion.id}</div>
                    <div style={{fontSize:9,color:"#3a5060",marginTop:2,letterSpacing:1.5}}>Los campos modificados reemplazarán el ticket · Estatus → Booked/Corregido</div>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:13,fontWeight:800,color:"#f0e4c0",letterSpacing:2}}>REGISTRAR OPERACIÓN DE AGENCIA</div>
                    <div style={{fontSize:9,color:"#3a5060",marginTop:2,letterSpacing:1.5}}>P&L = (Px Sucio Cpa − Px Sucio Vta) × Títulos × TC · Precio directo por título · Importes en MXN</div>
                  </>
                )}
              </div>
              <button className="btn-ghost" onClick={cerrarModal}>✕</button>
            </div>
            <div style={{padding:24}}>

              {/* ── BUSCADOR DE EMISORAS ── */}
              <div style={{marginBottom:18,position:"relative"}}>
                <div className="lbl" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span>Emisora — Valmer / PIP</span>
                  {cargandoEmisoras
                    ? <span style={{color:"#fbbf24",fontSize:9,letterSpacing:1,display:"flex",alignItems:"center",gap:4}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◌</span> Cargando BD…</span>
                    : <span style={{color:"#3a5060",fontSize:9}}>{emisoras.length.toLocaleString("es-MX")} emisoras</span>
                  }
                </div>

                {/* Trigger / campo seleccionado */}
                <div
                  onClick={() => { if (!cargandoEmisoras) { setDropdown(d => !d); setBusqEmisora(""); } }}
                  style={{
                    background:"#0b0e16", border:`1px solid ${dropdownAbierto?"#fbbf24":"#1c2633"}`,
                    borderRadius: dropdownAbierto ? "3px 3px 0 0" : 3,
                    padding:"9px 12px", cursor:"pointer", display:"flex",
                    justifyContent:"space-between", alignItems:"center",
                    transition:"border .15s", userSelect:"none",
                  }}
                >
                  {plantillaSel ? (()=>{
                    const [em,se,prov] = plantillaSel.split("|");
                    return (
                      <span style={{fontSize:12,color:"#f0e4c0",fontWeight:700}}>
                        <span style={{color:"#fbbf24",marginRight:8,fontSize:9,background:"#181000",border:"1px solid #302010",borderRadius:2,padding:"1px 5px"}}>{prov}</span>
                        {em} · {se}
                      </span>
                    );
                  })() : <span style={{fontSize:12,color:"#3a5060"}}>— Busca por emisora o serie —</span>}
                  <span style={{color:"#3a5060",fontSize:10,transform:dropdownAbierto?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                </div>

                {/* Panel desplegable */}
                {dropdownAbierto && (
                  <div style={{
                    position:"absolute", top:"100%", left:0, right:0, zIndex:200,
                    background:"#07090e", border:"1px solid #fbbf24", borderTop:"none",
                    borderRadius:"0 0 4px 4px", boxShadow:"0 8px 32px rgba(0,0,0,.6)",
                  }}>
                    {/* Barra de búsqueda */}
                    <div style={{padding:"8px 10px",borderBottom:"1px solid #101820",background:"#050710"}}>
                      <div style={{position:"relative",display:"flex",alignItems:"center"}}>
                        <span style={{position:"absolute",left:10,color:"#3a5060",fontSize:12,pointerEvents:"none"}}>⌕</span>
                        <input
                          autoFocus
                          placeholder="Escribe emisora, serie o TV…"
                          value={busqEmisora}
                          onChange={e => setBusqEmisora(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{
                            background:"#0b0e16", border:"1px solid #263040",
                            borderRadius:3, color:"#dce8f8", fontSize:12,
                            padding:"7px 10px 7px 30px", width:"100%", outline:"none",
                          }}
                        />
                        {busqEmisora && (
                          <button
                            onClick={e => { e.stopPropagation(); setBusqEmisora(""); }}
                            style={{position:"absolute",right:8,background:"none",border:"none",color:"#3a5060",cursor:"pointer",fontSize:13,lineHeight:1}}
                          >✕</button>
                        )}
                      </div>
                    </div>

                    {/* Lista filtrada */}
                    {(()=>{
                      const q = busqEmisora.trim().toUpperCase();
                      const filtrar = arr => q
                        ? arr.filter(e => e.emisora.includes(q) || e.serie.includes(q) || e.tv.includes(q))
                        : arr;
                      const valmer = filtrar(emisoras.filter(e => e.proveedor === 'Valmer'));
                      const pip    = filtrar(emisoras.filter(e => e.proveedor === 'PIP'));
                      const total  = valmer.length + pip.length;

                      if (total === 0) return (
                        <div style={{padding:"20px",textAlign:"center",color:"#3a5060",fontSize:11}}>
                          Sin resultados para "<span style={{color:"#fbbf24"}}>{busqEmisora}</span>"
                        </div>
                      );

                      const MAX = 80; // máx por proveedor para no saturar el DOM
                      const renderGrupo = (arr, prov, color, bg, border) => arr.length === 0 ? null : (
                        <div key={prov}>
                          {/* Header de grupo */}
                          <div style={{
                            padding:"5px 12px", fontSize:8, letterSpacing:2,
                            color, background:bg, borderBottom:`1px solid ${border}`,
                            textTransform:"uppercase", fontWeight:800, display:"flex",
                            justifyContent:"space-between",
                          }}>
                            <span>{prov}</span>
                            <span style={{opacity:.6}}>{arr.length} emisoras{arr.length > MAX ? ` (mostrando ${MAX})` : ""}</span>
                          </div>
                          {/* Filas */}
                          {arr.slice(0, MAX).map(e => {
                            const key = `${e.emisora}|${e.serie}|${prov}`;
                            const sel = plantillaSel === key;
                            return (
                              <div
                                key={key}
                                onClick={() => { aplicarPlantilla(key); setDropdown(false); setBusqEmisora(""); }}
                                style={{
                                  padding:"7px 14px", cursor:"pointer", display:"flex",
                                  alignItems:"center", gap:10,
                                  background: sel ? "#0f1a0f" : "transparent",
                                  borderBottom:"1px solid #0b0e16",
                                  transition:"background .1s",
                                }}
                                onMouseEnter={ev => ev.currentTarget.style.background = sel ? "#0f1a0f" : "#0d111a"}
                                onMouseLeave={ev => ev.currentTarget.style.background = sel ? "#0f1a0f" : "transparent"}
                              >
                                {/* TV badge */}
                                <span style={{
                                  fontSize:8, fontWeight:800, letterSpacing:1,
                                  padding:"2px 5px", borderRadius:2, minWidth:28,
                                  textAlign:"center", background:"#080e18",
                                  color:"#5bc8fa", border:"1px solid #143060",
                                }}>{e.tv}</span>
                                {/* Emisora */}
                                <span style={{color:"#dce8f8",fontWeight:700,fontSize:12,flex:1,letterSpacing:.5}}>
                                  {q ? e.emisora.split("").map((ch,i) => (
                                    <span key={i} style={e.emisora.slice(i,i+q.length)===q ? {color:"#fbbf24"} : {}}>{ch}</span>
                                  )) : e.emisora}
                                </span>
                                {/* Serie */}
                                <span style={{color:"#3a5060",fontSize:11}}>{e.serie}</span>
                                {sel && <span style={{color:"#3ddc84",fontSize:10}}>✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      );

                      return (
                        <div style={{maxHeight:320,overflowY:"auto"}}>
                          {renderGrupo(valmer,"Valmer","#5bc8fa","#050a14","#101828")}
                          {renderGrupo(pip,"PIP","#fbbf24","#0a0800","#201400")}
                          <div style={{padding:"6px 12px",fontSize:8,color:"#2a3a4a",letterSpacing:1,borderTop:"1px solid #101820",textAlign:"center"}}>
                            {total > MAX*2 ? `Mostrando top ${MAX} por proveedor — afina la búsqueda` : `${total} resultados`}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Overlay para cerrar al hacer clic fuera */}
                {dropdownAbierto && (
                  <div
                    onClick={() => { setDropdown(false); setBusqEmisora(""); }}
                    style={{position:"fixed",inset:0,zIndex:199}}
                  />
                )}
              </div>
              <hr className="hr" style={{marginBottom:18}}/>

              <div style={{fontSize:9,color:"#fbbf24",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Datos del Bono</div>
              <div className="g2" style={{marginBottom:12}}>
                <div><div className="lbl">Fecha de Operación</div><input type="date" value={form.fecha} onChange={e=>sF("fecha",e.target.value)}/></div>
                <div><div className="lbl">Tipo de Bono</div><select value={form.tipo} onChange={e=>sF("tipo",e.target.value)}><option>Gubernamental</option><option>Corporativo</option></select></div>
              </div>
              <div className="g2" style={{marginBottom:12}}>
                <div><div className="lbl">Emisor</div><input placeholder="ej. Mexico Bonos, PEMEX" value={form.emisor} onChange={e=>sF("emisor",e.target.value)}/></div>
                <div><div className="lbl">ISIN</div><input placeholder="ej. MX0MGO0000Y6" value={form.isin} onChange={e=>sF("isin",e.target.value)}/></div>
              </div>
              <div className="g3" style={{marginBottom:12}}>
                <div><div className="lbl">Cupón (%)</div><input type="number" step="0.001" placeholder="4.25" value={form.cupon} onChange={e=>sF("cupon",e.target.value)}/></div>
                <div><div className="lbl">Vencimiento</div><input type="date" value={form.vencimiento} onChange={e=>sF("vencimiento",e.target.value)}/></div>
                <div><div className="lbl">Tipo de Vencimiento</div><select value={form.tipoVenc} onChange={e=>sF("tipoVenc",e.target.value)}>{tiposVenc.map(x=><option key={x}>{x}</option>)}</select></div>
              </div>
              <div className="g3" style={{marginBottom:20}}>
                <div><div className="lbl">Calificación</div><select value={form.calificacion} onChange={e=>sF("calificacion",e.target.value)}>{calificaciones.map(r=><option key={r}>{r}</option>)}</select></div>
                <div><div className="lbl">Moneda</div><select value={form.moneda} onChange={e=>{ sF("moneda",e.target.value); if(e.target.value==="MXN") sF("tipoCambio","1"); }}>{MONEDAS.map(c=><option key={c}>{c}</option>)}</select></div>
              </div>
              {/* Títulos, Valor Nominal, Tipo de Cambio */}
              <div style={{display:"grid",gridTemplateColumns:form.moneda!=="MXN"?"1fr 1fr 1fr":"1fr 1fr",gap:12,marginBottom:20}}>
                <div>
                  <div className="lbl">Títulos</div>
                  <input type="number" placeholder="200000" value={form.titulos} onChange={e=>sF("titulos",e.target.value)}/>
                </div>
                <div>
                  <div className="lbl">Valor Nominal por Título</div>
                  <input type="number" step="any" placeholder="100" value={form.valorNominal} onChange={e=>sF("valorNominal",e.target.value)}/>
                  {form.titulos&&form.valorNominal&&<div style={{fontSize:9,color:"#3a5060",marginTop:4}}>Nominal total: {fmtMon(parseFloat(form.titulos)*parseFloat(form.valorNominal),form.moneda)}</div>}
                </div>
                {form.moneda!=="MXN"&&(
                  <div>
                    <div className="lbl">Tipo de Cambio (MXN/{form.moneda})</div>
                    <input type="number" step="0.01" placeholder={form.moneda==="USD"?"17.15":"18.72"} value={form.tipoCambio} onChange={e=>sF("tipoCambio",e.target.value)}/>
                  </div>
                )}
              </div>
              <hr className="hr" style={{marginBottom:18}}/>

              <div style={{fontSize:9,color:"#fbbf24",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Precios de Agencia</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 70px 1fr",marginBottom:18}}>
                <div style={{background:"#071208",border:"1px solid #143020",borderRadius:"4px 0 0 4px",padding:16}}>
                  <div style={{fontSize:9,color:"#3ddc84",letterSpacing:2,fontWeight:800,textTransform:"uppercase",marginBottom:12,display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#3ddc84",display:"inline-block"}}/> Comprador — paga al desk
                  </div>
                  <div style={{marginBottom:10}}>
                    <div className="lbl">Contraparte Compradora</div>
                    <select value={form.compradorCp} onChange={e=>sF("compradorCp",e.target.value)} style={{borderColor:"#143020"}}>
                      <option value="">Selecciona comprador…</option>
                      {contrapartes.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="lbl">Px Sucio Compra (por título)</div>
                    <input type="number" step="0.0001" placeholder="987.5000" value={form.pxCompra} onChange={e=>sF("pxCompra",e.target.value)} style={{borderColor:"#143020"}}/>
                    {form.pxCompra&&form.titulos&&(()=>{
                      const imp=parseFloat(form.pxCompra)*parseFloat(form.titulos);
                      const impMXN=imp*(parseFloat(form.tipoCambio)||1);
                      return(<div style={{fontSize:9,color:"rgba(61,220,132,.6)",marginTop:4}}>
                        Importe: {fmtMon(imp,form.moneda)}{form.moneda!=="MXN"&&` = MX$${fmt(impMXN,0)}`}
                      </div>);
                    })()}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#080a08",borderTop:"1px solid #282010",borderBottom:"1px solid #282010",gap:4}}>
                  <div style={{fontSize:20,color:"#fbbf24"}}>⇒</div>
                  {form.pxCompra&&form.pxVenta&&(()=>{
                    const dif=parseFloat(form.pxCompra)-parseFloat(form.pxVenta);
                    const pos=dif>=0;
                    return(
                      <div style={{fontSize:11,fontWeight:900,color:pos?"#fbbf24":"#f87171",textAlign:"center",lineHeight:1.3}}>
                        {pos?"+":""}{fmt(dif,3)}<br/>
                        <span style={{fontSize:9,color:pos?"rgba(251,191,36,.5)":"rgba(248,113,113,.5)"}}>pts</span>
                      </div>
                    );
                  })()}
                </div>
                <div style={{background:"#120708",border:"1px solid #301418",borderRadius:"0 4px 4px 0",padding:16}}>
                  <div style={{fontSize:9,color:"#f87171",letterSpacing:2,fontWeight:800,textTransform:"uppercase",marginBottom:12,display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#f87171",display:"inline-block"}}/> Vendedor — recibe del desk
                  </div>
                  <div style={{marginBottom:10}}>
                    <div className="lbl">Contraparte Vendedora</div>
                    <select value={form.vendedorCp} onChange={e=>sF("vendedorCp",e.target.value)} style={{borderColor:"#301418"}}>
                      <option value="">Selecciona vendedor…</option>
                      {contrapartes.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="lbl">Px Sucio Venta (por título)</div>
                    <input type="number" step="0.0001" placeholder="984.2500" value={form.pxVenta} onChange={e=>sF("pxVenta",e.target.value)} style={{borderColor:"#301418"}}/>
                    {form.pxVenta&&form.titulos&&(()=>{
                      const imp=parseFloat(form.pxVenta)*parseFloat(form.titulos);
                      const impMXN=imp*(parseFloat(form.tipoCambio)||1);
                      return(<div style={{fontSize:9,color:"rgba(248,113,113,.6)",marginTop:4}}>
                        Importe: {fmtMon(imp,form.moneda)}{form.moneda!=="MXN"&&` = MX$${fmt(impMXN,0)}`}
                      </div>);
                    })()}
                  </div>
                </div>
              </div>

              {form.pxCompra&&form.pxVenta&&form.titulos&&(()=>{
                const pc=parseFloat(form.pxCompra), pv=parseFloat(form.pxVenta);
                const tit=parseFloat(form.titulos);
                const tc=parseFloat(form.tipoCambio)||1;
                const impCpa=pc*tit, impVta=pv*tit;
                const pnlMon=impCpa-impVta, pnlMXN=pnlMon*tc;
                const dif=pc-pv, pos=dif>=0;
                return(
                  <div style={{background:pos?"#080e08":"#120608",border:`1px solid ${pos?"#1c3020":"#301020"}`,borderRadius:4,padding:"12px 18px",marginBottom:18}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:9,color:pos?"#3ddc84":"#f87171",letterSpacing:2,textTransform:"uppercase"}}>Vista Previa — {pos?"Ingreso":"Pérdida"} de Agencia</span>
                      <span style={{fontSize:10,color:"#fbbf24"}}>Diferencial: {pos?"+":""}{fmt(dif,4)} pts · {pos?"+":""}{fmt(dif*100,2)} bps</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                      <div><div style={{fontSize:9,color:"#2a4050",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>Importe Compra</div>
                        <div style={{fontSize:12,color:"#3ddc84",fontWeight:700}}>{fmtMon(impCpa,form.moneda)}</div>
                        {form.moneda!=="MXN"&&<div style={{fontSize:9,color:"rgba(61,220,132,.5)"}}>MX${fmt(impCpa*tc,0)}</div>}
                      </div>
                      <div><div style={{fontSize:9,color:"#2a4050",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>Importe Venta</div>
                        <div style={{fontSize:12,color:"#f87171",fontWeight:700}}>{fmtMon(impVta,form.moneda)}</div>
                        {form.moneda!=="MXN"&&<div style={{fontSize:9,color:"rgba(248,113,113,.5)"}}>MX${fmt(impVta*tc,0)}</div>}
                      </div>
                      <div><div style={{fontSize:9,color:"#2a4050",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>P&L Agencia (MXN)</div>
                        <div style={{fontSize:18,fontWeight:900,color:pos?"#3ddc84":"#f87171"}}>{pos?"+":""}MX${fmt(pnlMXN,0)}</div>
                        {form.moneda!=="MXN"&&<div style={{fontSize:9,color:"#3a5060"}}>{pos?"+":""}{fmtMon(pnlMon,form.moneda)} × TC {fmt(tc,4)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <hr className="hr" style={{marginBottom:18}}/>
              <div className="g2" style={{marginBottom:20}}>
                <div><div className="lbl">Operador</div>
                  <select value={form.operador} onChange={e=>sF("operador",e.target.value)}>
                    <option value="">Selecciona operador…</option>
                    {operadores.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div><div className="lbl">Estatus</div>
                  <select value={form.estatus} onChange={e=>sF("estatus",e.target.value)}>
                    <option value="Booked">Booked</option>
                    <option value="Booked/Corregido">Booked/Corregido</option>
                    <option value="Liquidada">Liquidada</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn-ghost" onClick={cerrarModal}>Cancelar</button>
                {modoCorreccion
                  ? <button className="btn-gold" style={{borderColor:"#fb923c",color:"#fb923c",background:"#1a0800"}} onClick={confirmarCorreccion}>✎ Confirmar Corrección</button>
                  : <button className="btn-gold" onClick={registrarOp}>✓ Bookear Operación</button>
                }
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PANEL DE ADMINISTRACIÓN
   ═══════════════════════════════════════════════════════════ */
function GestionLista({ titulo, icono, color, bg, border, items, setItems, placeholder, defaultItems }) {
  const [nuevo, setNuevo] = useState("");
  const [busq,  setBusq]  = useState("");
  const [confirmarReset, setConfirmarReset] = useState(false);

  const agregar = () => {
    const v = nuevo.trim();
    if (!v || items.includes(v)) return;
    setItems(prev => [...prev, v].sort((a,b) => a.localeCompare(b)));
    setNuevo("");
  };
  const eliminar = (item) => setItems(prev => prev.filter(x => x !== item));
  const reset    = () => { setItems([...defaultItems]); setConfirmarReset(false); };

  const filtrados = busq ? items.filter(i => i.toLowerCase().includes(busq.toLowerCase())) : items;

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#040610", padding: "14px 18px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icono}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: 1.5 }}>{titulo.toUpperCase()}</div>
            <div style={{ fontSize: 9, color: "#2a4050", marginTop: 1 }}>{items.length} elemento{items.length !== 1 ? "s" : ""} registrado{items.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        {confirmarReset
          ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#f87171" }}>¿Restaurar defaults?</span>
              <button onClick={reset} style={{ background: "#301018", border: "1px solid #f87171", color: "#f87171", borderRadius: 3, padding: "3px 10px", cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>Sí, restaurar</button>
              <button onClick={() => setConfirmarReset(false)} style={{ background: "none", border: "1px solid #2a3a4a", color: "#3a5060", borderRadius: 3, padding: "3px 10px", cursor: "pointer", fontSize: 9, fontFamily: "inherit" }}>Cancelar</button>
            </div>
          : <button onClick={() => setConfirmarReset(true)} style={{ background: "none", border: "1px solid #1c2633", color: "#2a4050", borderRadius: 3, padding: "4px 10px", cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 1 }}>↺ DEFAULTS</button>
        }
      </div>

      {/* Buscador */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, background: "#050810" }}>
        <input
          placeholder={`🔍 Filtrar ${titulo.toLowerCase()}…`}
          value={busq} onChange={e => setBusq(e.target.value)}
          style={{ background: "#07090e", border: "1px solid #1c2633", color: "#c0ccdf", fontFamily: "inherit", fontSize: 11, padding: "6px 10px", borderRadius: 3, width: "100%", outline: "none" }}
        />
      </div>

      {/* Lista */}
      <div style={{ maxHeight: 240, overflowY: "auto", padding: "6px 0" }}>
        {filtrados.length === 0
          ? <div style={{ padding: "16px", textAlign: "center", fontSize: 10, color: "#2a4050" }}>Sin resultados</div>
          : filtrados.map(item => (
            <div key={item} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: "1px solid #080b12", transition: "background .1s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#0d111a"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 12, color: "#c0ccdf", fontWeight: 500 }}>{item}</span>
              <button
                onClick={() => eliminar(item)}
                style={{ background: "none", border: "none", color: "#2a3a4a", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 4px", fontFamily: "inherit", transition: "color .15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                onMouseLeave={e => e.currentTarget.style.color = "#2a3a4a"}
                title={`Eliminar ${item}`}
              >✕</button>
            </div>
          ))
        }
      </div>

      {/* Agregar */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${border}`, background: "#050810", display: "flex", gap: 8 }}>
        <input
          placeholder={placeholder}
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === "Enter" && agregar()}
          style={{ flex: 1, background: "#07090e", border: `1px solid ${items.includes(nuevo.trim()) && nuevo.trim() ? "#f87171" : "#1c2633"}`, color: "#c0ccdf", fontFamily: "inherit", fontSize: 11, padding: "7px 10px", borderRadius: 3, outline: "none" }}
        />
        <button
          onClick={agregar}
          disabled={!nuevo.trim() || items.includes(nuevo.trim())}
          style={{ background: nuevo.trim() && !items.includes(nuevo.trim()) ? "#221800" : "#0b0e16", border: `1px solid ${nuevo.trim() && !items.includes(nuevo.trim()) ? color : "#1c2633"}`, color: nuevo.trim() && !items.includes(nuevo.trim()) ? color : "#2a4050", borderRadius: 3, padding: "7px 16px", cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1, transition: "all .15s", whiteSpace: "nowrap" }}
        >＋ Agregar</button>
      </div>
    </div>
  );
}

function GestionUsuarios({ usuarios, setUsuarios, sesionId }) {
  const formVacio = { nombre: "", usuario: "", pwd: "", rol: "trader" };
  const [form,       setForm]    = useState(formVacio);
  const [mostrar,    setMostrar] = useState(false);
  const [editId,     setEditId]  = useState(null);
  const [resetId,    setResetId] = useState(null);
  const [nuevaPwd,   setNuevaPwd]= useState("");
  const [formError,  setFormError]= useState("");
  const sF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    setFormError("");
    if (!form.nombre.trim() || !form.usuario.trim()) return;
    if (editId) {
      const { error } = await sb.from('profiles').update({ nombre: form.nombre.trim(), rol: form.rol }).eq('id', editId);
      if (error) { setFormError(error.message); return; }
      setUsuarios(prev => prev.map(u => u.id === editId ? { ...u, nombre: form.nombre.trim(), rol: form.rol } : u));
    } else {
      if (!form.pwd.trim()) return;
      if (usuarios.find(u => u.usuario === form.usuario.trim())) { setFormError("Ese usuario ya existe"); return; }
      // Use separate client so admin session is not replaced
      const { data, error } = await sbAdmin.auth.signUp({
        email: `${form.usuario.trim()}@ibb.mx`,
        password: form.pwd,
      });
      if (error) { setFormError(error.message); return; }
      const profile = { id: data.user.id, nombre: form.nombre.trim(), usuario: form.usuario.trim(), rol: form.rol, activo: true, creado: new Date().toISOString().slice(0,10) };
      await sb.from('profiles').insert(profile);
      setUsuarios(prev => [...prev, profile]);
    }
    setForm(formVacio); setMostrar(false); setEditId(null);
  };

  const toggleActivo = async (id) => {
    const esUltimoAdmin = usuarios.filter(u => u.rol === "admin" && u.activo).length === 1;
    const u = usuarios.find(x => x.id === id);
    if (u.rol === "admin" && u.activo && esUltimoAdmin) return;
    const newActivo = !u.activo;
    await sb.from('profiles').update({ activo: newActivo }).eq('id', id);
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: newActivo } : u));
  };

  const cambiarRol = async (id, rol) => {
    const esUltimoAdmin = usuarios.filter(u => u.rol === "admin" && u.activo).length === 1;
    const u = usuarios.find(x => x.id === id);
    if (u.rol === "admin" && rol !== "admin" && esUltimoAdmin) return;
    await sb.from('profiles').update({ rol }).eq('id', id);
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, rol } : u));
  };

  const eliminar = async (id) => {
    if (id === sesionId) return;
    const esUltimoAdmin = usuarios.filter(u => u.rol === "admin").length === 1 && usuarios.find(x=>x.id===id)?.rol === "admin";
    if (esUltimoAdmin) return;
    if (!window.confirm("¿Eliminar este usuario?")) return;
    await sb.from('profiles').delete().eq('id', id);
    setUsuarios(prev => prev.filter(u => u.id !== id));
  };

  const confirmarReset = async (id) => {
    if (!nuevaPwd.trim()) return;
    // Password reset for other users requires service-role key (backend).
    // This resets the CURRENT user's own password only if id matches session.
    alert("El restablecimiento de contraseña de otros usuarios requiere configurar la service role key en el backend. Por ahora, usa el panel de Supabase → Authentication → Users.");
    setResetId(null); setNuevaPwd("");
  };

  const abrirEditar = (u) => { setForm({ nombre: u.nombre, usuario: u.usuario, pwd: "", rol: u.rol }); setEditId(u.id); setMostrar(true); setFormError(""); };

  return (
    <div style={{ background: "#07090e", border: "1px solid #1c2633", borderRadius: 6, marginBottom: 20, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#040610", padding: "14px 18px", borderBottom: "1px solid #1c2633", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔐</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fbbf24", letterSpacing: 1.5 }}>GESTIÓN DE USUARIOS</div>
            <div style={{ fontSize: 9, color: "#2a4050", marginTop: 1 }}>{usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""} registrado{usuarios.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <button className="btn-gold" style={{ fontSize: 9, padding: "6px 14px" }}
          onClick={() => { setForm(formVacio); setEditId(null); setMostrar(true); }}>＋ Nuevo Usuario</button>
      </div>

      {/* Formulario nuevo/editar */}
      {mostrar && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1c2633", background: "#050810" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div><div className="lbl">Nombre completo</div><input value={form.nombre} onChange={e=>sF("nombre",e.target.value)} placeholder="ej. Juan Rivera" /></div>
            <div><div className="lbl">Usuario</div><input value={form.usuario} onChange={e=>sF("usuario",e.target.value)} placeholder="ej. jrivera" disabled={!!editId} style={{opacity:editId?.5:1}} /></div>
            {!editId && <div><div className="lbl">Contraseña</div><input type="password" value={form.pwd} onChange={e=>sF("pwd",e.target.value)} placeholder="••••••••" /></div>}
            <div><div className="lbl">Rol</div>
              <select value={form.rol} onChange={e=>sF("rol",e.target.value)}>
                <option value="admin">Admin</option>
                <option value="trader">Trader</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-gold" style={{ fontSize: 9, padding: "8px 14px", whiteSpace: "nowrap" }} onClick={guardar}>
                {editId ? "✓ Guardar" : "＋ Crear"}
              </button>
              <button className="btn-ghost" style={{ fontSize: 9, padding: "8px 10px" }} onClick={() => { setMostrar(false); setEditId(null); setForm(formVacio); setFormError(""); }}>✕</button>
            </div>
          </div>
          {formError && <div style={{ fontSize: 9, color: "#f87171", marginTop: 8 }}>✕ {formError}</div>}
        </div>
      )}

      {/* Tabla de usuarios */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Nombre","Usuario","Rol","Estado","Creado","Acciones"].map(h => (
              <th key={h} style={{ background: "#050710", color: "#2a4050", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "8px 14px", textAlign: "left", borderBottom: "1px solid #101820" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usuarios.map(u => (
            <React.Fragment key={u.id}>
              <tr style={{ background: u.id === sesionId ? "#080c14" : undefined }}>
                <td style={{ padding: "9px 14px", fontSize: 11, color: "#dce8f8", fontWeight: 600 }}>
                  {u.nombre} {u.id === sesionId && <span style={{ fontSize: 8, color: "#fbbf24", marginLeft: 4 }}>← tú</span>}
                </td>
                <td style={{ padding: "9px 14px", fontSize: 10, color: "#3a5060", fontFamily: "monospace" }}>{u.usuario}</td>
                <td style={{ padding: "9px 14px" }}>
                  {u.id !== sesionId
                    ? <select value={u.rol} onChange={e => cambiarRol(u.id, e.target.value)}
                        style={{ width: "auto", padding: "3px 6px", fontSize: 9, background: "#0b0e16", border: "1px solid #1c2633", color: "#c0ccdf", borderRadius: 2 }}>
                        <option value="admin">Admin</option>
                        <option value="trader">Trader</option>
                      </select>
                    : <span className={`pill p-${u.rol}`}>{u.rol.toUpperCase()}</span>
                  }
                </td>
                <td style={{ padding: "9px 14px" }}>
                  <button onClick={() => toggleActivo(u.id)} style={{ background: "none", border: `1px solid ${u.activo?"#143820":"#301418"}`, color: u.activo?"#3ddc84":"#f87171", borderRadius: 2, padding: "2px 8px", cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 1 }}>
                    {u.activo ? "ACTIVO" : "INACTIVO"}
                  </button>
                </td>
                <td style={{ padding: "9px 14px", fontSize: 9, color: "#2a4050" }}>{u.creado || "—"}</td>
                <td style={{ padding: "9px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-ghost" style={{ fontSize: 9, padding: "4px 10px" }} onClick={() => abrirEditar(u)}>✎ Editar</button>
                    <button className="btn-ghost" style={{ fontSize: 9, padding: "4px 10px", color: "#818cf8", borderColor: "#818cf8" }}
                      onClick={() => { setResetId(resetId === u.id ? null : u.id); setNuevaPwd(""); }}>⟳ Pwd</button>
                    {u.id !== sesionId && (
                      <button className="btn-ghost" style={{ fontSize: 9, padding: "4px 10px", color: "#f87171", borderColor: "#f87171" }}
                        onClick={() => eliminar(u.id)}>✕</button>
                    )}
                  </div>
                </td>
              </tr>
              {resetId === u.id && (
                <tr style={{ background: "#060812" }}>
                  <td colSpan={6} style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: "#818cf8", letterSpacing: 1 }}>NUEVA CONTRASEÑA PARA {u.usuario.toUpperCase()}:</span>
                      <input type="password" value={nuevaPwd} onChange={e=>setNuevaPwd(e.target.value)} placeholder="nueva contraseña" style={{ width: 200 }} />
                      <button className="btn-gold" style={{ fontSize: 9, padding: "6px 12px", whiteSpace: "nowrap", borderColor: "#818cf8", color: "#818cf8" }} onClick={() => confirmarReset(u.id)}>✓ Confirmar</button>
                      <button className="btn-ghost" style={{ fontSize: 9, padding: "6px 10px" }} onClick={() => { setResetId(null); setNuevaPwd(""); }}>Cancelar</button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPanel({ contrapartes, setCp, operadores, setOps2, calificaciones, setCal, tiposVenc, setTV, monedas, setMon, cpDefault, opsDefault, calDefault, tvDefault, monDefault, usuarios, setUsuarios, sesionId }) {
  const listas = [
    { titulo: "Contrapartes",        icono: "🏦", color: "#5bc8fa", bg: "#050a14", border: "#0d1a28", items: contrapartes, setItems: setCp,   placeholder: "ej. BBVA Securities",    defaultItems: cpDefault  },
    { titulo: "Operadores",          icono: "👤", color: "#fbbf24", bg: "#0a0800", border: "#201400", items: operadores,   setItems: setOps2, placeholder: "ej. R. García",          defaultItems: opsDefault },
    { titulo: "Calificaciones",      icono: "⭐", color: "#3ddc84", bg: "#050e08", border: "#0d2014", items: calificaciones,setItems: setCal,  placeholder: "ej. CCC+",               defaultItems: calDefault },
    { titulo: "Tipos de Vencimiento",icono: "📅", color: "#818cf8", bg: "#07070e", border: "#14143a", items: tiposVenc,    setItems: setTV,   placeholder: "ej. Extendible",          defaultItems: tvDefault  },
    { titulo: "Monedas",             icono: "💱", color: "#f87171", bg: "#0e0505", border: "#2a0e0e", items: monedas,      setItems: setMon,  placeholder: "ej. GBP",                defaultItems: monDefault },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f0e4c0", letterSpacing: 2 }}>⚙ ADMINISTRACIÓN DEL SISTEMA</div>
          <div style={{ fontSize: 9, color: "#3a5060", marginTop: 3, letterSpacing: 1.5 }}>
            Gestiona las listas maestras del blotter · Los cambios se guardan automáticamente en el navegador
          </div>
        </div>
        <div style={{ fontSize: 9, color: "#2a4050", background: "#080b12", border: "1px solid #101820", borderRadius: 3, padding: "6px 12px", letterSpacing: 1 }}>
          ☁ AUTO-GUARDADO · SUPABASE
        </div>
      </div>

      {/* Advertencia */}
      <div style={{ background: "#0a0800", border: "1px solid #302810", borderRadius: 4, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ fontSize: 10, color: "#f5a842", letterSpacing: .5 }}>
          Los cambios aplican inmediatamente en todos los formularios del blotter. Eliminar una contraparte u operador no afecta tickets ya registrados.
        </span>
      </div>

      {/* Gestión de Usuarios */}
      <GestionUsuarios usuarios={usuarios} setUsuarios={setUsuarios} sesionId={sesionId} />

      {/* Grid de listas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {listas.map(l => <GestionLista key={l.titulo} {...l} />)}
      </div>

      {/* Footer de estadísticas */}
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {listas.map(l => (
          <div key={l.titulo} style={{ background: l.bg, border: `1px solid ${l.border}`, borderRadius: 4, padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#2a4050", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>{l.titulo}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: l.color }}>{l.items.length}</div>
            <div style={{ fontSize: 8, color: "#2a4050", marginTop: 2 }}>registros</div>
          </div>
        ))}
      </div>
    </div>
  );
}
