-- ============================================================
-- IBB · INVEX Bond Blotter — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre  TEXT NOT NULL,
  usuario TEXT UNIQUE NOT NULL,
  rol     TEXT NOT NULL DEFAULT 'trader' CHECK (rol IN ('admin', 'trader')),
  activo  BOOLEAN DEFAULT true,
  creado  DATE DEFAULT CURRENT_DATE
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_all" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. OPERACIONES (blotter trades)
CREATE TABLE IF NOT EXISTS public.operaciones (
  id            TEXT PRIMARY KEY,
  fecha         TEXT,
  emisor        TEXT,
  isin          TEXT,
  tipo          TEXT,
  cupon         NUMERIC,
  vencimiento   TEXT,
  tipo_venc     TEXT,
  calificacion  TEXT,
  moneda        TEXT,
  titulos       NUMERIC,
  valor_nominal NUMERIC,
  tipo_cambio   NUMERIC DEFAULT 1,
  comprador_cp  TEXT,
  px_compra     NUMERIC,
  vendedor_cp   TEXT,
  px_venta      NUMERIC,
  operador      TEXT,
  estatus       TEXT DEFAULT 'Booked',
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.operaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operaciones_all" ON public.operaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. LISTAS MAESTRAS
CREATE TABLE IF NOT EXISTS public.contrapartes  (nombre TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.operadores    (nombre TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.calificaciones(nombre TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.tipos_venc    (nombre TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.monedas       (nombre TEXT PRIMARY KEY);

ALTER TABLE public.contrapartes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operadores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_venc     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monedas        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_all"   ON public.contrapartes   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ops_all"  ON public.operadores     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cal_all"  ON public.calificaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tv_all"   ON public.tipos_venc     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mon_all"  ON public.monedas        FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: default admin user
-- Steps:
--   1. Go to Supabase Dashboard → Authentication → Users → Add user
--   2. Email: admin@ibb.mx  |  Password: admin123  |  "Auto Confirm User": ON
--   3. Copy the UUID shown for that user
--   4. Replace 'PASTE_UUID_HERE' below with that UUID and run:
-- ============================================================
-- INSERT INTO public.profiles (id, nombre, usuario, rol, activo, creado)
-- VALUES ('PASTE_UUID_HERE', 'Administrador', 'admin', 'admin', true, CURRENT_DATE);
