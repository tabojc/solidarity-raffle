# Solidarity Raffle

A web app to manage number sales for a solidarity raffle fundraiser. Built with Next.js, Vercel KV (Upstash Redis), and Tailwind CSS.

## Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- **Backend**: Next.js Route Handlers (serverless)
- **Database**: Upstash Redis via Vercel KV
- **Real-time**: Polling every 5 seconds
- **Auth**: Secret link token (no login required)

## Features

- 10x10 number grid (00-99) with real-time state updates
- Three states: available → reserved → sold
- Public reservation with optional name
- Admin panel for payment confirmation
- CSV export for tracking
- Mobile-first design for WhatsApp distribution

## Getting Started

```bash
pnpm install
cp app/.env.example app/.env.local  # fill in values
pnpm dev
```

Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables.

---

## Data Management

### Backup (export Redis to JSON)

```bash
cd app
pnpm seed:backup                          # full backup with timestamp
pnpm seed:backup --active-only            # only reserved/sold numbers
pnpm seed:backup --output mi-backup.json  # custom filename
```

### Restore (import JSON to Redis)

```bash
cd app
pnpm seed:restore backup.json                  # preview only (dry-run)
pnpm seed:restore backup.json --interactive    # restore one by one
pnpm seed:restore backup.json --batch          # restore all at once
pnpm seed:restore backup.json --batch --force  # skip confirmations
```

### Seed Config (update raffle settings without touching numbers)

```bash
cd app
pnpm seed:config           # safe — only updates config, numbers untouched
```

### Seed Reset (⚠️ DANGER — deletes all numbers)

```bash
cd app
pnpm seed:reset            # resets 100 numbers to available (asks confirmation in prod)
```

### Pre-sync Checklist

Before any data sync or migration:

1. **Backup first**: `pnpm seed:backup`
2. **Verify the backup file** exists and has the expected data
3. **Run the sync** with `--dry-run` or `--interactive` when possible
4. **Verify after**: check the admin panel to confirm changes

### Backup Files

| File | Description |
|------|-------------|
| `backup-produccion.json` | Latest production state |
| `backup-pre-sync.json` | Snapshot before last sync |
| `backup-YYYY-MM-DD-HHMMSS.json` | Timestamped backups |

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `pnpm dev` | Start development server |
| Build | `pnpm build` | Production build |
| Tests | `pnpm test` | Run Vitest tests |
| Seed config | `pnpm seed:config` | Update raffle config only |
| Seed reset | `pnpm seed:reset` | Reset all numbers (⚠️ destructive) |
| Backup | `pnpm seed:backup` | Export Redis to JSON |
| Restore | `pnpm seed:restore <file>` | Import JSON to Redis |

## License

MIT
