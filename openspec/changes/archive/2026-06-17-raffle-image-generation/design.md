# Design: Raffle Image Generation

## Technical Approach

Generate 540×960px PNG on Edge Runtime via Satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG). Cache in Redis as base64 string with 1h TTL. Invalidate on every state mutation in `kv.ts`. Public endpoint, no auth — admin download via client-side fetch+blob.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Image lib | Satori + resvg-js | Sharp (native dep, no Edge), Canvas API | Edge-compatible, no native deps, JSX API matches React |
| Cache storage | Redis string (base64 PNG) | Vercel Blob, filesystem | Existing Redis already configured; same infra, no new services |
| Cache key | `raffle:image:png`, TTL 3600s | Per-request generation, longer TTL | TTL balances freshness vs cost; stale cache auto-clears |
| Invalidation | In kv.ts after each mutation | Dedicated middleware, webhook | Co-located with mutations; clear at source, no extra indirection |
| Font source | jsDelivr CDN, module-level cache | public/fonts/, npm import | Edge can't read fs; CDN is reliable, cached at module scope for function lifetime |
| API pattern | Direct async function export | Controller class, HOC | Follows existing pattern in config/numbers routes |

## Data Flow

```
Admin Panel (client)         Edge Runtime                     Redis
      │                            │                           │
      │  GET /api/raffle-image     │                           │
      ├────────────────────────────┤                           │
      │                            │  GET raffle:image:png     │
      │                            ├─────────────────────────► │
      │                            │  HIT (base64 PNG string)  │
      │                            │◄───────────────────────── │
      │  200 image/png             │                           │
      │◄───────────────────────────┤                           │
      │                            │                           │
      │  (or MISS)                 │                           │
      │                            ├── getAllNumbers() ──────► │
      │                            │◄── NumbersMap ─────────── │
      │                            ├── getConfig() ──────────► │
      │                            │◄── RaffleConfig ───────── │
      │                            │                           │
      │                            │  Satori(JSX) → SVG       │
      │                            │  resvg(SVG) → PNG Buffer  │
      │                            │                           │
      │                            │  SET raffle:image:png     │
      │                            │  EX 3600, base64 string   │
      │                            ├─────────────────────────► │
      │  200 image/png             │                           │
      │◄───────────────────────────┤                           │
```

Cache invalidation (inside kv.ts after each mutation):

```
reserveNumber / adminReserveNumber / confirmNumber
undoConfirmNumber / cancelReservation
  → kv.hset/hset/eval(...)   // commit mutation
  → kv.del('raffle:image:png')  // invalidate cache (fire & forget)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `satori` and `@resvg/resvg-js` |
| `src/lib/kv.ts` | Modify | Add `getImageCache`, `setImageCache`, `clearImageCache`; call `clearImageCache` from all 5 mutation exports |
| `src/app/api/raffle-image/route.ts` | Create | Edge endpoint: GET → cache check → fetch data → Satori → resvg → cache → return PNG |
| `src/lib/api.ts` | Modify | Add `generateImage()` client function returning Blob |
| `src/app/admin/page.tsx` | Modify | Add "Generar Imagen" button in header alongside "Exportar CSV" |

## Interfaces / Contracts

No new types needed — reuse existing `NumbersMap`, `RaffleConfig`, and `RaffleNumber` from `@/lib/types`.

New internal kv.ts functions:

```ts
// key: 'raffle:image:png', TTL: 3600s
async function getImageCache(): Promise<string | null>   // returns base64 PNG or null
async function setImageCache(pngBase64: string): Promise<void>  // stores with EX 3600
async function clearImageCache(): Promise<void>  // DEL the key
```

API contract:
- `GET /api/raffle-image` → `200 image/png` (PNG binary) or `500 application/json` `{ error: string }`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Route handler: cache hit, cache miss, missing config, generation failure | Mock `@/lib/kv` (existing pattern via `vi.mock`), assert response status + Content-Type |
| Unit | Invalidation: each kv mutation deletes cache | Mock `kv.del`, assert call count per mutation function |
| Integration | Satori JSX renders 100 cells, hearts for reserved/sold | Extract SVG generation into pure function, test dimensions + cell count |
| E2E | Admin download button triggers blob download | Manual (Vercel preview deploy + WhatsApp share test) |

## Migration / Rollout

No migration required. Install two new npm deps, add five files/changes — fully additive. Rollback by reverting the PR.

## Open Questions

None.
