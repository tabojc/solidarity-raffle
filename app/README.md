# Rifa Solidaria — App

## Quick Start

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the public raffle page.
Open [http://localhost:3000/admin?token=TOKEN](http://localhost:3000/admin?token=TOKEN) for the admin panel.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required:
- `UPSTASH_REDIS_REST_URL` — Redis endpoint
- `UPSTASH_REDIS_REST_TOKEN` — Redis auth token
- `ADMIN_TOKEN` — Secret token for admin access

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm test` | Run tests |
| `pnpm seed:config` | Update raffle config (safe) |
| `pnpm seed:reset` | Reset all numbers (⚠️ destructive) |
| `pnpm seed:backup` | Export Redis data to JSON |
| `pnpm seed:restore <file>` | Import JSON data to Redis |

## Project Structure

```
src/
├── app/
│   ├── api/           # Route handlers (numbers, config, export)
│   ├── admin/         # Admin panel
│   └── page.tsx       # Public raffle page
├── components/        # Hero, NumberGrid, ReserveModal
├── lib/               # KV store, API client, types, rate limiting
└── __tests__/         # Vitest tests
scripts/
├── seed.ts            # Seed config and optionally reset numbers
├── backup.ts          # Export Redis data to JSON
└── restore.ts         # Import JSON data to Redis
```
