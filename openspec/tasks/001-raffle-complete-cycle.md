# Tasks: Complete SDD Cycle — Rifa Solidaria

## Phase 1: Reservation Timeout (T-001)

- [ ] **T-001.1**: Add `isExpired()` helper in `src/lib/kv.ts` that compares `reservedAt + reserveTimeoutHours` against `Date.now()`
- [ ] **T-001.2**: Modify `getAllNumbers()` to iterate results, detect expired reservations, revert them to `available` with `HSET`, and return updated map
- [ ] **T-001.3**: Add logging for reverted reservations (console.info with timestamp and number)
- [ ] **T-001.4**: Verify `getNumber()` also checks expiry (single-number case)

**Test**: `src/__tests__/timeout.test.ts` — mock Redis, set reservedAt in past, call getAllNumbers, verify reverted

---

## Phase 2: Real-time Polling (T-002)

- [ ] **T-002.1**: In `src/app/page.tsx`, add `useEffect` with `setInterval(loadData, 5000)` that runs only when `selected === null` (no modal open)
- [ ] **T-002.2**: In `src/app/admin/page.tsx`, add `useEffect` with `setInterval(loadData, 5000)`
- [ ] **T-002.3**: Clean up intervals on unmount in both components
- [ ] **T-002.4**: Add `isPolling` state indicator (optional, subtle pulse dot)

**Test**: Manual verification — open two browser tabs, reserve in one, see update in the other within 5 seconds

---

## Phase 3: Rate Limiting (T-003)

- [ ] **T-003.1**: Create `src/lib/rate-limit.ts` with:
  - `RateLimitEntry` type (count, resetAt)
  - `rateLimit(ip: string, limit: number, windowMs: number): { allowed: boolean; remaining: number }`
  - Uses `Map<string, RateLimitEntry>` with cleanup of expired entries
- [ ] **T-003.2**: Add `withRateLimit(handler, opts?)` wrapper for API routes
- [ ] **T-003.3**: Apply to POST `/api/numbers` (10 req/min)
- [ ] **T-003.4**: Apply to PUT `/api/numbers/[num]` (10 req/min)
- [ ] **T-003.5**: Apply to GET `/api/export` (5 req/min — CSV is heavier)
- [ ] **T-003.6**: Return 429 with `Retry-After` header when rate limited

**Test**: `src/__tests__/rate-limit.test.ts` — hit limiter 11 times, verify 429 on 11th

---

## Phase 4: Admin URL Token Auth (T-004)

- [ ] **T-004.1**: In `src/app/admin/page.tsx`, read `?token=` from `useSearchParams()` on mount
- [ ] **T-004.2**: If token present: store in localStorage, set auth state, call `window.history.replaceState(null, '', '/admin')` to clean URL
- [ ] **T-004.3**: Keep form-based login as fallback for UX

**Test**: `src/__tests__/admin-auth.test.ts` — render admin page with `?token=valid`, verify authenticated without form

---

## Phase 5: Touch Target Size (T-005)

- [ ] **T-005.1**: In `src/components/NumberGrid.tsx`, add `min-h-[44px] min-w-[44px]` to NumberCell buttons
- [ ] **T-005.2**: Verify touch targets pass WCAG minimum on mobile viewport

**Test**: Visual/manual on mobile viewport

---

## Phase 6: Seed Script Enhancement (T-006)

- [ ] **T-006.1**: Ensure `scripts/seed.ts` reads `RESERVE_TIMEOUT_HOURS` env and stores in config (already done — verify)

**Test**: Run `pnpm seed` against local Redis, verify config has timeout

---

## Verification

- [ ] **V-001**: `npm run test` — all existing + new tests pass
- [ ] **V-002**: `npm run build` — production build succeeds
- [ ] **V-003**: Manual flow: reserve a number → wait for mapping → verify timeout revert works (in test env with short timeout)
