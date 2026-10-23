# Integración Google Drive y formularios públicos · Coproactiva
Actualizado: 2026-10-23 (OAuth 2.0 con contacto@coproactiva.cl)

## Estructura en Drive
`COPROACTIVA / Comunidades / [Agrupación opcional: cliente o inmobiliaria] / [Comunidad]`

Cuatro carpetas por comunidad:
- `01 Administración` → `Documentos administrativos`
- `02 Finanzas` → `Contabilidad`
- `03 Operaciones` → `Levantamientos/[ID]`, `Mantenciones/[ID del agendamiento]`, `Incidencias/[ID]`
- `04 Seguimiento e informes` → `Compromisos y avances/[ID]`, `Informes`

Ejemplo: `COPROACTIVA / Comunidades / GPR / Reserva Santa Clara / 03 Operaciones / Levantamientos / [ID del levantamiento]`.

La estructura existente se reutiliza: nunca se renombra, mueve ni elimina una carpeta. Antes de crear algo se busca la carpeta ya vinculada (IDs en Supabase), luego por propiedad interna (`appProperties`) y luego por nombre. Un bloqueo por comunidad (`drive_tomar_bloqueo`) evita duplicados por reintentos simultáneos.

## Autorización (OAuth 2.0)
- Proyecto Google Cloud existente de coproactiva.cl, pantalla de consentimiento **Interna** (sin verificación externa y sin expiración semanal del refresh token).
- Cliente OAuth "Gestion Diaria - Google Drive" (aplicación web). URI de redirección: `https://vnjqzpbtcccpnxngoqfx.supabase.co/functions/v1/drive-oauth`.
- Permiso solicitado: `https://www.googleapis.com/auth/drive`. Se eligió en lugar de `drive.file` porque la aplicación debe encontrar y reutilizar carpetas creadas fuera de ella (COPROACTIVA, Comunidades, GPR, Reserva Santa Clara y sus subcarpetas) y detectar agrupaciones creadas manualmente; `drive.file` exigiría seleccionar cada carpeta con Google Picker y no vería carpetas nuevas creadas a mano, lo que generaría duplicados. El servidor limita las operaciones a carpetas dentro de `COPROACTIVA / Comunidades` y a archivos registrados en Supabase.
- Flujo: `iniciar` (solo superadmin/admin) genera `state` aleatorio de un solo uso (10 min, guardado como hash) y PKCE S256 → Google → callback `drive-oauth` (GET) → intercambio con acceso offline → se verifica que la cuenta sea `contacto@coproactiva.cl` → refresh token cifrado con AES-256-GCM y guardado en Supabase Vault.
- Renovación automática del access token en cada función; si Google revoca la autorización, el estado pasa a "revocada" y la app pide reconectar.
- Desconectar revoca el token en Google, lo borra de Vault y no toca carpetas ni archivos.

Secretos (solo en Supabase, nunca en GitHub ni en el navegador):
- `GOOGLE_OAUTH_CLIENT_SECRET` (secreto de Edge Functions).
- El ID del cliente (público) está en `drive_configuracion.oauth_client_id`.
- Opcional: `DRIVE_TOKEN_KEY` para separar la clave de cifrado del secreto del cliente.

## Funciones Edge
- `drive-oauth` (verify_jwt=false por el callback de Google; las acciones POST validan sesión y rol): `estado`, `iniciar`, `desconectar`, `verificar`.
- `drive-comunidad` (verify_jwt=true): `provision`, `agrupaciones`, `asignar_agrupacion`, `upload`, `download`, `delete`, `visibilidad`, y `procesar_pendientes` (pg_cron cada 10 minutos con token interno en Vault).

## Permisos
- Superadmin/admin/jefatura: documentos de las comunidades que pueden ver (`ve_comunidad`).
- Terreno: solo archivos de levantamientos asignados a su perfil.
- Cliente: solo documentos marcados explícitamente como visibles al portal. Los documentos de Administración y Finanzas exigen una confirmación adicional antes de publicarse. Nada se publica automáticamente.
- Sin enlaces públicos de Drive: la descarga pasa por la función con la sesión del usuario.

## Archivos
- Tipos: PDF, JPG/PNG/WEBP/GIF/HEIC, MP4/MOV, Word, Excel, PowerPoint, ODT/ODS, CSV y TXT. Se valida extensión y firma del contenido. Máximo 25 MB por archivo.
- Metadatos en `drive_archivos_comunidad` (autor, fecha, tamaño, SHA-256, MD5 de Drive, clave de idempotencia). Eliminar envía a la papelera de Drive y conserva el registro y el historial (`drive_archivos_eventos`).
- Módulos: Levantamientos (ficha del levantamiento), Compromisos y avances, Mantenciones (Agenda y registro de ejecución), Incidencias (Bitácora), Documentos administrativos, Contabilidad e Informes (pestaña Documentos de la comunidad).
- Si Drive no está autorizado, mantenciones, compromisos e incidencias siguen usando el almacenamiento anterior para no detener la operación. Las evidencias antiguas de Supabase Storage no se eliminan; su migración se hará después con verificación de integridad.

## Comunidades nuevas y prospectos ganados
Al crear una comunidad o ganar un prospecto se intenta crear la carpeta de inmediato. Si Drive falla, la comunidad se crea igual, el estado queda pendiente con el error y el reintento automático actúa con espera progresiva. En Comunidades → Configuración se puede elegir una agrupación (cliente o inmobiliaria) antes de crear la carpeta.

## Endpoint CRM
- `contacto-web-crm` (Edge Function pública con validación, origen permitido, honeypot, política de privacidad, límite por contacto e idempotencia de 1 hora).
- Destino: `prospectos` con etapa `nuevo`, visible en Pipeline de Gestión Diaria.
- Auditoría y atribución: `web_form_ingresos`, con ID del formulario, servicio original y UTM.
- Avisos: tabla `notificaciones` para admins y jefaturas activas.

Si se habilita `WEB_FORM_TURNSTILE_SECRET`, también debe agregarse el widget Turnstile al formulario para enviar `turnstile_token`. Sin configuración simultánea se bloquearán los envíos.
