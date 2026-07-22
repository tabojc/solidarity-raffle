# Autenticación Admin — Rifa Solidaria

Mecanismo de autenticación para el panel de administración. Sin registros de usuario, sin sesiones, sin JWTs — un token secreto compartido.

---

## Cómo funciona

La autenticación se basa en un **token secreto compartido** (`ADMIN_TOKEN` en variables de entorno). Cualquiera que conozca el token puede acceder al panel.

### Formas de ingresar

| Método | Descripción |
|--------|-------------|
| **URL** | `/admin?token=SECRETO` — útil para compartir link con vendedores |
| **Formulario** | Ingreso manual de clave en `/admin` |

### Flujo completo

```
/admin (sin token en URL)
  → formulario de login
  → usuario ingresa clave
  → verifyToken() → GET /api/admin/verify?token=X
  → si válido → guarda en localStorage, muestra panel
  → si inválido → muestra error, no guarda nada

/admin?token=SECRETO (token en URL)
  → detecta token en query params
  → verifyToken() → GET /api/admin/verify?token=SECRETO
  → si válido → guarda en localStorage, limpia URL (replaceState), muestra panel
  → si inválido → no guarda nada, muestra formulario sin token
```

### Persistencia

- El token se guarda en `localStorage` bajo la clave `admin_token`
- Cuando se ingresa por URL, el token se persiste automáticamente y la URL se limpia con `window.history.replaceState(null, '', '/admin')`
- Al cerrar sesión (botón **Salir**), se elimina `localStorage` y se vuelve al formulario

---

## Antes: el bug de autenticación

### Problema

Originalmente la autenticación era **client-side only**: el panel verificaba si `localStorage` tenía un token, y si existía, mostraba la UI admin. **No había verificación server-side**.

Esto provocaba dos problemas graves:

1. **Login fantasma**: si el token en localStorage era inválido (ej: cambiaron `ADMIN_TOKEN` en el servidor), el panel se mostraba igual. El usuario veía la UI pero todas las operaciones fallaban sin explicación clara.

2. **Errores silenciosos**: las operaciones PUT (cancelar, confirmar) fallaban con `401 Unauthorized`. La UI mostraba `alert("Error al cancelar")` sin decir que el problema era el token. El usuario no entendía qué pasaba.

### Código anterior (con bug)

```typescript
// ❌ Solo verificaba existencia local, no validez
useEffect(() => {
  const stored = localStorage.getItem("admin_token")
  if (stored) {
    setToken(stored)
    setAuthenticated(true)  // ← asumía que era válido sin preguntarle al server
    loadData()
  } else {
    setLoading(false)
  }
}, [])
```

---

## El fix

### 1. Endpoint de verificación (`/api/admin/verify`)

Se agregó el endpoint `GET /api/admin/verify?token=X` que compara el token contra `ADMIN_TOKEN` del lado del servidor.

```typescript
// src/app/api/admin/verify/route.ts
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (token && token === process.env.ADMIN_TOKEN) {
    return NextResponse.json({ valid: true }, {
      headers: { 'access-control-allow-origin': '*' },
    })
  }
  return NextResponse.json(
    { valid: false, error: 'Token inválido' },
    { status: 401, headers: { 'access-control-allow-origin': '*' } }
  )
}
```

### 2. verifyToken() — verificación server-side

El admin ahora llama a `verifyToken()` en el `useEffect` de inicialización **y** en `handleLogin`:

```typescript
async function verifyToken(t: string): Promise<boolean> {
  const res = await fetch(`/api/admin/verify?token=${encodeURIComponent(t)}`)
  const body = await res.json()
  return body.valid === true
}
```

### 3. formatError() — errores accionables

Se agregó `formatError()` para traducir errores HTTP crudos a mensajes que el usuario entienda:

```typescript
function formatError(err: unknown, action: string): string {
  const msg = err instanceof Error ? err.message : `Error al ${action}`
  if (msg === "Unauthorized") {
    return "No autorizado — la clave secreta no coincide con el servidor. Revisá que ADMIN_TOKEN esté bien configurado."
  }
  return msg
}
```

Esto se usa en todas las operaciones admin: `handleConfirm`, `handleCancelReservation`, `handleSaveName`, `handleExport`.

### 4. Manejo de token expirado en init

