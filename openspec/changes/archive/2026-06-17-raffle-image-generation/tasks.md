# Tasks: Raffle Image Generation

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Dependencies & Infrastructure

- [x] 1.1 Add `satori` and `@resvg/resvg-js` to `app/package.json`
- [x] 1.2 Add `getImageCache`, `setImageCache`, `clearImageCache` functions to `app/src/lib/kv.ts`
- [x] 1.3 Wire `clearImageCache()` into all 5 mutation exports in `app/src/lib/kv.ts` (reserveNumber, adminReserveNumber, confirmNumber, undoConfirmNumber, cancelReservation)

## Phase 2: Image Generation Endpoint

- [x] 2.1 Create `app/src/app/api/raffle-image/route.tsx`: GET handler with cache check → data fetch → Satori JSX → resvg PNG → Redis cache → response

## Phase 3: Admin Integration

- [x] 3.1 Add `generateImage()` client function returning Blob to `app/src/lib/api.ts`
- [x] 3.2 Add "Generar Imagen" download button to `app/src/app/admin/page.tsx` alongside "Exportar CSV"

## Phase 4: Testing

- [x] 4.1 Unit test: route handler returns 200 + `image/png` on cache hit and cache miss (mock `@/lib/kv`)
- [x] 4.2 Unit test: route handler returns 500 on missing config or generation failure
- [x] 4.3 Unit test: clearImageCache is exported from kv
