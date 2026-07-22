# Componentes UI — Rifa Solidaria

Todos los componentes son **client components** (`"use client"`). Usan React 19 con hooks (useState, useEffect, useCallback, useRef). No hay Server Components con datos — el modelo es SPA con polling.

---

## Índice

- [Hero](#hero)
- [NumberGrid + NumberCell](#numbergrid--numbercell)
- [ReserveModal](#reservemodal)
- [AdminPage](#adminpage)
- [Checklist de verificación](#checklist-de-verificación)

---

## Hero

Archivo: `src/components/Hero.tsx` (64 líneas)

Cabecera de la página pública. Renderiza la foto del beneficiario, nombre de la rifa, premios, precio y fecha del sorteo.

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `config` | `RaffleConfig \| null` | Configuración de la rifa, o `null` mientras carga / no existe |

### Estados visuales

| Estado | Comportamiento |
|--------|----------------|
| `config === null` | Retorna `null` — no renderiza nada |
| `config.heroImageUrl` vacío | No muestra imagen (el `img` se renderiza condicionalmente) |
| `config` completo | Muestra foto circular, nombre, beneficiaria, precio, fecha, premios, lotería |

### Renderizado

```
┌─────────────────────────────────────┐
│         [Foto circular]             │
│                                     │
│        Nombre de la Rifa            │
│   A beneficio de [Beneficiaria]     │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ Precio   │  │ Sorteo   │        │
│  │   $20    │  │26/07/2026│        │
│  └──────────┘  └──────────┘        │
│                                     │
│  ┌────────────────────────────┐     │
│  │         Premios            │     │
│  │  1° $600                   │     │
│  │  2° $400                   │     │
│  └────────────────────────────┘     │
│                                     │
│  Lotería Táchira — 26/07 a las 22:30│
└─────────────────────────────────────┘
```

### Detalles técnicos

- `formatCurrency(amount)` usa `toLocaleString("en-US")` para formato `$600` (sin decimales)
- La imagen se muestra como círculo (`rounded-full`) con borde blanco y sombra
- Fondo `bg-[#FCE8EE]` (rosado claro)
- Diseño responsive: `py-10` en mobile, `py-14 md` en desktop
- Los premios se mapean desde `config.prizes[]` — soporta cantidad variable

### Responsabilidades

- Mostrar información clave de la rifa al usuario
- Servir como entrada visual de la página pública
- No tiene estado interno — es puramente presentacional

---

## NumberGrid + NumberCell

Archivo: `src/components/NumberGrid.tsx` (85 líneas)

Grilla responsive de números clickeables. `NumberGrid` es el contenedor; `NumberCell` es el componente interno para cada número individual.

### NumberGrid — Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `numbers` | `NumbersMap` | `Record<string, RaffleNumber>` — todos los números |
| `onSelect` | `(num: string) => void` | Callback al hacer clic en un número disponible |

### NumberCell — Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `num` | `string` | Identificador del número (ej: `"00"`, `"42"`) |
| `data` | `RaffleNumber` | Datos del número (status, reservedBy, etc.) |
| `onSelect` | `(num: string) => void` | Callback al hacer clic |

### Estados visuales de cada celda

| Estado | Clase CSS | Apariencia | Interacción |
|--------|-----------|------------|-------------|
| `available` | `bg-available-bg border-available-border` | Fondo claro, borde rosado, texto rosado | Hover → fondo rosado sólido, texto blanco. Clic → `onSelect(num)` |
| `reserved` | `bg-reserved text-white` | Fondo rosado sólido, texto blanco | `cursor-not-allowed`. Sin clic |
| `sold` | `bg-sold-bg text-sold line-through` | Fondo rojo, texto rojo, tachado | `cursor-not-allowed`. Sin clic |

Las clases CSS usan variables de Tailwind definidas en `globals.css`:
- `bg-available-bg` / `bg-available`: tonos de disponible
- `bg-reserved`: rosado para reservado
- `bg-sold-bg` / `text-sold`: rojo para vendido

### Layout responsive

```css
/* Mobile: 5 columnas */
.grid-cols-5

/* Desktop (sm breakpoint y superior): 10 columnas */
.sm:grid-cols-10
```

Total: 100 números ordenados por `localeCompare` (00, 01, 02... 99).

### Leyenda

```
■ Disponible    □ Reservado    ■ Vendido
```

Cada indicador usa un `span` de 12×12px con el color correspondiente.

### Accesibilidad

- **Touch targets**: `min-h-[44px] min-w-[44px]` (WCAG 2.1 — target size mínimo)
- **`title`**: Cada celda tiene title "Disponible", "Reservado" o "Vendido"
- **`disabled`**: Las celdas no disponibles tienen `disabled={true}`
- **Contraste**: Estados diferenciados por color + forma (tachado para vendido)
- **Responsive**: 5 columnas en mobile evita botones demasiado pequeños

### Responsabilidades

- Mostrar el estado actual de todos los números de forma visual
- Permitir selección de números disponibles
- Comunicar visualmente qué números están ocupados

---

## ReserveModal

Archivo: `src/components/ReserveModal.tsx` (137 líneas)

Modal de reserva para usuarios públicos. Aparece al hacer clic en un número disponible desde la página principal.

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `num` | `string \| null` | Número seleccionado. `null` → no renderiza |
| `config` | `RaffleConfig \| null` | Config (para mostrar timeout) |
| `onClose` | `() => void` | Cerrar modal sin reservar |
| `onSuccess` | `() => void` | Callback después de reserva exitosa (usado para refrescar datos) |

### Estados internos

| Variable | Tipo | Propósito |
|----------|------|-----------|
| `name` | `string` | Nombre ingresado por el usuario |
| `phone` | `string` | Teléfono (opcional) |
| `sending` | `boolean` | `true` mientras se envía la reserva al servidor |
| `error` | `string \| null` | Mensaje de error para mostrar al usuario |
| `done` | `boolean` | `true` después de reserva exitosa |

### Flujo de la UI

```
num = null           → No renderiza nada (retorna null)

num = "42" (abre)    → Resetea name, phone, error, done
                     → Autofocus en input nombre
                     → Muestra formulario

Formulario:
  [Nombre     ]      → text input
  [Teléfono   ]      → type="tel", opcional
  [Error msg ]       → solo si error !== null
  [Reservar   ]      → botón submit, disabled mientras sending

Submit:
  1. Concatena nombre + teléfono con " - " si ambos existen
  2. Llama a reserveNumber(num, contact) de @/lib/api
  3. Éxito → setDone(true) → muestra ✅ → 1.5s → onSuccess()
  4. Error → setError(err.message) → muestra mensaje en rojo

  Reservado exitoso:
  ┌──────────────────────┐
  │         ✅            │
  │   ¡Reservado!        │
  │   Número 42           │
  └──────────────────────┘
  → 1.5s después llama a onSuccess()
```

### Timeout indicator

```
Tienes 24h para confirmar el pago
```

Usa `config?.reserveTimeoutHours ?? 24` como fallback.

### Detalles técnicos

- **Autofocus**: `useRef` + `setTimeout(() => inputRef.current?.focus(), 100)` al abrir
- **Reseteo**: En `useEffect` dependiente de `num` — se resetean todos los estados internos
- **Contact concatenation**: `[name.trim(), phone.trim()].filter(Boolean).join(" - ")`
- **Cierre**: Botón ✕ en esquina superior derecha
- **Overlay**: `fixed inset-0 bg-black/50 flex items-center justify-center`
- **Prevención de scroll**: No aplica (el modal no bloquea scroll del fondo)

### Responsabilidades

- Capturar datos de contacto del usuario
- Reservar el número vía API
- Dar feedback Visual de éxito/error
- Auto-cerrarse después de reserva exitosa

---

## AdminPage

Archivo: `src/app/admin/page.tsx` (659 líneas)

Panel de administración completo. Self-contained — maneja su propio estado, autenticación, data fetching y operaciones CRUD.

### Props

**Ninguna**. El componente es completamente autónomo. Los parámetros de autenticación se obtienen de `localStorage` y query params de la URL.

### Estados principales

| Estado | Tipo | Propósito |
|--------|------|-----------|
| `authenticated` | `boolean` | Controla si se muestra el panel o el login |
| `token` | `string` | Token admin (desde localStorage o URL) |
| `loading` | `boolean` | Mientras se cargan datos iniciales |
| `numbers` | `NumbersMap` | Todos los números (actualizado cada 5s) |
| `config` | `RaffleConfig \| null` | Configuración de la rifa |
| `loginError` | `string \| null` | Error de autenticación |
| `confirming` / `undoing` / `cancelling` / `renaming` | `string \| null` | Número en operación (para feedback) |

### Sub-componentes y secciones

#### 1. Login form (`!authenticated`)

```
┌──────────────────────────┐
│       Oficina            │
│                          │
│  [Clave secreta]         │
│  [Error message]         │
│                          │
│  [    Ingresar     ]     │
└──────────────────────────┘
```

- Input tipo `password`
- Botón deshabilitado si token vacío o verificando
- Error message en rojo si token inválido

#### 2. Loading state

```
      Cargando...
```

Spinner animado (`animate-pulse`) mientras se cargan datos iniciales.

#### 3. Header — acciones globales

```
[Exportar CSV] [Generar Imagen] [Salir]
```

| Botón | Función | Descripción |
|-------|---------|-------------|
| Exportar CSV | `handleExport()` | Descarga CSV con todos los números |
| Generar Imagen | `handleGenerateImage()` | Descarga PNG de la rifa (Satori + resvg) |
| Salir | `handleLogout()` | Limpia localStorage, vuelve al login |

#### 4. Dashboard stats

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Disponibles│ │Reservados│ │ Vendidos │ │  Total   │
│    72    │ │    18    │ │    10    │ │  $200   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Grid de 4 cards con conteo. `totalSold = sold.length * ticketPrice`.

#### 5. Admin reserve form

Reserva para llamada telefónica (modo admin, sin rate limit):

```
Número:     [____]
Cliente:    [___________]
Teléfono:   [___________] (opcional)
[Reservar]
```

- Envía `adminToken` en body a `POST /api/numbers`
- Formatea contacto como `"Nombre - Teléfono"`

#### 6. Reserved list

```
Reservados (18)

┌──────────────────────────────┐
│ 42                            │
│ Juan Pérez ✏️                │
│ 21/07/2026 15:30             │
│           [Cancelar] [Confirmar]│
└──────────────────────────────┘
```

Por cada número reservado:

| Elemento | Descripción |
|----------|-------------|
| Número | Texto grande, bold |
| Nombre | Con botón ✏️ para edición inline |
| Timestamp | Fecha/hora de reserva en locale `es-VE` |
| Nota | Texto opcional si `data.note` existe |
| Cancelar | Botón rojo — `action=cancel`. Confirmación con `window.confirm()` |
| Confirmar | Botón primario — `PUT /api/numbers/[num]` (sin action) |

**Edición inline de nombre**:
- Al hacer clic en ✏️, el nombre se convierte en input
- Enter confirma, Escape cancela
- Botón Guardar y Cancelar

#### 7. Sold list

```
Vendidos (10)

┌──────────────────────────────┐
│ 07                            │
│ María López ✏️               │
│ Confirmado: 21/07/2026 16:00 │
│           Vendido [Deshacer] │
└──────────────────────────────┘
```

| Elemento | Descripción |
|----------|-------------|
| Número | Texto grande, bold |
| Nombre | Con botón ✏️ para edición inline |
| Timestamp | `Confirmado: {fecha}` |
| Vendido | Badge "Vendido" en rojo |
| Deshacer | Botón borde — `action=undo`. Confirmación con `window.confirm()` |

#### 8. Empty state

Si no hay reservados ni vendidos:

```
No hay reservas ni ventas aún
```

### Polling

```typescript
useEffect(() => {
  // init + verify token...
  const interval = setInterval(loadData, 5000)
  return () => clearInterval(interval)
}, [loadData])
```

- Refresca datos cada 5 segundos
- `loadData()` llama a `fetchNumbers()` + `fetchConfig()` en paralelo
- Se limpia con `clearInterval` al desmontar

### Confirm modal

Al hacer clic en "Confirmar" se abre un modal de confirmación:

```
┌──────────────────────────┐
│       Confirmar          │
│                          │
│ ¿Estás segura de         │
│ confirmar el pago del    │
│ número 42? Esta acción   │
│ se puede deshacer después.│
│                          │
│     [Cancelar] [Confirmar]│
└──────────────────────────┘
```

Esto evita confirmaciones accidentales. El modal se renderiza inline (no es un componente separado).

### Manejo de errores

`formatError()` traduce errores HTTP a mensajes accionables:

| Error HTTP | Mensaje mostrado |
|------------|------------------|
| `"Unauthorized"` | "No autorizado — la clave secreta no coincide con el servidor. Revisá que ADMIN_TOKEN esté bien configurado." |
| Otros | Mensaje original del error |

---

## Resumen de componentes

| Componente | Archivo | Líneas | Props | Estado interno | Props |
|------------|---------|--------|-------|----------------|-------|
| `Hero` | `components/Hero.tsx` | 64 | `config` | ❌ | 1 |
| `NumberGrid` | `components/NumberGrid.tsx` | 85 | `numbers, onSelect` | ❌ | 2 |
| `NumberCell` | (interno en NumberGrid) | — | `num, data, onSelect` | ❌ | 3 |
| `ReserveModal` | `components/ReserveModal.tsx` | 137 | `num, config, onClose, onSuccess` | ✅ name, phone, sending, error, done | 4 |
| `AdminPage` | `app/admin/page.tsx` | 659 | Ninguna (self-contained) | ✅ múltiples estados | 0 |

---

## Checklist de verificación

- [ ] Hero no renderiza nada si `config` es `null`
- [ ] NumberGrid muestra 100 números en grilla 5→10 columnas responsive
- [ ] Cada NumberCell tiene 44×44px mínimo (touch target WCAG)
- [ ] ReserveModal captura nombre y teléfono, llama a API, muestra feedback
- [ ] ReserveModal muestra timeout configurable ("Tienes N horas...")
- [ ] AdminPage requiere token válido (verificado server-side) para mostrar panel
- [ ] AdminPage polling refresca datos cada 5s
- [ ] AdminPage stats calculan disponibles, reservados, vendidos, total $
- [ ] Cancelar/Confirmar/Deshacer muestran confirmación antes de ejecutar
- [ ] Edición inline de nombre funciona con Enter/Escape
- [ ] Botón Salir limpia localStorage y vuelve al login

---

## Referencias

- [Arquitectura](./ARCHITECTURE.md) — stack, estructura, data flow
- [API Reference](./API.md) — endpoints que consumen estos componentes
- [Data Model](./DATA-MODEL.md) — tipos `RaffleNumber` y `RaffleConfig`
