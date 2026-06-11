# PRD — Rifa Solidaria

## Problem Statement

La beneficiaria necesita realizarse una operación ocular y está organizando una rifa solidaria para recaudar fondos. Actualmente el proceso de venta de números es manual (por WhatsApp, planillas, mensajes), lo cual genera:

- Confusión sobre qué números están disponibles/vendidos/reservados
- Doble venta de números
- Falta de visibilidad en tiempo real para los compradores
- Trabajo manual redundante para confirmar pagos

**Objetivo**: Construir una aplicación web que automatice el proceso de venta de números de rifa, permitiendo que múltiples vendedores trabajen simultáneamente y que el público vea el estado real de los números.

---

## Users & Roles

### 1. Público General (Compradores)
- **Qué ve**: Grid de números 00-99 con colores según estado
- **Qué puede hacer**: Hacer clic en un número disponible para reservarlo
- **Qué NO puede hacer**: Confirmar pagos, cambiar estados, ver información de otros compradores
- **Acceso**: Link directo (WhatsApp)

### 2. Vendedores (Múltiples personas)
- **Qué ven**: Panel de control con todos los números y estados
- **Qué pueden hacer**: Confirmar pagos (marcar como "vendido"), ver quién reservó
- **Qué NO pueden hacer**: Crear rifas, eliminar números, acceder a datos de otros vendedores
- **Acceso**: Link secreto con token

### 3. Admin/Beneficiaria
- **Qué ve**: Todo — panel completo + estadísticas + CSV export
- **Qué puede hacer**: Todo lo que los vendedores + exportar datos + ver resumen
- **Acceso**: Link secreto con token (mismo panel que vendedores, con extras)

---

## Core Features

### F1: Grid de Números (Público)
- Grid 10x10 con números del 00 al 99
- Colores según estado:
  - **Disponible**: Fondo claro, texto oscuro
  - **Reservado**: Fondo/rosa diferente (indicar pendiente de pago)
  - **Vendido**: Fondo confirmado (diferente al reservado)
- Click en disponible → Reserva el número
- Feedback visual inmediato

### F2: Reserva de Números
- Cualquier visitante puede hacer clic en un número disponible
- El número pasa a estado "reservado"
- Se muestra nombre/contacto del reservante (opcional)
- Timeout configurable: si no se confirma en X horas, vuelve a disponible

### F3: Panel de Control (Vendedores/Admin)
- Lista de números con filtros por estado
- Botón "Confirmar pago" para números reservados
- Información de quién reservó y cuándo
- Acceso via link secreto (sin login)

### F4: CSV Export
- Botón para descargar estado completo de la rifa
- Formato: Numero, Estado, ReservadoPor, ReservadoEl, ConfirmadoEl
- Actualización en tiempo real del archivo

### F5: Actualización en Tiempo Real
- Polling cada 5 segundos para sincronizar estado
- Sin WebSocket (complejidad innecesaria para este caso de uso)
- Cuando un número cambia de estado, todos los usuarios ven el cambio en la próxima consulta

---

## Business Rules

### Flujo de Estados

```
DISPONIBLE → RESERVADO → VENDIDO (confirmado)
    ↑            ↓
    └────────────── (timeout sin pago → vuelve a disponible)
```

### Reglas de Transición

| Desde | Hasta | Quién puede | Condición |
|-------|-------|-------------|-----------|
| Disponible | Reservado | Cualquier visitante | Click en el número |
| Reservado | Disponble | Sistema | Timeout sin confirmación |
| Reservado | Vendido | Vendedor/Admin | Confirmación de pago |
| Vendido | — | Nadie | Estado final, no reversible |

### Reglas de Visualización

| Estado | Color público | Color admin | ¿Se puede clickear? |
|--------|---------------|-------------|---------------------|
| Disponible | Claro | Claro | Sí |
| Reservado | Rosa/distinto | Rosa + info | No (solo admin puede confirmar) |
| Vendido | Confirmado | Confirmado + info | No |

### Validaciones

- Un número no puede ser reservado si ya está reservado o vendido
- Un número no puede ser vendido si no está reservado primero
- El timeout de reserva es configurable (default: 24 horas)
- El CSV refleja el estado actual al momento de la descarga

---

## Technical Decisions

### Stack

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| Frontend | Next.js App Router | Vercel nativo, SSR, API routes |
| Backend | Vercel API Routes | Serverless, sin servidor que mantener |
| Persistencia | Vercel KV (Redis) | Gratis, suficiente para 100 números, mismo proveedor |
| Real-time | Polling 5s | Simple, suficiente para el volumen |
| Deploy | Vercel + Git | Push para deploy, sin CI/CD extra |
| Auth | Link secreto (token) | Sin login, sin fricción para vendedores |

### Data Model (Vercel KV)

