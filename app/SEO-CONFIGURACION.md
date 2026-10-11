# SEO y Analítica · CoproActiva

## Alcance

Área exclusiva para usuarios \`admin\` y \`superadmin\` en **https://app.coproactiva.cl/seo**.

- Search Console: clics, impresiones, CTR, posición media, consultas, URLs, país, dispositivo y serie diaria para 7/28/90 días; comparación con período anterior.
- GA4: usuarios, sesiones, vistas, engagement, eventos clave, canales, páginas y eventos.
- Auditoría HTML de URL del sitio (únicamente \`www.coproactiva.cl\`): HTTP, title, description, H1, canonical, robots, JSON-LD y sitemap.
- URL Inspection: estado **conocido por el índice de Google**. No equivale a una prueba de URL en vivo.
- PageSpeed Insights: Performance, SEO, accesibilidad, buenas prácticas, métricas Lighthouse e INP de campo únicamente cuando esté disponible.
- Oportunidades heurísticas de consultas y observaciones técnicas. Sin cambios automáticos.
- Históricos \`jarvis_metricas_web\` etiquetados y separados de datos en vivo.

La aplicación **no inventa datos**, y la navegación principal no utiliza archivos históricos como fuentes actuales. Los servicios sin permisos informan conexión pendiente. Los totales de Search Console pueden exceder las tablas detalladas debido a la disponibilidad limitada de consultas.

## Configurar en Google Cloud (una sola vez)

1. En un proyecto de Google Cloud, habilitar **Google Analytics Data API**, **Search Console API** y **Search Console URL Inspection API**. Para PageSpeed se puede crear una API key dedicada, opcional para pruebas puntuales.
2. Crear **cuenta de servicio** con archivo JSON y guardar de forma segura el correo \`client_email\` y \`private_key\`. **No subir el JSON a GitHub ni al sitio**.
3. En Search Console, agregar el correo de la cuenta de servicio como usuario con acceso de lectura a la propiedad exacta. Para propiedad de dominio usar \`sc-domain:coproactiva.cl\`; para propiedad URL usar el prefijo completo terminado en \`/\`.
4. En GA4, Administrar → Administración de accesos a la propiedad → añadir el correo como **Viewer**. Obtener el **Property ID numérico**, que no es el Measurement ID \`G-...\`.
5. En Supabase, proyecto \`Coproactiva\`, configurar los siguientes **secretos de Edge Functions**:

   | Variable | Valor |
   | --- | --- |
   | \`GOOGLE_SERVICE_ACCOUNT_EMAIL\` | \`client_email\` del JSON |
   | \`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY\` | \`private_key\` PEM, conservando saltos de línea |
   | \`GA4_PROPERTY_ID\` | Property ID numérico |
   | \`GSC_SITE_URL\` | \`sc-domain:coproactiva.cl\` (predeterminado, cambiar si corresponde) |
   | \`PAGESPEED_API_KEY\` | Opcional, recomendada para consultas frecuentes |

6. Para **Tag Manager**, habilitar Tag Manager API y dar acceso de lectura del contenedor `GTM-MB2RCFR5` a la cuenta de servicio. Google permite buscar el path del contenedor por ID público; `GTM_CONTAINER_PATH` es opcional.
7. Para **Google Business Profile**, habilitar Business Profile Performance API, configurar un cliente OAuth 2.0 y autorizar con la cuenta propietaria o administradora de la ficha usando el scope `https://www.googleapis.com/auth/business.manage`. El flujo de consentimiento debe generar el `refresh_token` de manera segura; nunca enviarlo por chat ni almacenarlo en el frontend. El ID de ubicación tiene que ser el ID de ficha real, no el identificador de Google Maps ni el enlace compartido. Google puede requerir autorización/cuota del proyecto para Business Profile.
8. Desplegar \`supabase/functions/seo-analitica/index.ts\` con \`verify_jwt=true\` y luego ingresar a la pestaña **Conexiones**, pulsar **Actualizar**.
9. Si la función devuelve 403, revisar el rol \`perfiles.rol\` y \`perfiles.activo\` del usuario autenticado. La validación ocurre en el servidor, no solo en React.

## Medición de contactos

El repositorio \`web-coproactiva\` incluye Google Tag Manager con Consent Mode y el formulario \`assets/lead-form.js\` dispara \`window.coproactivaTrackLead\` al completar exitosamente. Es preciso **verificar** en GTM y GA4 que ese evento acabe como \`generate_lead\` y esté registrado como evento clave. No contar clics de botones ni \`page_view\` como leads verificados.

Los datos recopilados con consentimiento denegado pueden diferir de otros sistemas. No se deben eliminar las protecciones existentes para incrementar artificialmente métricas.

## Seguridad

- Edge Function exige sesión válida y consulta tabla \`perfiles\` bajo contexto de usuario; exige rol admin/superadmin y activo.
- Secretos Google exclusivamente del lado de servidor. **Nunca** variables \`VITE_*\` ni claves de service role en navegador.
- Solo dominio fijo \`https://www.coproactiva.cl\`, rutas locales validadas (sin proxy universal ni URL externa).
- \`jarvis_metricas_web\` consultada solo después de autenticar y autorizar al usuario.
- No se ejecutan acciones de escritura sobre el sitio ni en Google APIs.
- Las llamadas PageSpeed son explícitas, evitando exceder cuota automáticamente.

## Pruebas de aceptación

1. Usuario cliente, terreno o jefatura no puede entrar a \`/seo\` ni consultar API; admin y superadmin sí.
2. Sin secretos, se visualizan estados **pendiente**, no datos falsos ni pantalla en blanco.
3. Auditoría de \`/\` y URL interna funciona; rutas externas son rechazadas por servidor.
4. Con permisos Google, se ven Search Console + GA4 y 7/28/90 días; exportación CSV.
5. Indexación y PageSpeed solo al pulsar botón; errores 403/429 de APIs se muestran como falla, no como “0”.
6. Rutas y menú funcionan en escritorio y Android PWA.
7. \`npm run build\` y pruebas previas pasan antes de integrar la rama al flujo de publicación.

## Frecuencia y transparencia

- Cada pulsación «Actualizar» consulta las APIs de Google directamente y adjunta fecha de consulta donde corresponda.
- GA4 Realtime consulta una ventana móvil de los últimos 30 minutos y se vuelve a consultar cada 60 segundos en una pestaña visible. No simular usuarios activos a partir de sesiones históricas.
- Search Console entrega datos finales después de su período propio de procesamiento; actualmente la consulta termina tres días antes del día actual.
- Business Profile Performance devuelve datos diarios y búsquedas mensuales, aunque el acceso sea en línea. No anunciar que son contadores instantáneos.
- Tag Manager API informa contenido de la versión publicada, no los disparos de etiquetas. Para eventos recibidos se utiliza Google Analytics.
- El acceso a APIs depende de permisos de la cuenta y habilitación/cuotas en Google Cloud; sin autorización no es posible mostrar cifras verdaderas.
