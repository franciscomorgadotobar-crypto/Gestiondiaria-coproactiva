# Recepción WhatsApp de Coproactiva — versión 1

Implementado en la app, Supabase y las funciones. El canal queda deshabilitado hasta conectar el número a Meta: actualmente se usa solamente WhatsApp Business. No se enviaron mensajes reales durante las pruebas.

## Uso

- Área **WhatsApp** → Bandeja, para admin y superadmin activos. Superadmin también ve Automatizaciones y Configuración.
- La persona elige primero el motivo. Nunca se infiere el motivo por el teléfono.
- Residentes: coincidencia de teléfono en residentes/copro­pietarios y relación con una unidad de comunidad activa; selección si hay varias casas. Se reciben solicitudes sin mostrar gastos, estados financieros ni datos privados. Desconocidos declaran nombre/comunidad/casa/relación; administración valida por un canal confiable antes de asociar la solicitud a Bitácora. RUT + casa no es una prueba de identidad.
- Menú de residentes: problema, gestión, reclamo, hablar con administración o finalizar. Problemas agrupados en accesos/seguridad, aseo/espacios comunes, agua/electricidad y otro. No hay ascensores ni categorías repetidas de mantención/desperfecto.
- La persona confirma el resumen antes del registro automático. Registro y vínculo con Bitácora se confirman en la misma transacción; el bot comunica éxito solamente después de esa transacción. Cada solicitud genera como máximo una Bitácora. Administración puede revisar la descripción y confirmar el registro después de validar un contacto desconocido.
- Riesgo para personas deriva inmediatamente e indica contactar a los servicios de emergencia. La solicitud queda sin registro automático hasta la revisión y confirmación administrativa. Este WhatsApp no sustituye emergencias.
- Cotizaciones confirmadas → `prospectos`, fuente **WhatsApp**. Misma comunidad y teléfono reutilizan el prospecto y agregan la nueva interacción a observaciones. No se ofrecen precios ni plazos automáticamente.
- Postulación: solo nombre, comuna y área. Respuesta: **“Para postular, envía tu currículum a contacto@coproactiva.cl.”** El registro en Postulantes se realiza después de recibir y clasificar el correo.
- Proveedor: **“Envía tu presentación de servicios a contacto@coproactiva.cl. Quedarás registrado en nuestra base de proveedores y te contactaremos.”**
- Otro: nombre, breve descripción y derivación humana.
- **Proveedores → Correos**: recepción desde Gmail y clasificación manual como postulante, proveedor u otro. Permite vincular registros existentes; también busca por remitente/hilo antes de crear uno. Administración puede asociar la conversación de WhatsApp, verificando el contacto; el registro conserva origen `whatsapp` y recupera teléfono, comuna y área cuando corresponden. Clasificación y vínculo se guardan en una sola transacción. **Proveedores → Postulantes** utiliza la tabla que ya existía en producción.

## Bot, personas y archivos

El bot se silencia desde la derivación. Tomar/reasignar/cerrar cancela respuestas pendientes. Si hay una petición de envío ya en curso, la acción pide esperar unos segundos antes de tomar control, para evitar que llegue una respuesta del bot después del cambio. Solo una persona tiene la asignación activa. No hay botón de devolución al bot en esta versión.

Todos los envíos de texto, bot y humanos, requieren un mensaje entrante dentro de las últimas 24 horas; la comprobación se repite al despachar. Fuera de ese plazo se espera un nuevo mensaje. No se incorporaron plantillas de Meta para iniciar conversaciones.

Fotos, documentos, audio y video permanecen en WhatsApp. Solo se conserva el tipo y, si viene, nombre/MIME del archivo. No se guardan media IDs, URLs, bytes, vistas previas ni transcripciones. El bot responde: **“Por favor, envía los archivos a contacto@coproactiva.cl para que podamos revisarlos.”** En atención humana corresponde a administración pedirlo, sin reactivar al bot.

El sincronizador de Gmail deja de subir EML/adjuntos a Supabase, y no persiste HTML que pueda contener imágenes embebidas. Conserva texto y metadatos, con acceso al original en Gmail. Los archivos históricos existentes permanecen intactos.

Cerrar atención no finaliza la Bitácora. Un mensaje posterior inicia una nueva atención con el menú inicial; las atenciones humanas pendientes reciben los mensajes en la misma conversación. Un saludo durante un flujo incompleto ofrece continuar o volver al menú.

