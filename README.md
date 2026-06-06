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

1. Push this repo to GitHub
2. Create a Railway project with:
   - PostgreSQL database
   - Web service connected to the GitHub repo
3. Add environment variables in Railway:
   - `DATABASE_URL` from the Postgres service
   - `WEGLIDE_CLUB_ID=1006`
   - `WEGLIDE_API_KEY` after requesting one from info@weglide.org
4. Deploy

## Notes

- Local development from a residential IP can usually call the WeGlide API without a key.
- Railway uses a server IP, so request a WeGlide API key before production syncing.
- Hotspot analysis merges thermals across all synced years; the map can filter by year and pilot.
