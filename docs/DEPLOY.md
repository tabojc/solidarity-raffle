# Deploy — Rifa Solidaria

Instrucciones de deploy y configuración del proyecto en Vercel. Arquitectura serverless con Next.js 16 App Router + Upstash Redis.

---

## Índice

- [Archivos de configuración](#archivos-de-configuración)
- [Variables de entorno](#variables-de-entorno)
- [Scripts](#scripts)
- [Preprocesamiento de hero image](#preprocesamiento-de-hero-image)
- [Dependencias nativas](#dependencias-nativas)
- [Deploy en Vercel](#deploy-en-vercel)
- [Checklist de verificación](#checklist-de-verificación)

---

## Archivos de configuración

### `vercel.json` (raíz del repo)

```json
{
  "framework": "nextjs"
}
```

Configuración mínima. Next.js 16 se auto-detecta. No necesita `buildCommand`, `installCommand` ni `outputDirectory` — Vercel usa defaults.

**Importante**: Este archivo está en la **raíz del repo** (`/rifa/vercel.json`), NO dentro de `app/`. El `rootDirectory` se configura en el dashboard de Vercel (ver [Deploy en Vercel](#deploy-en-vercel)).

### `next.config.ts` (`app/next.config.ts`)

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
```

`serverExternalPackages` evita que Next.js intente bundlear `@resvg/resvg-js` como parte del bundle del servidor. Es necesario porque resvg-js incluye binarios nativos (.node) que no pueden ser procesados por webpack/turbopack.

Se aplica únicamente a la route `GET /api/raffle-image` que usa Edge Runtime. Las demás routes usan Node.js serverless sin necesidad de esta configuración.

---

## Variables de entorno

### Variables secretas (Vercel Environment Variables — encrypted)

| Variable | Propósito | Origen |
|----------|-----------|--------|
| `KV_REST_API_URL` | URL del REST API de Upstash Redis | Vercel Storage |
| `KV_REST_API_TOKEN` | Token de escritura para Redis | Vercel Storage |
| `KV_REST_API_READ_ONLY_TOKEN` | Token de solo lectura (no usado actualmente) | Vercel Storage |
| `UPSTASH_REDIS_REST_URL` | Alias de `KV_REST_API_URL` (compatibilidad) | Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Alias de `KV_REST_API_TOKEN` (compatibilidad) | Upstash |
| `ADMIN_TOKEN` | Token secreto para acceso al panel admin | Manual |

Nota: Vercel KV (Upstash) asigna automáticamente las variables `KV_REST_API_*` al conectar un storage desde el dashboard. Las variables `UPSTASH_REDIS_REST_*` se usan como fallback.

### Variables públicas (prefijo `NEXT_PUBLIC_`)

| Variable | Default | Propósito |
|----------|---------|-----------|
| `NEXT_PUBLIC_GRID_ROWS` | `10` | Filas de la grilla (determina números: 00-99) |
| `NEXT_PUBLIC_RESERVE_TIMEOUT_HOURS` | `24` | Horas antes de que una reserva expire automáticamente |

Estas variables se exponen al cliente en build-time. Para cambiarlas hay que redeployar.

### Variables de seed (solo entorno local)

Definidas en `.env.local` para los scripts de seed. **No van en producción**:

```
RAFFLE_NAME="Rifa Solidaria"
BENEFICIARY_NAME="Nombre de la beneficiaria"
HERO_IMAGE_URL=""
PRIZE_FIRST_AMOUNT=600
PRIZE_SECOND_AMOUNT=400
TICKET_PRICE=20
DRAW_DATE="2026-07-26"
DRAW_TIME="22:30"
LOTTERY_NAME="Lotería Táchira A y B"
RESERVE_TIMEOUT_HOURS=24
```

### Template

Usar `.env.example` en la raíz del repo como referencia. Copiar a `app/.env.local`:

```bash
cp .env.example app/.env.local
```

Llenar las variables de Upstash (desde Vercel Dashboard → Storage o Upstash Console) y generar un `ADMIN_TOKEN` fuerte (mínimo 16 caracteres).

---

## Scripts

Todos los scripts se ejecutan desde `app/`:

```bash
cd app
```

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Preprocesa hero image + inicia servidor de desarrollo Next.js |
| `pnpm build` | Preprocesa hero image + build de producción Next.js |
| `pnpm start` | Inicia servidor de producción (requiere build previo) |
| `pnpm test` | Ejecuta tests con Vitest (modo run, sin watch) |
| `pnpm lint` | ESLint — verifica código |
| `pnpm seed:config` | Pobla Redis con configuración y 100 números (usa `.env.local`) |
| `pnpm seed:reset` | Como seed pero resetea datos existentes (`--reset`) |
| `pnpm seed:backup` | Exporta Redis a `backup-{fecha}.json` |
| `pnpm seed:restore` | Restaura Redis desde un archivo JSON |

### Seed inicial

Para poner en marcha una instancia nueva:

```bash
cd app
cp ../.env.example .env.local
# Editar .env.local con datos reales
pnpm install
pnpm seed:config    # Crea configuración y 100 números
pnpm dev            # Verificar que funciona
```

---

## Preprocesamiento de hero image

### `scripts/preprocess-hero.mjs`

Se ejecuta automáticamente antes de `dev` y `build` (definido en los scripts de `package.json`):

```json
"dev": "node scripts/preprocess-hero.mjs && next dev",
"build": "node scripts/preprocess-hero.mjs && next build",
```

### Qué hace

1. Lee `public/hero.webp` (imagen original del beneficiario)
2. Redimensiona a 200×200 (cover, centrado)
3. Aplica un mask circular con composición `dest-in` (fondo transparente)
4. Guarda como `public/hero-circular.png`

### Por qué

Satori (JSX → SVG) no soporta clip paths complejos ni decodificación de WebP. Al tener la imagen precortada en PNG con círculo y fondo transparente, la generación de la imagen de rifa puede componerla directamente en SVG sin depender de sharp en runtime.

### Dependencias

- **sharp** (`^0.35.1`) — procesamiento de imágenes en Node.js
- `@img/sharp-linux-x64` (`^0.35.1`) — binario nativo para Linux x64

Si `hero.webp` no existe, el script saltea silenciosamente (útil durante desarrollo inicial).

---

## Dependencias nativas

El proyecto usa dos bibliotecas con bindings nativos que requieren binarios específicos por plataforma:

### `@resvg/resvg-js` (producción)

- **Versión**: `^2.6.2`
- **Propósito**: Convertir SVG → PNG en la route `GET /api/raffle-image` (Edge Runtime)
- **Binarios** (en `package.json`):
  - `@resvg/resvg-js-linux-x64-gnu` — para Vercel (Linux x64)
  - `@resvg/resvg-js-linux-arm64-gnu` — para entornos ARM64
- **Config**: `serverExternalPackages: ["@resvg/resvg-js"]` en `next.config.ts`

> **Nota**: Vercel usa Linux x64. El binario ARM64 está incluido por si se migra a otra plataforma, no es necesario para el deploy actual.

### `sharp` (dev/build)

- **Versión**: `^0.35.1`
- **Propósito**: Preprocesamiento de hero image (solo build-time)
- **Binario**: `@img/sharp-linux-x64`
- **Runtime**: Solo se ejecuta en `scripts/preprocess-hero.mjs`, no en producción

---

## Deploy en Vercel

### Auto-deploy desde GitHub

1. Conectar el repositorio a Vercel (Vercel Dashboard → Add New → Project)
2. Importar repositorio desde GitHub
3. Configurar:

| Configuración | Valor |
|---------------|-------|
| **Framework Preset** | Next.js (auto-detectado de `vercel.json`) |
| **Root Directory** | `app` (el proyecto Next.js está en `app/`) |
| **Build Command** | `node scripts/preprocess-hero.mjs && next build` (default) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `pnpm install` (auto-detectado por `pnpm-lock.yaml`) |

4. Agregar **Environment Variables** (Production, Preview, Development):

   - `KV_REST_API_URL` — de Vercel Storage
   - `KV_REST_API_TOKEN` — de Vercel Storage
   - `ADMIN_TOKEN` — generar un token fuerte
   - `NEXT_PUBLIC_GRID_ROWS` = `10`
   - `NEXT_PUBLIC_RESERVE_TIMEOUT_HOURS` = `24`

5. **Conectar Vercel KV** (opcional, más simple):
   - Vercel Dashboard → Storage → Create KV Database
   - Se vinculan automáticamente las variables `KV_REST_API_*`

### Rama de deploy

- **Producción**: `main` (branch default)
- **Preview**: Cualquier branch que haga PR a `main`
- Cada push a `main` dispara un deploy automático

### Post-deploy

1. Verificar que el deploy fue exitoso (Vercel Dashboard → Deployments)
2. Ejecutar seed vía script remoto (o local contra producción):

   ```bash
   # Seed remoto (necesita las variables de producción en .env.local)
   KV_REST_API_URL=... KV_REST_API_TOKEN=... ADMIN_TOKEN=... pnpm seed:config
   ```

   O usar la consola de Upstash para verificar/insertar datos.

3. Verificar:
   - `GET https://dominio.vercel.app/api/config` → devuelve configuración
   - `GET https://dominio.vercel.app/api/numbers` → devuelve números
   - `GET https://dominio.vercel.app/admin?token=ADMIN_TOKEN` → panel funcional

---

## Checklist de verificación

- [ ] `vercel.json` existe en raíz del repo con `{ "framework": "nextjs" }`
- [ ] `next.config.ts` incluye `serverExternalPackages: ["@resvg/resvg-js"]`
- [ ] Variables de entorno configuradas en Vercel Dashboard (KV, ADMIN_TOKEN, NEXT_PUBLIC_*)
- [ ] `rootDirectory: "app"` configurado en el proyecto de Vercel
- [ ] `pnpm build` corre exitosamente en local
- [ ] `pnpm test` pasa (27 tests)
- [ ] Seed ejecutado contra producción después del deploy
- [ ] Endpoints públicos responden (`/api/config`, `/api/numbers`)
- [ ] Panel admin accesible con token (`/admin?token=...`)
- [ ] `hero.webp` existe en `public/` para el preprocesamiento
- [ ] Dependencias nativas instaladas (`@resvg/resvg-js-linux-x64-gnu`)

---

## Referencias

- [Arquitectura](./ARCHITECTURE.md) — stack, estructura, data flow
- [API Reference](./API.md) — endpoints, métodos, params
- [Data Model](./DATA-MODEL.md) — tipos, estados, Redis keys
