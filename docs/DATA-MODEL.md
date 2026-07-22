# Modelo de Datos — Rifa Solidaria

El modelo de datos es simple deliberadamente: 100 números con 3 estados, una configuración y una caché de imagen. Todo vive en Redis (Vercel KV), que es la única fuente de verdad.

---

## Tabla de contenidos

- [Tipos](#tipos)
  - [RaffleNumber](#rafflenumber)
  - [NumbersMap](#numbersmap)
  - [RaffleConfig](#raffleconfig)
- [Redis keys](#redis-keys)
- [Transiciones de estado](#transiciones-de-estado)
- [Operaciones atómicas](#operaciones-atómicas)
- [Lazy expiration](#lazy-expiration)
- [Caché de imagen](#caché-de-imagen)

---

## Tipos

### RaffleNumber

```typescript
interface RaffleNumber {
  status: 'available' | 'reserved' | 'sold'
  reservedBy: string | null      // Nombre o "Nombre - Teléfono"
  reservedAt: number | null      // Timestamp UNIX en milisegundos
  confirmedAt: number | null     // Timestamp UNIX (solo cuando status='sold')
  note?: string | null           // Opcional, actualmente sin uso
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | `'available' \| 'reserved' \| 'sold'` | Estado actual del número |
| `reservedBy` | `string \| null` | Nombre del comprador, o `"Nombre - Teléfono"` si se ingresó teléfono |
| `reservedAt` | `number \| null` | Timestamp ms de la reserva (usado para lazy expiration) |
| `confirmedAt` | `number \| null` | Timestamp ms de la confirmación de pago |
| `note` | `string \| null` (opcional) | Nota adicional — definido pero no usado actualmente |

### NumbersMap

```typescript
type NumbersMap = Record<string, RaffleNumber>
```

Mapa de 100 entradas con keys `"00"` a `"99"`. Cada key es un string de 2 dígitos con zero-pad.

### RaffleConfig

```typescript
interface RaffleConfig {
  name: string                    // "Rifa Solidaria"
  beneficiary: string             // Nombre de la beneficiaria
  heroImageUrl: string            // "/hero.webp"
  prizes: { position: number; amount: number }[]
  ticketPrice: number             // Precio en USD (ej: 20)
  drawDate: string                // "2026-07-26"
  drawTime: string                // "22:30"
  lottery: string                 // "Lotería Táchira A y B"
  reserveTimeoutHours: number     // 24
}
```

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `name` | `string` | `"Rifa Solidaria"` | Nombre de la rifa |
| `beneficiary` | `string` | `"Yudith Ortega"` | Beneficiaria |
| `heroImageUrl` | `string` | `"/hero.webp"` | Ruta relativa a `public/` |
| `prizes` | `array` | `[{ position: 1, amount: 600 }, ...]` | Lista de premios (posición y monto) |
| `ticketPrice` | `number` | `20` | Precio por número en USD |
| `drawDate` | `string` | `"2026-07-26"` | Fecha del sorteo (formato ISO) |
| `drawTime` | `string` | `"22:30"` | Hora del sorteo |
| `lottery` | `string` | `"Lotería Táchira A y B"` | Nombre de la lotería |
| `reserveTimeoutHours` | `number` | `24` | Timeout para liberar reservas no pagadas |

---

## Redis keys

| Key | Tipo | Tamaño | TTL | Propósito |
|-----|------|--------|-----|-----------|
| `raffle:numbers` | Hash | 100 fields | ∞ | Estado de cada número (00–99) |
| `raffle:config` | Hash | ~10 fields | ∞ | Configuración de la rifa |
| `raffle:image:png` | String | ~200 KB | 3600s (1h) | Caché de imagen PNG en base64 |

### Constantes en código (`lib/kv.ts`)

```typescript
const NUMBERS_KEY = 'raffle:numbers'
const CONFIG_KEY = 'raffle:config'
const IMAGE_CACHE_KEY = 'raffle:image:png'
```

### Formato de valores en Hash

Cada field de `raffle:numbers` es un JSON string de `RaffleNumber`:

```
HSET raffle:numbers "42" "{\"status\":\"reserved\",\"reservedBy\":\"María\",\"reservedAt\":1718100000000,\"confirmedAt\":null}"
HLEN raffle:numbers → 100 (siempre, al hacer seed)
```

`raffle:config` también es un Hash, donde cada field es una propiedad de `RaffleConfig`:

```
HSET raffle:config name "Rifa Solidaria" beneficiary "Yudith" prizes "..." ticketPrice 20 ...
```

---

## Transiciones de estado

### Diagrama

```
available ──────→ reserved ──────→ sold
   ↑                  │
   └──────────────────┘
     cancel / timeout
```

### Matriz de transiciones

| Desde | Hasta | Operación | Quién | Atómica | Invalida caché |
|-------|-------|-----------|-------|---------|----------------|
| `available` | `reserved` | `reserveNumber()` | Público | ✅ (Lua) | ✅ |
| `available` | `reserved` | `adminReserveNumber()` | Admin | ❌ (HSET) | ✅ |
| `reserved` | `sold` | `confirmNumber()` | Admin | ❌ (HGET+HSET) | ✅ |
| `sold` | `reserved` | `undoConfirmNumber()` | Admin | ❌ (HGET+HSET) | ✅ |
| `reserved` | `available` | `cancelReservation()` | Admin | ❌ (HGET+HSET) | ✅ |
| `reserved` | `available` | Lazy expiration | Sistema | ✅ (en getAllNumbers) | ❌ |
| `reserved` / `sold` | — | `renameNumber()` | Admin | ❌ (HGET+HSET) | ✅ |

### Detalle de cada operación

#### reserveNumber (pública) — atómica con Lua

Usa **Lua script** (`RESERVE_SCRIPT`) que ejecuta en el servidor Redis:

```lua
local raw = redis.call("HGET", KEYS[1], ARGV[1])
if not raw then return 0 end
local data = cjson.decode(raw)
if data["status"] ~= "available" then return 0 end
data["status"] = "reserved"
data["reservedBy"] = ARGV[2]
data["reservedAt"] = tonumber(ARGV[3])
data["confirmedAt"] = cjson.null
data["note"] = cjson.null
redis.call("HSET", KEYS[1], ARGV[1], cjson.encode(data))
return 1
```

Si el script retorna `1`, la reserva fue exitosa. Si retorna `0` (número no disponible o inexistente), la API responde `409 Conflict`.

#### adminReserveNumber — directo (confía en admin)

Lee con `HGET`, verifica **solo si existe** (no verifica estado), escribe con `HSET`. El admin puede sobre-escribir cualquier número.

#### confirmNumber, undoConfirmNumber, cancelReservation, renameNumber

Todas siguen el mismo patrón:

1. `HGET raffle:numbers {num}` → obtiene estado actual
2. Verifica precondición (status específico según operación)
3. Si falla precondición → retorna `null` → API responde `409 Conflict`
4. `HSET raffle:numbers {num}` con nuevo estado
5. `DEL raffle:image:png` (clearImageCache)
6. Retorna el `RaffleNumber` actualizado

---

## Operaciones atómicas

| Operación | Atomicidad real | Riesgo de race condition |
|-----------|-----------------|-------------------------|
| `reserveNumber()` | ✅ Lua script en Redis | Ninguno — Redis es single-threaded |
| `adminReserveNumber()` | ❌ Read + Write separados | Bajo (solo admin, no hay concurrencia real) |
| `confirmNumber()` | ❌ Read + Write separados | Bajo (solo admin opera sobre reserved) |
| `cancelReservation()` | ❌ Read + Write separados | Bajo (índemne — el peor caso es 409) |
| `renameNumber()` | ❌ Read + Write separados | Bajo (solo cambia nombre) |

La reserva pública es la única operación con concurrencia real (múltiples usuarios pueden clickear el mismo número). Por eso usa Lua script. Las operaciones de admin son seriales por naturaleza (una persona o unas pocas).

---

## Lazy expiration

### Cómo funciona

Las reservas no pagadas expiran automáticamente después de `reserveTimeoutHours` (configurable en `RaffleConfig.reserveTimeoutHours`, default 24h).

La expiración es **lazy** (no hay cron, ni TTL de Redis, ni background job). Se verifica en cada lectura:

1. **`getAllNumbers()`**: itera todos los números, y si alguno está `reserved` con `reservedAt + timeout < Date.now()`, lo revierte a `available` y persiste el cambio
2. **`getNumber(num)`**: igual pero para un solo número

### Código relevante

```typescript
function isExpired(data: RaffleNumber, timeoutMs: number): boolean {
  if (data.status !== "reserved" || !data.reservedAt) return false
  return Date.now() - data.reservedAt > timeoutMs
}
```

### Flujo

```
Llamada a getAllNumbers() o getNumber()
  → getTimeoutMs() → HGETALL raffle:config → obtiene reserveTimeoutHours
  → Itera números → isExpired() chequea cada reserved
  → Si expiró: revierte a available + HSET
  → Retorna datos actualizados
```

### Consideraciones

- **Precisión**: La expiración ocurre dentro de los 5s posteriores al timeout (por el intervalo de polling)
- **Costo**: En cada `getAllNumbers()` se hace `HGETALL raffle:config` para obtener el timeout. Esto son 2 llamadas a Redis por cada lectura.
- **No hay TTL en Redis**: No se usa `EXPIRE` en los fields del hash porque Redis no soporta TTL por field dentro de un hash.

---

## Caché de imagen

### Key

`raffle:image:png` — String con contenido PNG en base64.

### TTL

3600 segundos (1 hora). Se setea con `SET raffle:image:png {base64} EX 3600`.

### Invalidación

Cada mutación (reserve, confirm, cancel, undo, rename) llama a `clearImageCache()` que ejecuta `DEL raffle:image:png`. Así la próxima请求 a `GET /api/raffle-image` regenera la imagen.

### Flujo de regeneración

```
GET /api/raffle-image
  → ¿Hay ?refresh=1? → sí: saltea caché
  → ¿Hay raffle:image:png? → sí: retorna directamente (cache hit)
  → NO: getAllNumbers() + getConfig()
  → Satori (JSX→SVG) + resvg (SVG→PNG)
  → SET raffle:image:png {base64} EX 3600
  → Retorna PNG binario
```

### ¿Por qué no se invalida en lazy expiration?

Porque la lazy expiration ocurre durante `getAllNumbers()` / `getNumber()`, que son **lecturas**. Si un número expira, la imagen queda desactualizada hasta la próxima mutación o hasta que venza el TTL de 1h. Es un tradeoff aceptable: la expiración silenciosa de una reserva es poco frecuente y la imagen se regenera sola en menos de 1h.

---

## Referencias

- [Arquitectura](./ARCHITECTURE.md) — stack, estructura, data flow general
- [API Reference](./API.md) — endpoints y payloads
- [Redis Lua scripting](https://redis.io/docs/latest/develop/interact/programmability/lua-api/)
