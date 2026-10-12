# Flujo de propuestas SEO · Coproactiva App Diaria

## Regla de producto

La pestaña **Recomendaciones** no pide que el usuario vuelva a analizar una URL: al abrirla consulta Search Console para identificar páginas asociadas a búsquedas prioritarias (máximo 12 consultas por revisión) y lee el HTML de cada URL. **Sólo agrupa búsquedas por la misma URL que entrega Google**. Si la URL no está identificada, el sistema no inventa destino ni propone publicación.

Se muestra la evidencia (consultas, impresiones, clics, CTR, posición), URL real, diagnóstico, hipótesis y comparación exacta actual/propuesto de título SEO y meta description. Las propuestas automáticas no alteran contenido comercial, H1 ni diseño.

## Estados y sincronización

1. **Aprobada**: usuario autorizó preparar el cambio.
2. **Preparada**: pull request abierto en el repositorio de la web (sin publicar).
3. **Integrada**: PR fusionado a main; NO significa que el hosting haya recibido la versión.
4. **Publicada y verificada**: la Edge Function solicita el HTML de coproactiva.cl sin caché y comprueba que coincidan exactamente título y meta descripción propuestos. La primera fecha verificada se usa como inicio conservador de medición, aunque el despliegue haya podido ocurrir antes.
5. **Seguimiento**: en la pestaña Seguimiento, Search Console compara 7, 28 y 90 días anteriores/posteriores para la MISMA URL. Ventanas parciales comparan el mismo número de días disponibles. Clics, impresiones, CTR en puntos porcentuales y posición media; no equivale a un experimento causal.

La sincronización verifica merges desde GitHub cuando hay token secreto autorizado, y verifica despliegue web incluso sin token cuando existe un merge validado en base de datos. El registro histórico #1 fue reconciliado con PR #1 del repositorio web-coproactiva tras comprobar la fusión en la API GitHub.

**Publicación del sitio:** coproactiva.cl utiliza **Netlify** con GitHub. Netlify puede desplegar automáticamente la rama principal sin GitHub Actions, pero la vinculación efectiva y los eventos de despliegue deben comprobarse con su API. Una fusión en main no demuestra por sí sola que la web esté actualizada.

## Configuración requerida

Desplegar Edge Function seo-propuestas con verify_jwt=true. Para preparar PR automáticamente configurar en secretos Supabase **COPROACTIVA_GITHUB_TOKEN**, token GitHub fine-grained limitado a franciscomorgadotobar-crypto/web-coproactiva, con Contents Read/Write, Pull requests Read/Write y Checks Read. No publicar tokens en frontend, chat ni GitHub.

Sin token GitHub la decisión permanece guardada como aprobada y el PR pendiente; la app lo informa explícitamente.

## Seguridad

- Roles admin y superadmin activos: diagnosticar y registrar. Sólo superadmin: publicar.
- RLS sin políticas de acceso directo a propuestas; Edge Function protegida usa servicio.
- Sólo rutas HTML permitidas del sitio; no recursos JavaScript/CSS arbitrarios ni dominios externos.
- Verifica el título y la descripción vigentes en main antes de escribir un PR, evitando publicar sobre información obsoleta.
- Mantiene HTML intacto salvo título y meta description.
- Confirmación final manual mediante texto PUBLICAR; revisión de PR, rama, mergeability y verificaciones.
- Íconos del mockup recreados en SVG con acentos naranja suave.

## Pruebas

1. Dos consultas apuntan a una URL: una recomendación y ambas métricas agrupadas.
2. Consulta sin URL confirmada: no inventar página ni permitir aprobación.
3. Sin token: aprobación persistida sin crear PR.
4. Con token: rama y PR sin alterar main.
5. Cambio en main desde el diagnóstico: detener preparación por HTML obsoleto.
6. Admin no publica; superadmin necesita confirmar PUBLICAR.
7. Verificar móvil, contraste, botones, compilación y tests.

## Integración Netlify (sin GitHub Actions adicionales)

1. Acceder al proyecto correcto en Netlify, en **Project configuration → Build & deploy → Continuous deployment**. Verificar que el repositorio conectado sea `franciscomorgadotobar-crypto/web-coproactiva`, que la rama de producción sea `main`, que los despliegues automáticos estén habilitados y que la carpeta de publicación sea la raíz del sitio estático (o su ruta real de salida). No cambiar el repositorio de la **app** por el de la **web**.
2. Crear un token personal de acceso de Netlify con el menor alcance disponible para ese proyecto. Guardarlo en **Supabase → Edge Functions → Secrets** como `NETLIFY_ACCESS_TOKEN`. Nunca enviarlo por chat ni añadirlo a archivos GitHub. Opcional: configurar `NETLIFY_SITE_ID` con el Project ID real de Netlify. Si está ausente se intentará resolver el proyecto mediante `www.coproactiva.cl`.
3. La Edge Function `seo-propuestas` utiliza Netlify API para consultar los **últimos deploys de producción**, rama conectada, repositorio, SHA del último despliegue y estado. No se confunde `ready` con SEO publicado: debe comprobar que el HTML real de `www.coproactiva.cl` entrega el `<title>` y la meta descripción aprobados.
4. Si el PR está fusionado pero no publicado, la pestaña **Seguimiento** indica el diagnóstico de Netlify. Sólo los superadministradores pueden solicitar reconstruir la rama `main`, escribiendo `DESPLEGAR`. Esta acción usa `POST /sites/{site_id}/builds` y **sólo está habilitada si la API verificó el repositorio y rama correctos**. No se realiza automáticamente.
5. Cuando la web finalmente muestra los textos propuestos, se registra la primera verificación y comienza el seguimiento Search Console a 7/28/90 días. La fecha registrada es de comprobación, no una suposición acerca del inicio real del despliegue.

### Señales de problemas
- API Netlify 401: token no autorizado; 404: sitio equivocado o sin acceso.
- `repoCorrecto = false` o `ramaCorrecta = false`: no relanzar, primero corregir conexión del proyecto Netlify.
- Último deploy `error` o en `building`: revisar registro de compilación en Netlify.
- Netlify indica `ready`, pero HTML público aún es anterior: revisar dominio personalizado, branch de producción, configuración de publicación, caché, redirecciones o si la última versión corresponde a otro commit.

Las credenciales de Netlify y GitHub se configuran **por separado**; la conexión a GitHub que utiliza este chat no se transfiere automáticamente a la aplicación.