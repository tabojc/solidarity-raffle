# Testing — Rifa Solidaria

Configuración, cobertura y patrones de testing del proyecto. **7 archivos de test, 27 tests** corriendo con Vitest 4.1.8.

---

## Índice

- [Configuración](#configuración)
- [Cómo correr tests](#cómo-correr-tests)
- [Estructura de tests](#estructura-de-tests)
- [Patrón de mocks](#patrón-de-mocks)
- [Tipos de tests](#tipos-de-tests)
- [Archivos de test](#archivos-de-test)
- [Cobertura actual](#cobertura-actual)
- [Lo que NO está testeado](#lo-que-no-está-testeado)
- [Tests recientes: cancel.smoke.test.ts](#tests-recientes-cancelsmoketestts)
- [Checklist de verificación](#checklist-de-verificación)

---

## Configuración

### Vitest 4.1.8

Archivo: `app/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,          // describe, it, expect sin import
    environment: 'node',    // sin jsdom (no hay tests de componentes UI)
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // match tsconfig paths
    },
  },
})
```

| Opción | Valor | Propósito |
|--------|-------|-----------|
| `globals` | `true` | `describe`, `it`, `expect`, `vi` disponibles globalmente |
| `environment` | `node` | Entorno Node.js (no se necesita DOM) |
| `alias: @` | `./src` | Coincide con el alias de TypeScript |
| `setupFiles` | `[]` | Sin setup adicional |

### Dependencias

- **Vitest** `^4.1.8` (devDependency)
- **@vitejs/plugin-react** `^6.0.2` (necesario para que Vitest procese archivos JSX, aunque no hay tests de componentes)

---

## Cómo correr tests

```bash
# Desde app/
cd app

# Ejecutar todos los tests
pnpm test

# Con watch mode (desarrollo)
pnpm vitest

# Test específico
pnpm vitest run config.test.ts

# Smoke tests (más lentos, incluyen satori/resvg reales)
pnpm vitest run raffle-image.smoke.test.ts

# Unit tests rápidos (todos con KV mockeado)
pnpm vitest run config.test.ts numbers.test.ts confirm.test.ts export.test.ts raffle-image.test.ts cancel.smoke.test.ts
```

### CI / Build

Los tests se ejecutan como paso previo al build:

```bash
pnpm test && pnpm build
```

No hay step de CI formal (GitHub Actions) — el proyecto se deploya directamente desde Vercel.

---

## Estructura de tests

```
src/__tests__/
├── config.test.ts              # Unit — GET /api/config
├── numbers.test.ts             # Unit — GET + POST /api/numbers
├── confirm.test.ts             # Unit — PUT /api/numbers/[num]
├── export.test.ts              # Unit — GET /api/export
├── cancel.smoke.test.ts        # Smoke — PUT action=cancel
├── raffle-image.test.ts        # Unit — GET /api/raffle-image
└── raffle-image.smoke.test.ts  # Smoke — PNG real satori+resvg
```

### Convención de nombres

| Sufijo | Tipo | Propósito |
|--------|------|-----------|
| `.test.ts` | Unit | Tests con mocks, rápidos (< 1s cada uno) |
| `.smoke.test.ts` | Smoke | Tests con dependencias reales (satori, resvg), lentos (< 30s) |

No hay tests de integración que usen Redis real ni tests E2E.

---

## Patrón de mocks

### Mock de KV

Todos los tests mockean `@/lib/kv` usando `vi.mock()` al inicio del archivo:

```typescript
// Cada test define sus propias funciones mock
const mockGetConfig = vi.fn()
const mockGetAllNumbers = vi.fn()

vi.mock('@/lib/kv', () => ({
  getConfig: mockGetConfig,
  getAllNumbers: mockGetAllNumbers,
  reserveNumber: vi.fn(),
  adminReserveNumber: vi.fn(),
  confirmNumber: vi.fn(),
  undoConfirmNumber: vi.fn(),
  cancelReservation: vi.fn(),
  getNumber: vi.fn(),
  clearImageCache: vi.fn(),
  getImageCache: vi.fn(),
  setImageCache: vi.fn(),
}))
```

**Regla importante**: `vi.mock` se hoiste al tope del archivo. No se pueden tener dos `vi.mock` del mismo módulo en el mismo archivo — el segundo pisa al primero. Por eso cada archivo declara un mock único que incluye **todas** las funciones exportadas por `@/lib/kv`, aunque no se usen todas.

### Mock de dependencias externas

Para `raffle-image.test.ts` también se mockean:

- `satori` — retorna SVG mockeado
- `@resvg/resvg-js` — retorna PNG mockeado

```typescript
vi.mock('satori', () => ({
  default: vi.fn().mockResolvedValue('<svg>mocked</svg>'),
}))

vi.mock('@resvg/resvg-js', () => ({
  Resvg: vi.fn(function () {
    return {
      render: () => ({ asPng: () => Buffer.from('mocked-png') }),
    }
  }),
}))
```

### Smoke tests — mock parcial

Los smoke tests (`raffle-image.smoke.test.ts`) solo mockean KV (para cache). **No mockean satori ni resvg** — quieren probar la generación real de PNG.

### Patrón de setup

```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

beforeAll(() => {
  process.env.ADMIN_TOKEN = 'test-token'  // para tests que requieren auth
})

beforeEach(() => {
  vi.clearAllMocks()  // resetea todos los mocks entre tests
})
```

### Import dinámico de rutas

Los tests importan las API routes dinámicamente (`@/app/api/.../route`) para que los mocks estén activos cuando se ejecute el módulo:

```typescript
const { GET } = await import('@/app/api/config/route')
const response = await GET()
```

Esto es necesario porque Next.js App Router rutas son módulos regulares — se importan y ejecutan directamente.

---

## Tipos de tests

| Tipo | Archivos | Mocks | Velocidad | Qué verifican |
|------|----------|-------|-----------|---------------|
| **Unit** | 5 archivos | KV mockeado + dependencias mockeadas | < 50ms cada uno | Lógica de negocio, auth, respuestas HTTP |
| **Smoke** | 2 archivos | Solo KV (cache), satori/resvg real | < 30s cada uno | Generación real de PNG con Satori + resvg |

---

## Archivos de test

### `config.test.ts` — 2 tests

| Test | Verifica |
|------|----------|
| `returns raffle config as JSON` | `GET /api/config` → 200 con objeto `RaffleConfig` |
| `returns 404 if no config found` | `GET /api/config` → 404 si `getConfig()` retorna `null` |

### `numbers.test.ts` — 5 tests

| Test | Verifica |
|------|----------|
| `returns all numbers as JSON` | `GET /api/numbers` → 200 con `NumbersMap` |
| `includes CORS headers for public access` | Header `access-control-allow-origin: *` |
| `reserves an available number` | `POST /api/numbers` → 200 con objeto reservado |
| `returns 400 if num is missing` | `POST` sin `num` → 400 |
| `returns 409 if number is already reserved` | `POST` a número no disponible → 409 |

### `confirm.test.ts` — 6 tests

| Test | Verifica |
|------|----------|
| `confirms a reserved number with valid token` | Confirmación de pago → 200 |
| `returns 401 without token` | PUT sin `?token=` → 401 |
| `returns 401 with invalid token` | PUT con token incorrecto → 401 |
| `returns 409 if number is not reserved` | Confirmar número disponible → 409 |
| `undoes a sold number with action=undo` | `?action=undo` en vendido → 200 |
| `returns 409 if undoing an unreserved number` | `?action=undo` en no vendido → 409 |

### `export.test.ts` — 2 tests

| Test | Verifica |
|------|----------|
| `returns CSV with all numbers` | CSV con header + 3 filas, content-type, content-disposition |
| `returns 401 without valid token` | GET sin token → 401 |

### `cancel.smoke.test.ts` — 5 tests

| Test | Verifica |
|------|----------|
| `rechaza cancel sin token (401)` | PUT sin token → 401 |
| `rechaza cancel con token inválido (401)` | PUT con token incorrecto → 401 |
| `cancela un número reservado con token válido (200)` | Cancelación exitosa → 200 |
| `devuelve 409 si el número no está reservado` | Cancelar disponible → 409 |
| `no se confunde con action=confirm (sin action param)` | PUT sin action no llama a `cancelReservation` |

### `raffle-image.test.ts` — 5 tests

| Test | Verifica |
|------|----------|
| `returns cached PNG on cache hit` | Usa caché de Redis, no regenera |
| `generates fresh image on cache miss` | Sin caché → genera y guarda en Redis |
| `returns 500 if config is missing` | Sin configuración → 500 |
| `returns 500 on generation failure` | Error de Redis → 500 |
| `clearImageCache is exported from kv` | `clearImageCache` es función exportada |

### `raffle-image.smoke.test.ts` — 2 tests

| Test | Verifica |
|------|----------|
| `generates a real PNG with satori + resvg` | PNG válido (magic bytes), > 1KB, guarda a `.smoke-output/` |
| `generates image with hero compositing` | PNG con imagen hero compuesta, guarda a `.smoke-output/` |

---

## Cobertura actual

### Lo que SÍ está testeado

| Área | Tests | Cobertura |
|------|-------|-----------|
| `GET /api/config` | 2 | Config encontrada y no encontrada |
| `GET /api/numbers` | 2 | Respuesta correcta y CORS |
| `POST /api/numbers` (público) | 3 | Reserva exitosa, falta num, número ocupado |
| `PUT /api/numbers/[num]` (confirm) | 4 | Confirm, auth, 409 |
| `PUT /api/numbers/[num]` (undo) | 2 | Undo exitoso, 409 |
| `PUT /api/numbers/[num]` (cancel) | 5 | Sin token, token inválido, cancel exitoso, 409, no confusión con confirm |
| `GET /api/export` | 2 | CSV correcto, 401 |
| `GET /api/raffle-image` | 5 | Cache hit/miss, 500 config, 500 error, clearImageCache export |
| Satori + resvg reales | 2 | PNG válido, PNG con hero |

### Lo que NO está testeado

| Área | Archivos | Por qué no está testeado |
|------|----------|--------------------------|
| **Componentes UI** | Hero, NumberGrid, ReserveModal, AdminPage | No hay jsdom ni React Testing Library configurados. Los componentes son puramente presentacionales con estado interno. |
| **Client API** (`lib/api.ts`) | `api.ts` | Wrappers de fetch. No hay tests que verifiquen construcción de URLs, headers, o manejo de errores HTTP. |
| **Rate limiter** (`lib/rate-limit.ts`) | `rate-limit.ts` | Lógica in-memory con Map. No hay tests de límite de requests, ventana de tiempo, o reset. |
| **Timeout expiration** | Lazy expiration en `kv.ts` | La lógica que revierte reservas expiradas (en `getAllNumbers`/`getNumber`) no tiene tests específicos. |
| **Admin reserve** | `POST /api/numbers` (admin) | No hay tests que verifiquen el flujo admin (con `adminToken` en body). |
| **Rename** | `PUT /api/numbers/[num]?action=rename` | No hay tests para renombrar números. |
| **E2E** | — | No hay tests end-to-end con navegador o Redis real. |

### Áreas con tests pero cobertura parcial

- `POST /api/numbers` — solo se testea modo público, no modo admin
- `cancel.smoke.test.ts` — buena cobertura de casos pero usa KV mockeado (no prueba la lógica real de `kv.cancelReservation()`)
- `raffle-image.test.ts` — mockea satori/resvg, la ruta real se prueba en smoke test

---

## Tests recientes: cancel.smoke.test.ts

### Por qué se agregó

Durante el desarrollo del ciclo SDD "001: Complete SDD Cycle" se identificaron problemas en el flujo de cancelación. Se agregó `cancel.smoke.test.ts` para cubrir específicamente:

1. **Auth en cancel**: Verificar que la cancelación requiere token válido
2. **Estado correcto**: Solo números `reserved` pueden cancelarse
3. **No colisión con confirm**: PUT sin `action` no debe llamar a `cancelReservation` aunque reciba `action=cancel`

### Patrón usado

El test usa el mismo mock factory que los demás tests pero mockea **específicamente** `cancelReservation` y `confirmNumber` para verificar que cada acción llama a la función correcta.

```typescript
const mockCancelReservation = vi.fn()
const mockConfirmNumber = vi.fn()

vi.mock('@/lib/kv', () => ({
  cancelReservation: mockCancelReservation,
  confirmNumber: mockConfirmNumber,
  // ... resto de funciones mockeadas
}))
```

### Casos cubiertos

| Escenario | Resultado Esperado |
|-----------|-------------------|
| Cancelar sin token | 401, no llama a `cancelReservation` |
| Cancelar con token inválido | 401, no llama a `cancelReservation` |
| Cancelar número reservado con token válido | 200, llama a `cancelReservation("01")` |
| Cancelar número no reservado | 409, llama a `cancelReservation("00")` |
| PUT sin action (confirm) no se confunde | 200, no llama a `cancelReservation`, sí a `confirmNumber` |

---

## Checklist de verificación

- [ ] `pnpm test` pasa (27 tests, 0 failures)
- [ ] `vitest.config.ts` tiene `globals: true`, `environment: node`, alias `@`
- [ ] Todos los tests mockean `@/lib/kv` con `vi.mock()` factory
- [ ] Los smoke tests generan PNG real y lo guardan a `.smoke-output/`
- [ ] Cada test usa `beforeEach(() => vi.clearAllMocks())`
- [ ] Tests de auth usan `beforeAll(() => process.env.ADMIN_TOKEN = ...)`
- [ ] Los imports de API routes son dinámicos (`await import(...)`)
- [ ] No hay tests de componentes UI, rate-limit, client API ni E2E (documentado)

---

## Referencias

- [Arquitectura](./ARCHITECTURE.md) — stack, estructura del proyecto
- [API Reference](./API.md) — endpoints testeados
- [Data Model](./DATA-MODEL.md) — tipos usados en tests
