# IBB · INVEX Bond Blotter — CLAUDE.md

## What This App Does

**IBB** is a professional bond trading blotter for INVEX's fixed income desk. Traders register buy/sell operations on government and corporate bonds (USD, MXN, EUR), track P&L in real time, and manage counterparties, operators, and users. Admins get a full management panel; traders see only the operational tabs.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 6 |
| Styling | Inline styles + CSS classes (dark theme, no CSS framework) |
| Charts | Recharts |
| Auth + DB | Supabase (PostgreSQL + Supabase Auth) |
| Bond Prices | Express 5 API → AWS RDS SQL Server (Valmer + PIP) |
| Deployment | Vercel (frontend) |

---

## Project Structure

```
blotter-bonds/
├── src/
│   ├── App.jsx              # Entire frontend (~1,800 lines, single component)
│   ├── MonitorPrecios.jsx   # Price monitor tab (Recharts + API calls)
│   ├── supabase.js          # Two Supabase clients (main + admin-no-persist)
│   └── main.jsx             # React entry point (StrictMode enabled)
├── server.cjs               # Express API on port 3001 (MSSQL bond prices)
├── vite.config.js           # Vite + proxy /api → port 3001
├── supabase_schema.sql      # Full DB schema (run once in Supabase SQL Editor)
├── index.html
├── .env.local               # Supabase credentials (gitignored)
└── package.json
```

---

## Architecture Notes

### Single-File Frontend
`App.jsx` contains every component inline: `BlotterBondsINVEX` (main), `GestionLista`, `GestionUsuarios`, `AdminPanel`. Tab state drives all rendering. No routing library.

### Two Data Sources
- **Supabase** — trades, users, master lists (contrapartes, operadores, etc.). Real-time subscription on `operaciones` table pushes updates to all connected clients.
- **AWS RDS SQL Server** — bond price data from Valmer and PIP providers. Accessed only through `server.cjs`. **Not available on Vercel** (backend runs separately).

### Auth
- Login: `{usuario}@ibb.mx` email format sent to Supabase Auth internally; UI shows only `usuario`
- Roles: `admin` (7 tabs) | `trader` (6 tabs, no ⚙ Administración)
- Session persists via Supabase JWT in localStorage (survives page reload)
- Two Supabase clients: `sb` (persistent session) and `sbAdmin` (no session — used to create users without replacing admin session)

### Supabase Sync Pattern
All CRUD operations update React state optimistically first, then fire async Supabase calls:
```js
setOps(prev => [...prev, newOp]);          // immediate UI update
await sb.from('operaciones').insert(...);  // background DB write
```
Master lists (contrapartes, etc.) use `makeSyncedSetter()` which diffs prev/next and fires insert/delete as needed.

---

## Running Locally

```bash
npm install
npm start          # Vite (port 5173) + Express API (port 3001) concurrently
```

### Environment Variables (.env.local)
```
VITE_SUPABASE_URL=https://mrzbigndkmcmdixjtkvl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### First-Time Supabase Setup
1. Run `supabase_schema.sql` in Supabase SQL Editor
2. Disable email confirmation: Authentication → Sign In / Providers → Email → off
3. Create auth user: Authentication → Users → Add user → `admin@ibb.mx`
4. Insert profile:
```sql
INSERT INTO public.profiles (id, nombre, usuario, rol, activo, creado)
VALUES ('<UUID from auth.users>', 'Administrador', 'admin', 'admin', true, CURRENT_DATE);
```

---

## Database Schema

### `public.profiles`
Extends `auth.users`. Fields: `id` (UUID FK), `nombre`, `usuario` (unique), `rol` (admin|trader), `activo`, `creado`.

### `public.operaciones`
Bond trades. Key fields: `id` (TEXT, format `AGY-{timestamp}-{rand}`), `fecha`, `emisor`, `isin`, `tipo`, `moneda`, `titulos`, `valor_nominal`, `tipo_cambio`, `px_compra`, `px_venta`, `comprador_cp`, `vendedor_cp`, `operador`, `estatus`, `notas`.

### Master Lists (simple `nombre TEXT PRIMARY KEY`)
`contrapartes`, `operadores`, `calificaciones`, `tipos_venc`, `monedas`

All tables have RLS enabled with a blanket authenticated-user policy.

---

## Deployment

- **Frontend**: Vercel — `https://blotter-bonds.vercel.app`
- **Environment vars in Vercel**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- **Express backend**: Not deployed — Monitor Precios tab requires it running locally or on a separate server
- To redeploy after code changes: `git push origin main` → Vercel auto-deploys

---

## P&L Calculation

```
nominal          = titulos × valorNominal
importeCompra    = pxCompra × titulos           (bond currency)
importeVenta     = pxVenta  × titulos           (bond currency)
importeCompraMXN = importeCompra × tipoCambio
importeVentaMXN  = importeVenta  × tipoCambio
pnl              = importeCompraMXN − importeVentaMXN   (MXN)
diferencial      = pxCompra − pxVenta           (price points)
```

TDY/MTD/YTD P&L strips filter by `fecha` field on non-cancelled trades.

---

## Key Gotchas

- **React StrictMode** is enabled — effects run twice on mount in dev. Supabase `getSession()` is called twice on load; this is harmless.
- **genId()** uses `Date.now()` — collision-safe for normal trading volume.
- **mapOpToDb / mapOpFromDb** — field names in app are camelCase; DB columns are snake_case. Always map through these when reading/writing operaciones.
- **Password reset** for other users requires Supabase service role key (not yet implemented). Use Supabase Dashboard → Authentication → Users as workaround.
- **Monitor Precios** calls `/api/emisoras`, `/api/precio`, `/api/historico` — these 404 on Vercel since the Express server isn't deployed there. The tab degrades gracefully.

---

## Security Notes

- SQL Server credentials are hardcoded in `server.cjs` — move to env vars before any wider deployment
- Supabase anon key is safe to expose (it's public by design); RLS policies control access
- RLS policies are permissive (`FOR ALL TO authenticated USING (true)`) — tighten per-role if needed
