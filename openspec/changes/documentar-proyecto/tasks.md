# Tasks: Documentación Técnica del Proyecto

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800–1000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: ARCHITECTURE.md + DATA-MODEL.md → PR 2: API.md + AUTH.md → PR 3: DEPLOY.md + COMPONENTS.md + TESTING.md |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Architecture + Data Model | PR 1 → main | Foundation docs, sin dependencias externas |
| 2 | API + Auth | PR 2 → main | Construye sobre conceptos de Unit 1 |
| 3 | Deploy + Components + Testing | PR 3 → main | Documentación operativa y de tests |

## Phase 1: Foundation Docs

- [x] 1.1 Crear `docs/ARCHITECTURE.md` — stack, estructura de directorios, data flow, patrón polling, routing
- [x] 1.2 Crear `docs/DATA-MODEL.md` — tipos `RaffleNumber`/`RaffleConfig`, 3 estados, Redis keys, transiciones atómicas, lazy expiration

## Phase 2: API & Auth Docs

- [x] 2.1 Crear `docs/API.md` — 7 endpoints con métodos, params, auth, rate limits, CORS, respuestas
- [x] 2.2 Crear `docs/AUTH.md` — flujo admin auth (URL token + formulario + localStorage), bug de token inválido, fix de verify endpoint y formatError

## Phase 3: Deploy & Components Docs

- [x] 3.1 Crear `docs/DEPLOY.md` — `vercel.json`, `next.config.ts`, env vars (secretas y públicas), build commands, scripts, preprocesamiento hero
- [x] 3.2 Crear `docs/COMPONENTS.md` — Hero, NumberGrid (+NumberCell), ReserveModal, AdminPage con props, estados, responsabilidades

## Phase 4: Testing Docs

- [x] 4.1 Crear `docs/TESTING.md` — Vitest 4.1.8, patrón smoke tests + unit, mocks de KV, cobertura actual, qué no está testeado, cómo correr tests

## Phase 5: Verification

- [x] 5.1 Ejecutar `pnpm test` en `app/` y verificar que los 7 test files pasan (sin regresiones)
- [x] 5.2 Ejecutar `pnpm build` y verificar build exitoso
