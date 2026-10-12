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

**Publicación del sitio:** actualmente no se ha encontrado workflow de despliegue de web-coproactiva y el repositorio no tiene GitHub Pages habilitado. No se puede afirmar que merge en main publique automáticamente en el hosting. La automatización de despliegue requiere identificar el hosting real y conceder permisos adecuados de forma segura (sin pegar credenciales en el código ni en un chat).

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
