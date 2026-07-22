# API Reference — Rifa Solidaria

7 endpoints REST. Todos los endpoints públicos devuelven CORS `access-control-allow-origin: *`.
Los endpoints protegidos requieren `ADMIN_TOKEN`.

---

## Índice

- [GET /api/config](#get-apiconfig)
- [GET /api/numbers](#get-apinumbers)
- [POST /api/numbers](#post-apinumbers)
- [PUT /api/numbers/[num]](#put-apinumbersnum)
- [GET /api/admin/verify](#get-apiadminverify)
- [GET /api/export](#get-apiexport)
- [GET /api/raffle-image](#get-apiraffle-image)

---

## GET /api/config

Obtener la configuración de la rifa (nombre, beneficiaria, premios, fecha, precio).

- **Auth**: No
- **Rate limit**: No
- **CORS**: `access-control-allow-origin: *`

### Respuestas

| Status | Descripción | Body |
|--------|-------------|------|
| `200` | Configuración encontrada | `{ name, beneficiary, heroImageUrl, prizes[], ticketPrice, drawDate, drawTime, lottery, reserveTimeoutHours }` |
| `404` | No hay configuración en Redis | `{ "error": "Config not found" }` |

### Ejemplo

```bash
curl https://rifa-solidaria.vercel.app/api/config
```

```json
{
  "name": "Rifa Solidaria",
  "beneficiary": "Nombre de la beneficiaria",
  "heroImageUrl": "/hero.webp",
  "prizes": [
    { "position": 1, "amount": 600 },
    { "position": 2, "amount": 400 }
  ],
  "ticketPrice": 20,
  "drawDate": "2026-07-26",
  "drawTime": "22:30",
  "lottery": "Lotería Táchira A y B",
  "reserveTimeoutHours": 24
}
```

---

## GET /api/numbers

Obtener todos los números de la rifa con su estado actual.

- **Auth**: No
- **Rate limit**: No
- **CORS**: `access-control-allow-origin: *`

### Respuestas

| Status | Descripción | Body |
|--------|-------------|------|
| `200` | Todos los números (100) | `Record<string, RaffleNumber>` |

### Body: RaffleNumber

```json
{
  "status": "available" | "reserved" | "sold",
  "reservedBy": "string | null",
  "reservedAt": "number (timestamp) | null",
  "confirmedAt": "number (timestamp) | null",
  "note": "string | null"
}
```

### Ejemplo

```bash
curl https://rifa-solidaria.vercel.app/api/numbers
```

```json
{
  "00": { "status": "available", "reservedBy": null, "reservedAt": null, "confirmedAt": null },
  "01": { "status": "reserved", "reservedBy": "Juan", "reservedAt": 1718100000000, "confirmedAt": null },
  "02": { "status": "sold", "reservedBy": "María", "reservedAt": 1718090000000, "confirmedAt": 1718100000000 }
}
```

---

## POST /api/numbers

Reservar un número. Dos modos: **público** (sin token) y **admin** (con `adminToken`).

### Modo público

Cualquier persona puede reservar un número disponible. Aplica rate limit por IP.

### Modo admin

Usado desde el panel `/admin` para reservar en nombre de un cliente (ej: llamada telefónica). No aplica rate limit, pero requiere `adminToken` y `reservedBy`.

- **Auth**: No (público) / Sí via `adminToken` en body (admin)
- **Rate limit**: 10 requests por 60s por IP (solo modo público)
- **CORS**: `access-control-allow-origin: *`

### Request body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `num` | `string` | ✅ | Número a reservar (ej: `"05"`, `"42"`) |
| `reservedBy` | `string` | No (público) / ✅ (admin) | Nombre de la persona que reserva |
| `adminToken` | `string` | No | Si se envía y coincide con `ADMIN_TOKEN`, opera en modo admin |

### Respuestas

| Status | Descripción | Body |
|--------|-------------|------|
| `200` | Reserva exitosa | `{ status, reservedBy, reservedAt, confirmedAt }` |
| `400` | Falta `num` o falta `reservedBy` en modo admin | `{ "error": "..." }` |
| `409` | Número no disponible (ya reservado o vendido) | `{ "error": "Number is not available" }` |
| `429` | Rate limit excedido (modo público) | `{ "error": "Demasiadas solicitudes..." }` + header `retry-after` |

### Ejemplo público

```bash
curl -X POST https://rifa-solidaria.vercel.app/api/numbers \
  -H "Content-Type: application/json" \
  -d '{"num": "42", "reservedBy": "María"}'
```

### Ejemplo admin

```bash
curl -X POST https://rifa-solidaria.vercel.app/api/numbers \
  -H "Content-Type: application/json" \
  -d '{"num": "42", "reservedBy": "Cliente - 0412-1234567", "adminToken": "secreto"}'
```

---

## PUT /api/numbers/[num]

Operaciones admin sobre un número específico. Según el query param `action`:

| action | Operación | Descripción |
|--------|-----------|-------------|
| *(ninguno)* | `confirm` | Confirmar pago: `reserved` → `sold` |
| `undo` | Deshacer confirmación: `sold` → `reserved` |
| `cancel` | Cancelar reserva: `reserved` → `available` |
| `rename` | Cambiar nombre del reservante: body `{ reservedBy }` |

- **Auth**: Sí — `token` en query param debe coincidir con `ADMIN_TOKEN`
- **Rate limit**: 10 requests por 60s por IP
- **CORS**: `access-control-allow-origin: *`

### Query params

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `token` | `string` | ✅ | Admin token para autorización |
| `action` | `string` | No | `undo`, `cancel`, `rename` — si se omite, confirma |

### Request body (solo `action=rename`)

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `reservedBy` | `string` | ✅ | Nuevo nombre |

### Respuestas

| Status | Descripción | Body |
|--------|-------------|------|
| `200` | Operación exitosa | `{ status, reservedBy, reservedAt, confirmedAt }` |
| `400` | Falta `reservedBy` en rename / JSON inválido | `{ "error": "..." }` |
| `401` | Token inválido o ausente | `{ "error": "Unauthorized" }` |
| `409` | Estado no válido para la operación (ej: confirmar no reservado) | `{ "error": "Number is not reserved" }` |
| `429` | Rate limit excedido | `{ "error": "Demasiadas solicitudes..." }` |

### Ejemplos

```bash
# Confirmar pago
curl -X PUT "https://rifa-solidaria.vercel.app/api/numbers/42?token=secreto"

# Cancelar reserva
curl -X PUT "https://rifa-solidaria.vercel.app/api/numbers/42?token=secreto&action=cancel"

# Renombrar
curl -X PUT "https://rifa-solidaria.vercel.app/api/numbers/42?token=secreto&action=rename" \
  -H "Content-Type: application/json" \
  -d '{"reservedBy": "Nuevo nombre"}'
```

---

## GET /api/admin/verify

Verificar si un token admin es válido contra el servidor.

- **Auth**: No (compara internamente con `ADMIN_TOKEN`)
- **Rate limit**: No
- **CORS**: `access-control-allow-origin: *`

### Query params

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `token` | `string` | No | Token a verificar |

### Respuestas

| Status | Descripción | Body |
|--------|-------------|------|
| `200` | Token válido | `{ "valid": true }` |
| `401` | Token inválido o ausente | `{ "valid": false, "error": "Token inválido" }` |

### Ejemplo

```bash
curl "https://rifa-solidaria.vercel.app/api/admin/verify?token=secreto"
```

```json
{ "valid": true }
```

---

## GET /api/export

Exportar todos los números a CSV.

- **Auth**: Sí — `token` en query param debe coincidir con `ADMIN_TOKEN`
- **Rate limit**: 5 requests por 60s por IP
- **CORS**: No aplica (response es CSV, no JSON)

### Query params

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `token` | `string` | ✅ | Admin token |

### Respuestas

| Status | Descripción | Headers |
|--------|-------------|---------|
| `200` | CSV de todos los números | `content-type: text/csv`, `content-disposition: attachment; filename="rifa-solidaria.csv"` |
| `401` | Token inválido | `{ "error": "Unauthorized" }` |
| `429` | Rate limit excedido | `{ "error": "Demasiadas solicitudes..." }` |

### Formato CSV

```csv
Numero,Estado,ReservadoPor,ReservadoEl,ConfirmadoEl
00,disponible,,
01,reservado,Juan,11/06/24 09:00,
02,vendido,María,10/06/24 08:00,11/06/24 09:00
```

### Ejemplo

```bash
curl "https://rifa-solidaria.vercel.app/api/export?token=secreto" --output rifa.csv
```

---

## GET /api/raffle-image

Generar imagen PNG de la rifa con estado de todos los números, premios y datos del sorteo. Usa Satori (JSX → SVG) + resvg-js (SVG → PNG).

- **Auth**: No
- **Rate limit**: No
- **CORS**: No aplica (response es PNG)

### Query params

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `refresh` | `string` | No | `refresh=1` fuerza regeneración (omite caché de Redis) |
| `debug` | `string` | No | `debug=svg` devuelve SVG en lugar de PNG |

### Caché

La imagen generada se cachea en Redis (`raffle:image:png`) con TTL de 3600s. Se invalida automáticamente con cada mutación (reserva, confirmación, cancelación, etc.).

### Respuestas

| Status | Descripción | Headers |
|--------|-------------|---------|
| `200` | PNG de 540×960 | `Content-Type: image/png`, `Cache-Control: public, max-age=3600` (o `no-cache` si `refresh=1`) |
| `200` | SVG (debug) | `Content-Type: image/svg+xml` |
| `500` | Error de generación (resvg no disponible, Satori error) | `{ "error": "...", "detail": "..." }` |

### Ejemplo

```bash
# Obtener PNG (puede devolver cache)
curl https://rifa-solidaria.vercel.app/api/raffle-image --output rifa.png

# Forzar regeneración
curl "https://rifa-solidaria.vercel.app/api/raffle-image?refresh=1" --output rifa.png

# Debug: ver SVG
curl "https://rifa-solidaria.vercel.app/api/raffle-image?debug=svg"
```

---

## Resumen de endpoints

| Método | URL | Auth | Rate Limit | CORS |
|--------|-----|------|------------|------|
| `GET` | `/api/config` | No | No | ✅ `*` |
| `GET` | `/api/numbers` | No | No | ✅ `*` |
| `POST` | `/api/numbers` | No (público) / adminToken | 10/min (público) | ✅ `*` |
| `PUT` | `/api/numbers/[num]` | token query param | 10/min | ✅ `*` |
| `GET` | `/api/admin/verify` | No (compara internamente) | No | ✅ `*` |
| `GET` | `/api/export` | token query param | 5/min | ❌ (CSV) |
| `GET` | `/api/raffle-image` | No | No | ❌ (PNG) |

---

## Checklist de verificación

- [ ] Todos los endpoints públicos devuelven `access-control-allow-origin: *`
- [ ] `POST /api/numbers` público tiene rate limit de 10/min por IP
- [ ] `PUT /api/numbers/[num]` tiene rate limit de 10/min por IP
- [ ] `GET /api/export` tiene rate limit de 5/min por IP
- [ ] Endpoints protegidos devuelven `401` con token inválido
- [ ] `POST /api/numbers` devuelve `400` si falta `num`
- [ ] `POST /api/numbers` (admin) devuelve `400` si falta `reservedBy`
- [ ] `PUT /api/numbers/[num]` devuelve `409` si el estado no permite la operación
- [ ] `GET /api/config` devuelve `404` si no hay configuración
- [ ] `GET /api/raffle-image` usa caché de Redis con TTL 3600s