## Activación del número — pendiente

1. Preparar WhatsApp Cloud API en Meta Business para el número. Comprobar si Meta permite **coexistencia** con WhatsApp Business para esa cuenta; si no, planificar la migración con el titular. La implementación no elimina, desregistra ni migra el número.
2. En secretos de Edge Functions de Supabase, configurar `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_GRAPH_VERSION` (formato `vXX.X`, versión soportada fijada explícitamente). No introducir claves en GitHub, el navegador ni el chat.
3. Registrar el webhook **https://vnjqzpbtcccpnxngoqfx.supabase.co/functions/v1/whatsapp-webhook** y el verify token. Suscribir `messages`. El POST valida la firma HMAC sobre el cuerpo original y comprueba el `phone_number_id` antes de guardar mensajes.
4. En **WhatsApp → Configuración**, verificar conexión y seleccionar un **responsable de recepción automática** activo. Se utiliza para el campo requerido `bitacora_registros.registrado_por`; descripción y auditoría distinguen claramente los registros automáticos de los realizados por personas. No se eligió arbitrariamente a un usuario.
5. Habilitar la recepción y realizar pruebas con el número de prueba/controlado: todos los motivos, confirmación, duplicados, varios domicilios, desconocidos, adjuntos, silencio al derivar y tomar control. Después verificar una entrega real con ese número.

La verificación de secretos indica solamente que están configurados; no prueba por sí sola que el token sea válido o que Meta haya suscrito el webhook. No se requiere un intermediario pagado. Los cargos de Meta, si corresponden al uso futuro, se gestionan directamente con Meta.

## Operación y seguridad

RLS y funciones revisan el perfil activo en servidor. Las tablas nuevas no permiten escritura directa desde el navegador; los RPCs autorizados registran actor y eventos. Credenciales de Meta y service role se utilizan exclusivamente en funciones. `whatsapp_config` es una tabla privada sin acceso directo del cliente.

El webhook se publica sin validación JWT para aceptar Meta, pero exige la firma; el worker exige un token interno de Vault o una sesión validada con Auth y perfil admin/superadmin. La verificación de GET solo acepta el verify token. Configuración/readiness son de superadmin. El cron privado despierta al worker cada minuto **solo si el canal está habilitado**.

Ingreso idempotente por ID de mensaje de Meta. Un lease serializa el worker y una revisión por conversación protege contra cambios de atención concurrentes. El registro de negocio y la intención de envío se guardan juntos. Un fallo de registro deriva sin afirmar que la solicitud se creó. Un envío de resultado incierto queda marcado como **incierto**, sin reintento automático que pueda duplicarlo. Una recepción caída responde 503 para permitir la redelivery de Meta. Los recibos de entrega no avanzan el flujo.

Los envíos en curso interrumpidos pasan a inciertos al recuperar el worker. Administración debe revisar su historial antes de responder nuevamente. Las filas en error muestran el código, sin guardar tokens ni respuestas completas de Meta. No se incluyen funciones para consultar gastos o datos privados; las respuestas humanas tienen una indicación permanente de esa restricción.

El correo usa un cursor de UID y deduplicación por ID Gmail/RFC para conservar la recepción pendiente entre tandas; no crea automáticamente proveedores a partir de correos nuevos. Mantiene el calendario ya existente de sincronización y permite sincronización manual desde Correos.

## Comprobaciones

`node --test supabase/tests/whatsapp-*.test.mjs` con Node 24 ejecuta 21 pruebas de flujos, firma, metadatos, ventana de atención y fallos del worker. El workflow Verificar recepción WhatsApp lo ejecuta sin mensajes reales. En el entorno de trabajo restringido: añadir `--test-isolation=none`.

`supabase/tests/whatsapp-reception.sql` verifica mediante rollback: reconocimiento, deduplicación, Bitácora/correlativo, rol cliente/terreno/jefatura/admin/superadmin, admin inactivo, takeover, bloqueo de envíos fuera de ventana, cierre independiente, reingreso, fuente de prospecto y reutilización de postulantes. No deja fixtures ni cambia perfiles de forma permanente.

Migraciones 0081–0086. Funciones: `whatsapp-webhook`, `whatsapp-worker`, `sincronizar-proveedores-gmail` (actualización de la versión que estaba desplegada). La compilación de la app se verifica en el workflow de publicación.