Si al cargar la página el token guardado en localStorage resulta inválido, se limpia automáticamente y se muestra un mensaje claro:

```typescript
const valid = await verifyToken(effectiveToken)
if (!valid) {
  localStorage.removeItem("admin_token")
  setToken("")
  setLoginError("El token guardado ya no es válido. Ingresá la clave nuevamente.")
  setLoading(false)
  return
}
```

---

## Flujo actual de autenticación

```
URL o localStorage
  ↓
verifyToken() → GET /api/admin/verify
  ↓
  ├── válido → authenticated = true → loadData() → polling 5s
  │             → operaciones PUT con token en query param
  │             → admin reserve con adminToken en body
  │
  └── inválido → limpia localStorage
                → muestra formulario con mensaje de error
```

### Operaciones protegidas y cómo pasan el token

| Operación | Endpoint | Cómo se envía el token |
|-----------|----------|------------------------|
| Confirmar pago | `PUT /api/numbers/[num]` | `?token=X` en query param |
| Cancelar reserva | `PUT /api/numbers/[num]?action=cancel` | `?token=X` en query param |
| Deshacer confirmación | `PUT /api/numbers/[num]?action=undo` | `?token=X` en query param |
| Renombrar | `PUT /api/numbers/[num]?action=rename` | `?token=X` en query param |
| Reserva admin | `POST /api/numbers` | `adminToken` en body JSON |
| Exportar CSV | `GET /api/export` | `?token=X` en query param |

### Diferencia clave: adminToken vs token query param

- **POST /api/numbers** (reserva admin): el token va en el **body** como `adminToken`. Esto permite que la reserva admin no pase por rate limit (el server detecta el token y salta el rate limiter).
- **PUT /api/numbers/[num]** y **GET /api/export**: el token va como **query param** `?token=X`. Es el patrón estándar para endpoints REST.

---

## Diagrama de flujo

```
┌──────────────┐
│  /admin      │
│  (acceso)    │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ ¿Token en URL?       │
│ window.location      │
└──────┬───────┬───────┘
       │       │
      Sí      No
       │       │
       ▼       ▼
┌──────────┐ ┌──────────────┐
│ Guardar  │ │ ¿Token en    │
│ en       │ │ localStorage? │
│localStorage│ └──────┬───────┘
│+ limpiar │        │
│ URL      │       No
└────┬─────┘        │
     │              ▼
     └──┬───────────┘
        │
        ▼
┌──────────────────────┐
│ verifyToken(token)   │
│ GET /api/admin/verify│
└──────┬───────┬───────┘
       │       │
    válido  inválido
       │       │
       ▼       ▼
┌──────────┐ ┌──────────────┐
│ Mostrar  │ │ Limpiar      │
│ panel    │ │ localStorage │
│ + polling│ │ + formulario │
│ 5s       │ │ + error msg  │
└──────────┘ └──────────────┘
```

---

## Seguridad

| Aspecto | Detalle |
|---------|---------|
| Token storage | `localStorage` (accesible desde JS, XSS vulnerable — aceptable para este alcance) |
| Transporte | HTTPS (Vercel) |
| Server-side | Verificación contra `ADMIN_TOKEN` en cada operación protegida |
| Sin sesiones | No hay cookies, ni JWT, ni sessions — stateless puro |
| Rate limit | 10/min en PUT, 5/min en export (protección básica contra abuso) |

---

## Checklist de verificación

- [ ] Al cargar `/admin` sin token, se muestra el formulario de login
- [ ] Al cargar `/admin?token=VALIDO`, se guarda en localStorage y muestra el panel
- [ ] Al cargar `/admin?token=INVALIDO`, se muestra el formulario con error
- [ ] Al cargar con token inválido en localStorage, se limpia y muestra formulario
- [ ] `handleLogin` verifica server-side antes de mostrar el panel
- [ ] Si el servidor cambia `ADMIN_TOKEN`, los tokens guardados se invalidan automáticamente
- [ ] `formatError` traduce `"Unauthorized"` a un mensaje accionable
- [ ] Botón **Salir** elimina localStorage y vuelve al formulario
- [ ] Token en query param no aparece en logs del servidor (Next.js App Router no loguea query params por defecto)
- [ ] Token nunca se expone en el cliente en respuestas de API
