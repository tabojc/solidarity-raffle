# Arquitectura de Rifa Solidaria

App web serverless para venta de números de rifa benéfica. Next.js 16 App Router, React 19, Redis (Vercel KV), polling 5s como mecanismo de tiempo real.

---

## Tabla de contenidos

- [Stack técnico](#stack-técnico)
- [Estructura de directorios](#estructura-de-directorios)
- [Data flow](#data-flow)
- [Routing](#routing)
- [Componentes principales](#componentes-principales)
- [Admin auth](#admin-auth)
- [Hosting y runtime](#hosting-y-runtime)

---

## Stack técnico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Framework | Next.js 16 (App Router) | SSR, API routes serverless, Vercel-native |
| UI | React 19 | Componentes cliente con estado y efectos |
| Estilos | Tailwind CSS 4 | Utilidades, diseño responsive mobile-first |
| Lenguaje | TypeScript strict | Tipado y seguridad en compilación |
| Persistencia | Vercel KV (Upstash Redis) | Fuente única de verdad — 3 keys |
| Testing | Vitest 4.1.8 | Unit + smoke tests con mocks de KV |
| Imagen de rifa | Satori 0.26 + resvg-js 2.6 | JSX → SVG → PNG para compartir |
| Hosting | Vercel (free tier) | Serverless functions, auto-deploy desde GitHub |

---

## Estructura de directorios

```
rifa/
├── app/                                     # Aplicación Next.js
│   ├── public/
│   │   ├── fonts/                           # Inter Regular/Bold para Satori
│   │   │   ├── Inter-Regular.ttf
│   │   │   └── Inter-Bold.ttf
│   │   ├── hero.webp                        # Imagen hero original
│   │   └── hero-circular.png                # Pre-procesada (círculo 200×200)
│   ├── scripts/
│   │   ├── seed.ts                          # Poblar Redis con 100 números + config
│   │   ├── backup.ts                        # Backup de Redis a JSON local
│   │   ├── restore.ts                       # Restaurar desde JSON a Redis
│   │   └── preprocess-hero.mjs              # Recortar hero a círculo
│   ├── src/
│   │   ├── app/                             # App Router
│   │   │   ├── layout.tsx                   # Root layout (Geist fonts, CSS)
│   │   │   ├── page.tsx                     # Home pública (client component)
│   │   │   ├── globals.css                  # Tailwind + variables de tema
│   │   │   ├── global-error.tsx             # Error boundary global
│   │   │   ├── admin/
│   │   │   │   └── page.tsx                 # Admin panel (659 líneas, self-contained)
│   │   │   └── api/
│   │   │       ├── config/route.ts          # GET /api/config
│   │   │       ├── numbers/route.ts         # GET + POST /api/numbers
│   │   │       ├── numbers/[num]/route.ts   # PUT /api/numbers/[num]
│   │   │       ├── admin/verify/route.ts    # GET /api/admin/verify
│   │   │       ├── export/route.ts          # GET /api/export
│   │   │       └── raffle-image/route.tsx   # GET /api/raffle-image
│   │   ├── components/
│   │   │   ├── Hero.tsx                     # Cabecera pública
│   │   │   ├── NumberGrid.tsx               # Grilla 10×10 con NumberCell
│   │   │   └── ReserveModal.tsx             # Modal de reserva pública
│   │   ├── lib/
│   │   │   ├── types.ts                     # RaffleNumber, RaffleConfig, NumbersMap
│   │   │   ├── kv.ts                        # Capa de acceso a Redis (232 líneas)
│   │   │   ├── api.ts                       # Cliente HTTP (fetch wrappers)
│   │   │   └── rate-limit.ts                # Rate limiter in-memory
│   │   └── __tests__/                       # 7 archivos de test
│   │       ├── config.test.ts
│   │       ├── numbers.test.ts
│   │       ├── confirm.test.ts
│   │       ├── export.test.ts
│   │       ├── cancel.smoke.test.ts
│   │       ├── raffle-image.test.ts
│   │       └── raffle-image.smoke.test.ts
│   ├── next.config.ts                       # serverExternalPackages para resvg
│   ├── vitest.config.ts                     # Alias @ → ./src, globals
│   └── package.json                         # Scripts dev, build, test, seed
├── vercel.json                              # { "framework": "nextjs" }
├── openspec/                                # SDD artifacts (specs, designs, tasks)
├── docs/                                    # Documentación técnica
└── .env.example                             # Template de variables de entorno
```

---

## Data flow

### Patrón general

El 100% de las páginas son **client components** (`"use client"`). No hay Server Components con datos. El modelo es SPA clásico:

```
Navegador (React Client Components)
  │
  ├── fetch("/api/numbers")        GET  → lib/kv.ts → Upstash Redis
  ├── fetch("/api/config")         GET  → lib/kv.ts → Upstash Redis
  ├── fetch("/api/numbers", POST)  POST → lib/kv.ts → Upstash Redis (Lua)
  ├── fetch("/api/numbers/X", PUT) PUT  → lib/kv.ts → Upstash Redis
  ├── fetch("/api/admin/verify")   GET  → AdminToken check
  ├── fetch("/api/export")         GET  → lib/kv.ts → CSV
  └── fetch("/api/raffle-image")   GET  → Satori + resvg → PNG
```

Redis es la **única fuente de verdad**. No hay caché en el servidor ni en el cliente (salvo la imagen PNG cacheada en Redis con TTL 3600s).

### Polling (tiempo real)

- Intervalo fijo de **5 segundos** en ambas páginas
- En la home pública: el polling se **pausa** mientras el modal de reserva está abierto
- En el admin: polling siempre activo desde el mount del componente
- No hay WebSocket, ni Server-Sent Events, ni SWR/TanStack Query — deliberadamente simple

### Invalidación de caché de imagen

Cada mutación sobre los números (`reserveNumber`, `adminReserveNumber`, `confirmNumber`, `undoConfirmNumber`, `cancelReservation`, `renameNumber`) llama a `clearImageCache()` que ejecuta `DEL raffle:image:png`. Así la próxima请求 regenera la imagen con datos frescos.

```
flow TB
  A[Mutación: reserve / confirm / cancel / undo / rename]
  A --> B[actualizar estado en Redis HSET]
  A --> C[DEL raffle:image:png]
  C --> D[próximo GET /api/raffle-image regenera PNG]
```

---

## Routing

### App Router — 2 páginas + 6 API routes

| Ruta | Tipo | Archivo | Propósito |
|------|------|---------|-----------|
| `/` | Page | `src/app/page.tsx` | Home pública — grilla de números |
| `/admin` | Page | `src/app/admin/page.tsx` | Panel admin con auth |
| `GET /api/config` | Route | `api/config/route.ts` | Obtener configuración |
| `GET /api/numbers` | Route | `api/numbers/route.ts` | Obtener todos los números |
| `POST /api/numbers` | Route | `api/numbers/route.ts` | Reservar número (público o admin) |
| `PUT /api/numbers/[num]` | Route | `api/numbers/[num]/route.ts` | Confirmar/deshacer/cancelar/renombrar |
| `GET /api/admin/verify` | Route | `api/admin/verify/route.ts` | Verificar token admin |
| `GET /api/export` | Route | `api/export/route.ts` | Exportar CSV |
| `GET /api/raffle-image` | Route | `api/raffle-image/route.tsx` | Generar PNG de la rifa |

### Consideraciones de runtime

| Ruta | Runtime | Nota |
|------|---------|------|
| `GET /api/raffle-image` | **Edge** | Usa Satori (JSX→SVG) + resvg (SVG→PNG). Necesita `serverExternalPackages` en next.config |
| Todas las demás | Node.js (serverless) | Runtime por defecto |

La route de imagen usa Edge Runtime porque Satori + resvg requieren capacidades de buffer nativas. `next.config.ts` declara `serverExternalPackages: ["@resvg/resvg-js"]` para evitar que Next.js intente bundlear el módulo nativo de resvg.

---

## Componentes principales

| Componente | Archivo | Props | Responsabilidad |
|-----------|---------|-------|-----------------|
| `Hero` | `components/Hero.tsx` | `config: RaffleConfig \| null` | Cabecera con foto, nombre, premios, fecha |
| `NumberGrid` | `components/NumberGrid.tsx` | `numbers: NumbersMap, onSelect: (num) => void` | Grilla 10×10 con NumberCell interno |
| `NumberCell` | (interno en NumberGrid) | `num, data, onSelect` | Botón individual con estilo por estado |
| `ReserveModal` | `components/ReserveModal.tsx` | `num, config, onClose, onSuccess` | Modal de reserva pública |
| `AdminPage` | `app/admin/page.tsx` | Ninguna (self-contained) | Panel admin completo (659 líneas) |

---

## Admin auth

### Mecanismo

- **Token compartido** (`ADMIN_TOKEN` en variables de entorno)
- No hay registro de usuarios, ni sesiones, ni JWTs
- Dos formas de ingresar:
  1. **URL**: `/admin?token=SECRETO` — útil para compartir link con vendedores
  2. **Formulario**: Ingreso manual de clave en `/admin`
- El token se persiste en `localStorage` bajo key `admin_token`
- Al cargar `/admin`, el componente verifica ambas fuentes (URL > localStorage)
- Si viene por URL, guarda en localStorage y limpia la URL con `replaceState`
- El botón **Salir** elimina `localStorage` y muestra el formulario de login

### Endpoint de verificación

`GET /api/admin/verify?token=X` — público, sin rate limit. Devuelve `{ valid: true }` (200) o `{ valid: false }` (401). Usado exclusivamente desde el cliente.

### Patrón de autorización en API routes

Tres endpoints protegidos (`PUT /api/numbers/[num]`, `POST /api/numbers` [admin], `GET /api/export`) usan el mismo patrón:

```typescript
function isAuthorized(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  return token === process.env.ADMIN_TOKEN
}
```

### Rate limiting

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| `POST /api/numbers` (público) | 10 req | 60s |
| `PUT /api/numbers/[num]` | 10 req | 60s |
| `GET /api/export` | 5 req | 60s |

El rate limiter es **in-memory** (Map en `rate-limit.ts`), se reinicia con cada deploy/serverless cold start. Suficiente para este volumen.

---

## Hosting y runtime

### Vercel (free tier)

- `vercel.json`: mínimo — solo `{ "framework": "nextjs" }`
- Cada API route corre como **serverless function** independiente
- La route `/api/raffle-image` usa **Edge Runtime** (Satori + resvg)
- No hay `@vercel/speed-insights` ni `@vercel/analytics` instalados

### Variables de entorno

| Variable | Propósito | Secreta |
|----------|-----------|---------|
| `UPSTASH_REDIS_REST_URL` | URL de Upstash Redis | ✅ |
| `UPSTASH_REDIS_REST_TOKEN` | Token de escritura Redis | ✅ |
| `ADMIN_TOKEN` | Token secreto para admin | ✅ |
| `NEXT_PUBLIC_GRID_ROWS` | Filas de grilla (default: 10) | ❌ |
| `NEXT_PUBLIC_RESERVE_TIMEOUT_HOURS` | Timeout en horas (default: 24) | ❌ |

### Scripts de build

```bash
cd app
pnpm dev        # preprocess-hero.mjs → next dev
pnpm build      # preprocess-hero.mjs → next build
pnpm test       # vitest run
```

El script `preprocess-hero.mjs` se ejecuta siempre antes de dev/build. Genera `public/hero-circular.png` (200×200, círculo con fondo transparente) a partir de la imagen hero original para que Satori pueda componerla sin clip paths.

---

## Referencias

- [Data Model](./DATA-MODEL.md) — tipos, estados, Redis keys, transiciones
- [API Reference](./API.md) — endpoints, métodos, params, auth
- [Auth Flow](./AUTH.md) — flujo completo de autenticación admin
