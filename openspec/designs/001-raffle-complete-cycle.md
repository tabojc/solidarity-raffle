# Design: Complete SDD Cycle — Rifa Solidaria

## Context

Existing `openspec/specs/raffle/spec.md` defines 8 functional requirements and 4 non-functional requirements. The codebase implements most of them, but several gaps exist between spec and implementation.

This design documents the current architecture, analyses gaps, and proposes targeted changes to close them.

---

## Current Architecture

### Data Flow

```
Browser ──fetch──> Next.js API Routes ──> lib/kv.ts ──> Upstash Redis
                        │
                   [React Client Components]
                        │
             ┌──────────┼──────────┐
             │          │          │
         page.tsx   admin/      components/
        (public)   page.tsx     Hero, NumberGrid,
                                ReserveModal
```

### Redis Keys

| Key | Type | Purpose |
|-----|------|---------|
| `raffle:numbers` | Hash | 100 fields (`"00"`–`"99"`) |
| `raffle:config` | Hash | Single hash with raffle settings |

### API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/numbers` | Public | Returns all numbers |
| POST | `/api/numbers` | Public | Reserve a number |
| PUT | `/api/numbers/[num]?token=` | ADMIN_TOKEN | Confirm payment |
| GET | `/api/config` | Public | Raffle config |
| GET | `/api/export?token=` | ADMIN_TOKEN | CSV export |

---

## Gap Analysis: Spec vs Implementation

### REQ-003: Reservation Timeout — NOT IMPLEMENTED

**Spec**: Reserved numbers MUST return to available after a configurable timeout.

**Current state**: `reserveTimeoutHours` exists in config but is never read. No code reverts expired reservations.

**Solution**: Add timeout check in `getAllNumbers()` that auto-reverts expired reservations when read (lazy expiration). This is the simplest approach — no cron, no background worker.

### REQ-006: Real-time Updates — NOT IMPLEMENTED

**Spec**: Polling every 5 seconds, all clients see updates within 5 seconds.

**Current state**: Data fetched once on mount. Re-fetched only after user action (reserve, confirm).

**Solution**: Add `setInterval` polling (5s) on both `page.tsx` (public) and `admin/page.tsx`.

### NFR-004: Rate Limiting — NOT IMPLEMENTED

**Spec**: Max 10 requests per minute per IP.

**Current state**: No rate limiting at all.

**Solution**: Vercel free tier doesn't natively support per-IP rate limiting in serverless functions. Use a simple in-memory Map-based limiter per request — not perfect in serverless cold starts but better than nothing. Accept that this is best-effort on free tier.

### Admin Auth Flow — DEVIATION FROM SPEC

**Spec**: URL-based token (`/admin?token=VALID_TOKEN`), no login form.

**Current state**: Form-based auth with `localStorage`. Token from URL is ignored.

**Analysis**: The form approach is actually better UX (no token in URL/history), but it breaks the spec's "share link with ?token" workflow. Fix: support BOTH — read `?token` from URL on initial load, store in localStorage, redirect to clean URL (no token in URL after auth).

### REQ-007: Mobile Responsiveness — PARTIAL

- Grid uses `grid-cols-5 sm:grid-cols-10` ✅
- But no explicit `min-height: 44px` touch targets as spec requires in REQ-007
- Admin page not tested on mobile

### Missing Tests

- No component tests (Hero, NumberGrid, ReserveModal, AdminPage)
- No polling/integration test

---

## Proposed Changes

### Change 1: Reservation Timeout (lazy expiration)

**File**: `src/lib/kv.ts`

Modify `getAllNumbers()`: iterate returned numbers, check `reservedAt + reserveTimeoutHours`, revert expired ones atomically with HSET, return updated map.

**Reopened numbers should be logged** for traceability.

### Change 2: Real-time Polling

**Files**: `src/app/page.tsx`, `src/app/admin/page.tsx`

Add `useEffect` with `setInterval(loadData, 5000)` + `clearInterval` on cleanup. Skip interval while modal is open (public page) to avoid race conditions.

