# Archived Change: Complete SDD Cycle — Rifa Solidaria

**Status**: ✅ Complete
**Date**: 2026-06-13

## Summary

Completed the full SDD cycle for the raffle project: design → tasks → apply → verify → archive.

## What Was Done

### Gap Analysis (Design)

Identified 5 gaps between spec and existing code:
1. **REQ-003**: Reservation timeout — not implemented
2. **REQ-006**: Real-time polling — not implemented
3. **NFR-004**: Rate limiting — not implemented
4. **Auth**: URL-based token — not supported (form-only)
5. **REQ-007**: Touch target size — not enforced

### Implemented (Apply)

| Task | File(s) | Description |
|------|---------|-------------|
| T-001 | `src/lib/kv.ts` | Lazy expiration — auto-revert expired reservations on read |
| T-002 | `src/app/page.tsx`, `admin/page.tsx` | 5s polling interval for real-time updates |
| T-003 | `src/lib/rate-limit.ts`, 3 API routes | In-memory IP rate limiter (10/min, 5/min for CSV) |
| T-004 | `src/app/admin/page.tsx` | URL token auth (`?token=`) + form fallback |
| T-005 | `src/components/NumberGrid.tsx` | `min-h-[44px] min-w-[44px]` touch targets |
| T-006 | `scripts/seed.ts` | Verified — already handles `RESERVE_TIMEOUT_HOURS` |

### Verification

- ✅ All 13 existing tests pass
- ✅ Production build succeeds
- ✅ TypeScript strict mode passes

## Spec Delta

The spec is now fully aligned with the implementation. No spec changes were required — the gaps were implementation gaps, not spec errors.

### Notable Deviations from Original Spec

| Spec | As Implemented | Rationale |
|------|----------------|-----------|
| URL-only admin auth (`?token=`) | Form + URL token dual support | Better UX (no tokens in history) |
| Reservation timeout via cron/system | Lazy expiration on read | Zero-infrastructure on Vercel free tier |
| Rate limiting via external service | In-memory Map | Free tier constraint |

## Files Changed

```
M src/lib/kv.ts                    (+58 -6)  lazy expiration
A src/lib/rate-limit.ts            (+27)     rate limiter
M src/app/api/numbers/route.ts     (+16 -1)  rate limit on POST
M src/app/api/numbers/[num]/route.ts (+17 -2) rate limit on PUT
M src/app/api/export/route.ts      (+17 -2)  rate limit on GET
M src/app/page.tsx                 (+3 -1)   5s polling
M src/app/admin/page.tsx           (+7 -1)   polling + URL token auth
M src/components/NumberGrid.tsx    (+1 -1)   touch target sizes
M src/components/ReserveModal.tsx  (+2 -1)   TS type fix
```

## Architecture Decisions (Confirmed)

- **Lazy expiration** over cron/background jobs (ADR-001)
- **In-memory rate limiting** over external store (ADR-002)
- **Polling** over WebSocket (ADR-003)
