# Proposal: Generación de Imagen de Rifa

## Intent

La admin (mamá de la beneficiaria) usa una imagen hecha a mano de la grilla de la rifa para compartir en el estado de WhatsApp. Necesitamos generar automáticamente una imagen PNG de 540×960px que muestre el estado actual de la rifa, lista para compartir.

## Scope

### In Scope
- Endpoint público `/api/raffle-image` (Edge Runtime) que genera PNG
- Layout con hero circular, info de premios, grilla 10×10, métodos de pago, fecha del sorteo
- Corazones rosa (❤️) para números reservados Y vendidos (tema de solidaridad)
- Cache en Redis con invalidación al registrar nueva reserva
- Botón "Generar Imagen" en panel admin que descarga el PNG
- Font Geist Sans (misma que la app)

### Out of Scope
- Edición de layout por parte del admin
- Múltiples variantes de imagen
- Integración directa con WhatsApp API
- Imágenes animadas oStories interactivas

## Capabilities

### New Capabilities
- `raffle-image-generation`: Generación de imagen PNG estática de la grilla de rifa para compartir en redes sociales

### Modified Capabilities
- `raffle-admin-panel`: Se agrega botón "Generar Imagen" que descarga PNG generado

## Approach

- **Librería**: Satori (JSX → SVG) + @resvg/resvg-js (SVG → PNG)
- **Endpoint**: Edge Runtime en `/api/raffle-image`, público (sin auth)
- **Datos**: Lee de Redis via funciones existentes de `kv.ts`
- **Cache**: Imagen generada se almacena en Redis con TTL; se invalida al crear reserva
- **Trigger**: Botón en admin panel → fetch al endpoint → descarga automática del blob

## Affected Areas

| Area | Impact | Descripción |
|------|--------|-------------|
| `app/api/raffle-image/route.ts` | Nuevo | Endpoint Edge que genera la imagen PNG |
| `app/admin/page.tsx` | Modificado | Agrega botón "Generar Imagen" |
| `lib/kv.ts` | Modificado | Funciones de cache de imagen en Redis |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Vercel free tier: Edge Functions tienen timeout de 30s | Media | Satori es rápido (~200ms); monitorear tiempo de generación |
| Font Geist Sans no disponible en Edge | Baja | Usar fallback a system font si falla la carga |
| Redis free tier: 10K comandos/día | Baja | Cache reduce llamadas; invalidación selectiva |
| Imagen no cabe en 540×960px con mucha info | Baja | Layout diseñado para 100 números; espacio suficiente |

## Rollback Plan

1. Eliminar `app/api/raffle-image/route.ts`
2. Revertir cambios en `app/admin/page.tsx` (quitar botón)
3. Eliminar funciones de cache de imagen en `lib/kv.ts`
4. No hay dependencias de datos — solo archivos nuevos/modificados

## Dependencies

- `satori` y `@resvg/resvg-js` (npm packages nuevos)
- `geist` font package (ya instalado en el proyecto)
- Redis existente (ya configurado)

## Success Criteria

- [ ] Endpoint genera PNG de 540×960px válido
- [ ] Grilla muestra 100 números con corazones en reservados/vendidos
- [ ] Botón en admin descarga imagen correctamente
- [ ] Cache funciona: segunda llamada es más rápida
- [ ] Invalidación funciona: nueva reserva limpia el cache
- [ ] Imagen es legible y compartible en WhatsApp