### Change 3: Rate Limiting

**File**: `src/lib/rate-limit.ts` (new)

Simple IP-based limiter using a `Map<string, { count: number; resetAt: number }>`. Wrap API routes with a `withRateLimit` helper.

### Change 4: URL Token Support for Admin

**File**: `src/app/admin/page.tsx`

On mount, read `?token=` from URL search params. If present, store in localStorage and authenticate immediately. Then replace URL to remove token from address bar (via `window.history.replaceState`).

### Change 5: Touch Target Size

**File**: `src/components/NumberGrid.tsx`

Add `min-h-[44px] min-w-[44px]` to number cells.

### Change 6: Tests for gaps

**Directory**: `src/__tests__/`

- `timeout.test.ts` — verify expired reservations revert
- `admin-auth.test.ts` — verify URL token auth
- Component tests for grid and modal (v2 recommendation)

---

## Sequence: Reservation with Timeout

```
Browser                  API Route                  lib/kv.ts                  Redis
  │                         │                         │                         │
  │── POST /api/numbers ───>│                         │                         │
  │   {num: "42", by: "A"}  │── reserveNumber ───────>│                         │
  │                         │                         │── HGET raffle:numbers ──>│
  │                         │                         │<── {available} ──────────│
  │                         │                         │── HSET ─────────────────>│
  │                         │                         │<── OK ──────────────────│
  │                         │<── {reserved} ──────────│                         │
  │<── 200 OK ─────────────│                         │                         │
  │                         │                         │                         │
  │── GET /api/numbers ────>│                         │                         │
  │  (5s later via polling) │── getAllNumbers ───────>│                         │
  │                         │                         │── HGETALL ──────────────>│
  │                         │                         │<── all numbers ──────────│
  │                         │                         │── check timeout (24h)    │
  │                         │                         │   if expired: HSET ─────>│
  │                         │                         │<── updated ─────────────│
  │                         │<── numbers ─────────────│                         │
  │<── 200 OK ─────────────│                         │                         │
```

---

## Architecture Decision Records

### ADR-001: Lazy expiration over cron

**Decision**: Check and revert expired reservations on every `getAllNumbers()` call instead of a background job.

**Rationale**: Vercel serverless has no persistent background process. A cron would require additional infrastructure (Vercel Cron Jobs, which are paid). Lazy expiration is zero-infrastructure and correct for this scale (100 numbers, <100 concurrent users).

**Tradeoff**: An expired reservation stays "reserved" until the next read. Acceptable because the grid polls every 5s, so max delay is 5 seconds.

### ADR-002: In-memory rate limiting over external store

**Decision**: Use a local `Map` in the serverless function instance.

**Rationale**: Vercel KV calls cost money (30K/day free). An in-memory limiter costs nothing. On cold starts the limit resets, which is acceptable for a free-tier humanitarian project.

**Tradeoff**: Rate limit resets on cold start. Users might get a brief burst. Acceptable.

### ADR-003: Polling over WebSockets

**Decision**: Keep polling (as spec'ed). No WebSocket.

**Rationale**: Already spec'ed, implemented partially, works for the volume. WebSockets add complexity and cost (Vercel requires Pro for WebSocket support).

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/kv.ts` | Add lazy expiration in `getAllNumbers()` |
| `src/lib/rate-limit.ts` | NEW — simple IP rate limiter |
| `src/app/api/numbers/route.ts` | Add rate limiting to POST |
| `src/app/api/numbers/[num]/route.ts` | Add rate limiting to PUT |
| `src/app/api/export/route.ts` | Add rate limiting |
| `src/app/page.tsx` | Add 5s polling interval |
| `src/app/admin/page.tsx` | Add 5s polling + URL token support |
| `src/components/NumberGrid.tsx` | Add min touch target sizes |
| `src/__tests__/timeout.test.ts` | NEW — timeout revert tests |
| `src/__tests__/admin-auth.test.ts` | NEW — URL token auth tests |
