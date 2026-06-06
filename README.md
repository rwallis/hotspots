# Hotspots

Analyze Fault Line Flyers gliding flights from [WeGlide](https://weglide.org), store them in PostgreSQL, detect thermals from IGC tracks, and map hotspot clusters.

## Stack

- Next.js 16 + TypeScript + Tailwind
- PostgreSQL via Prisma
- Leaflet map UI
- WeGlide public API

## Local setup

1. Install dependencies:

```powershell
npm.cmd install
```

2. Copy environment variables:

```powershell
copy .env.example .env.local
copy .env.local .env
```

Fill in `DATABASE_URL` from Railway Postgres. Use **both** files:
- `.env.local` — Next.js
- `.env` — Prisma CLI (`db:push`, `db:studio`)

3. Create database tables:

```powershell
npm.cmd run db:push
```

4. Start the dev server:

```powershell
npm.cmd run dev
```

5. Open:

- Map: [http://localhost:3001](http://localhost:3001)
- Sync admin: [http://localhost:3001/admin](http://localhost:3001/admin)

> Uses port **3001** locally so it does not conflict with Metabase on 3000.

## Sync workflow

1. Go to `/admin`
2. Choose a calendar year
3. Click **Download**
4. The app will:
   - discover club flights from WeGlide (> 30 minutes)
   - import IGC files in batches
   - detect thermals and rebuild hotspot clusters

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `WEGLIDE_CLUB_ID` | No | Defaults to `1006` (Fault Line Flyers) |
| `WEGLIDE_API_KEY` | Later | Needed when deploying to Railway/server IPs |

## Railway deployment

### 1. Create the project

1. Open [Railway](https://railway.com) → **New Project**
2. **Deploy from GitHub repo** → choose `rwallis/hotspots`
3. In the same project, click **+ New** → **Database** → **PostgreSQL**

You should have two services: **hotspots** (web) and **Postgres** (database).

### 2. Connect the web app to Postgres

In the **hotspots** web service (not Postgres):

1. Open **Variables**
2. Click **+ New Variable** → **Add Reference** (or paste manually)
3. Add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

> Use the exact Postgres service name from your dashboard. If Railway named it something other than `Postgres`, replace it in the reference (e.g. `${{PostgreSQL.DATABASE_URL}}`).

`${{Postgres.DATABASE_URL}}` is the **private** internal URL — correct for app ↔ database inside Railway.

### 3. Other environment variables

Add these on the **hotspots** web service:

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `DATABASE_URL` | Yes | `${{Postgres.DATABASE_URL}}` (reference above) |
| `WEGLIDE_CLUB_ID` | No | `1006` (Fault Line Flyers default) |
| `WEGLIDE_API_KEY` | For `/admin` sync | Request from info@weglide.org — server IPs are blocked without a key |
| `NODE_ENV` | Auto | Railway sets `production` on deploy |

You do **not** need to set `PORT` — Railway injects it; the app reads it via `npm start`.

### 4. Build & schema

`railway.toml` + `nixpacks.toml` configure:

- **Node 20** via `.node-version`
- **Install:** `npm ci --include=dev` (dev deps needed for TypeScript/Tailwind build)
- **Build:** `npm run build` (runs `prisma generate` + Next.js build)
- **Pre-deploy:** `npx prisma db push` (creates/updates tables before each deploy)
- **Start:** `npm start` (Next.js on Railway’s `PORT`)

If a deploy fails at `npm ci`, push the latest repo changes (Prisma is in `dependencies`, `postinstall` removed) and redeploy.

### 5. Deploy & verify

1. Push to `master` on GitHub (or click **Deploy** in Railway)
2. Watch **Build** and **Deploy** logs — pre-deploy should show Prisma syncing the schema
3. Open the generated **hotspots** public URL
4. Check health: `https://<your-app>.up.railway.app/api/health/db` → should return `"ok": true`
5. Map: `/` · Upload: `/upload` · Admin sync: `/admin` (needs `WEGLIDE_API_KEY` on Railway)

### 6. Local dev against Railway Postgres (optional)

To use the same database locally, copy the **public** Postgres URL from the Postgres service **Connect** tab into `.env` and `.env.local`:

```env
DATABASE_URL="postgresql://postgres:...@....railway.app:.../railway"
WEGLIDE_CLUB_ID=1006
WEGLIDE_API_KEY=
```

Run `npm run db:push` locally only if you need to sync schema outside a Railway deploy.

## Notes

- Local development from a residential IP can usually call the WeGlide API without a key.
- Railway uses a server IP, so request a WeGlide API key before production syncing.
- Hotspot analysis merges thermals across all synced years; the map can filter by year and pilot.
