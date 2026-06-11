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
pnpm dev
```

Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables.

## License

MIT