```typescript
// Key: raffle:numbers
// Value: Hash de 100 entradas
{
  "00": { status: "available", reservedBy: null, reservedAt: null },
  "01": { status: "reserved", reservedBy: "Juan", reservedAt: 1718100000000 },
  "02": { status: "sold", reservedBy: "María", reservedAt: 1718090000000, confirmedAt: 1718100000000 },
  // ... 00-99
}

// Key: raffle:config
{
  "name": "Rifa Solidaria",
  "beneficiary": "[Beneficiary Name]",
  "prizes": [
    { "position": 1, "amount": 600 },
    { "position": 2, "amount": 400 }
  ],
  "ticketPrice": 20,
  "drawDate": "2026-07-26",
  "drawTime": "22:30",
  "lottery": "Lotería Táchira A y B",
  "reserveTimeoutHours": 24,
  "adminToken": "TOKEN_SECRETO_AQUI"
}
```

### API Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/numbers` | Obtener todos los números | Público |
| POST | `/api/numbers` | Reservar un número | Público |
| PUT | `/api/numbers/:num` | Confirmar pago (cambiar a vendido) | Admin |
| GET | `/api/export` | Descargar CSV | Admin |
| GET | `/api/config` | Obtener configuración de rifa | Público |

### Seguridad

- Admin panel accesible via `?token=TOKEN_SECRETO` en URL
- Token hardcodeado en variables de entorno de Vercel
- Sin autenticación de usuario (no es necesario para este caso)
- Rate limiting básico para prevenir abuso

---

## UI/UX Specifications

### Layout Móvil (Principal)

```
┌─────────────────────────────────┐
│  [Foto圆形]  RIFA SOLIDARIA    │
│  [Foto]      RIFA SOLIDARIA    │
│  Benef.      Para ayudar a...  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Primer premio    Dos únicos    │
│  600$             premios      │
│                   Valor: 20$   │
│  Segundo premio                 │
│  400$                           │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  00  01  02  03  ●  05  06  ●  │
│  10  ●  12  ●  ●  15  ●  ●  │
│  ... 10x10 grid ...             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Método de pago:                │
│  Dólares / Pago móvil / Pesos  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Juega el 26/07/2026            │
│  Lotería Táchira A y B         │
│  10:30 PM                       │
└─────────────────────────────────┘
```

### Layout Admin

```
┌─────────────────────────────────┐
│  Panel Admin — Rifa Solidaria   │
│  [Export CSV] [Filtros]         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Resumen: 45 disponibles       │
│  30 reservados | 25 vendidos   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  NÚMEROS RESERVADOS (30)        │
│  ┌─────┬─────────┬──────────┐  │
│  │ 04  │ Juan    │ [Confirm]│  │
│  │ 11  │ María   │ [Confirm]│  │
│  │ ... │ ...     │ ...      │  │
│  └─────┴─────────┴──────────┘  │
└─────────────────────────────────┘
```

### Colores (Extraídos de imagen original)

```css
:root {
  --bg-primary: #FCE7EE;
  --bg-secondary: #FBEBF1;
  --text-primary: #725057;
  --text-dark: #562C29;
  --accent-primary: #DA2B4D;
  --accent-secondary: #D23554;
  --rose-muted: #D8A4A7;
  --rose-medium: #956267;
  --state-available: #FCE7EE;
  --state-reserved: #D8A4A7;
  --state-sold: #DA2B4D;
}
```

---

## Constraints

1. **Mobile-first**: La mayoría de usuarios acceden por WhatsApp en celular
2. **Sin costos de infra**: Vercel free tier + Vercel KV free tier
3. **Open source**: Código público para que otros lo reutilicen
4. **Sin integración de pagos**: Pagos manuales (efectivo, transferencia, PagoMóvil)
5. **Simpleza**: Sin frameworks pesados, sin over-engineering
6. **Una raffle por deploy**: No necesitamos soporte multi-rifa por ahora

---

## Out of Scope (v1)

- Autenticación con login/usuario
- Pagos integrados (Stripe, MercadoPago, etc.)
- Notificaciones push
- App móvil nativa
- Múltiples rifas en un mismo deploy
- Dashboard con gráficos/analytics
- Sistema de comisiones para vendedores

---

## Success Metrics

- **Funcional**: Los 100 números se pueden reservar/vender sin errores
- **UX**: Un comprador puede reservar un número en < 30 segundos
- **Confiabilidad**: Sin doble venta de números
- **Adopción**: La beneficiaria y los vendedores lo usan sin soporte técnico

---

## Assets

- **Imagen original**: `docs/428e6286-8456-4bd2-9ab7-67b798e632ac.jpeg` (540x960px)
- **Foto hero extraída**: `docs/hero-photo.png` (200x200px, circular, transparencia)
- **Design spec**: `docs/DESIGN-SPEC.md` (colores, tipografía, componentes)

---

## Timeline

| Fase | Descripción | Dependencias |
|------|-------------|--------------|
| 1 | Setup Next.js + Vercel KV | Cuenta Vercel |
| 2 | API endpoints (CRUD números) | Vercel KV configurado |
| 3 | Grid público (componente principal) | API funcionando |
| 4 | Panel admin | API funcionando |
| 5 | CSV export | Panel admin |
| 6 | Deploy + Testing | Todo anterior |
| 7 | Link de WhatsApp + Foto hero | Deploy exitoso |
