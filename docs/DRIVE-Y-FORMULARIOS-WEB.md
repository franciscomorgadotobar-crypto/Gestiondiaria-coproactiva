# Integración Google Drive y formularios públicos · Coproactiva
Fecha: 2026-10-23

## Carpeta por comunidad
Ruta: `Coproactiva / Comunidades / [Nombre · prefijo UUID]`

Cuatro carpetas iniciales:
- `01 Administración`: contratos, residentes, reglamentos, comunicaciones
- `02 Finanzas`: presupuestos, gastos comunes, rendiciones
- `03 Operaciones`: levantamientos, mantenciones, activos, incidencias
- `04 Seguimiento e informes`: compromisos, avances, informes de gestión

Se crean automáticamente al crear la comunidad o convertir un prospecto ganado, cuando Drive esté configurado. Subcarpetas específicas por tipo de actividad y registro se crean al subir el primer archivo. El estado queda en `drive_carpetas_comunidad` y el ID principal en `comunidades.carpeta_drive_id`.

## Configuración Google Workspace requerida
1. Disponer de una **unidad compartida** de Google Workspace (recomendado) y de una carpeta base `Coproactiva / Comunidades`.
2. Crear una cuenta de servicio en Google Cloud, habilitar Google Drive API y conceder acceso a la unidad compartida o carpeta base al correo de la cuenta de servicio. Google Drive `supportsAllDrives` ya está implementado.
3. Guardar como **secretos de Supabase Edge Functions** (nunca en GitHub ni en el navegador):
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de cuenta de servicio.
   - `GOOGLE_DRIVE_ROOT_ID`: ID de la carpeta `Comunidades`.
4. Ir a `Comunidades → [Comunidad] → Configuración → Carpeta documental` y ejecutar **Crear o reconectar carpetas** para comunidades antiguas.
5. Probar permisos internos, un archivo de muestra y descarga desde levantamiento.

Sin secretos el servicio devuelve `503` y mantiene estado pendiente: la creación de comunidad nunca se revierte por un problema de Drive.

**Importante:** fotografías antiguas y adjuntos previos en Supabase Storage siguen allí; esta fase añade carga directa a Drive para los documentos nuevos del levantamiento. No se elimina nada de Storage sin migración y verificación de integridad. Los residentes tienen una carpeta dentro de Administración, pero no permisos de acceso a Drive por defecto.

## Endpoint CRM
- `contacto-web-crm` (Edge Function pública con validación, origen permitido, honeypot, política de privacidad, límite por contacto e idempotencia de 1 hora).
- Destino: `prospectos` con etapa `nuevo`, visible en Pipeline de Gestión Diaria.
- Auditoría y atribución: `web_form_ingresos`, con ID del formulario, servicio original y UTM.
- Avisos: tabla `notificaciones` para admins y jefaturas activas.
- Web actualizada: `assets/lead-form.js` del repo `web-coproactiva`; el Worker anterior permanece disponible para reversión temporal.

Si se habilita `WEB_FORM_TURNSTILE_SECRET`, también debe agregarse el widget Turnstile al formulario para enviar `turnstile_token`. Sin configuración simultánea se bloquearán los envíos.
