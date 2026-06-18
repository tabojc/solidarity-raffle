# Raffle Image Generation Specification

## Purpose

Generate a 540×960px PNG of the current raffle state for sharing on WhatsApp. Edge Runtime via Satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG) with Redis caching.

## Requirements

### REQ-IMG-001: Public Image Endpoint

`GET /api/raffle-image` (public, no auth) MUST return a valid 540×960px PNG.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Happy path | Raffle is configured | GET /api/raffle-image | Valid PNG, Content-Type: image/png |
| Cache hit | Previous request cached in Redis | Second GET within TTL | Returns cached image, no re-render |
| Cache miss | Cached image TTL expired | GET arrives | Fresh image generated and cached with new TTL |

### REQ-IMG-002: Image Layout

The PNG MUST render: hero circular image, prize info, 10×10 grid (00–99), payment methods, draw date — top to bottom.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| All elements | Raffle has hero image, prizes, 100 numbers, payments, draw date | Image generates | Hero at top, prizes below, 10×10 grid center, payments + draw date at bottom |
| Reserved/sold | Number is reserved or sold | Grid cell renders | Pink (reserved) or accent (sold) background, ❤️ indicator, white text |
| Available | Number is available | Grid cell renders | Light background, dark number text, no heart |
| All numbers visible | No reservations exist | Grid renders | 100 cells (00–99) in 10×10 matrix, all light background |

### REQ-IMG-003: Cache Invalidation

A reservation or payment confirmation MUST delete the cached image from Redis.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Reservation clears cache | Cached image exists | New number reserved | Cache key deleted; next GET generates fresh image |
| Payment clears cache | Cached image exists | Seller confirms payment (reserved→sold) | Cache key deleted |
| No cache to clear | No cached image exists | Reservation created | No invalidation needed |
| Existing cache stale | Cache expired naturally | Reservation created | No invalidation needed; TTL already handled cache miss |

### REQ-IMG-004: Admin Download Button

Admin panel MUST show "Generate Image" button that fetches the endpoint and saves the PNG.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Admin downloads | Admin views panel with valid secret token | Clicks "Generate Image" | Fetches /api/raffle-image, saves as `rifa-solidaria.png` |
| Unauthorized | User has no valid token | Admin panel renders | Button is not displayed |

### REQ-IMG-005: Font Rendering

All text MUST render in Geist Sans, with system sans-serif fallback.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Font loads | Geist Sans WOFF2 available | Image generates | Satori renders all text in Geist Sans, crisp at 540×960px |
| Font fails | Geist Sans cannot be loaded | Image generates | Falls back to system sans-serif; image still succeeds |

### REQ-IMG-006: Error Handling

The endpoint MUST return errors for failure states.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Missing config | No raffle config in Redis | GET /api/raffle-image | 500 status with JSON error body |
| Generation failure | Satori or resvg throws an error | Image generation runs | 500 status, error logged server-side |
