# Flujo de propuestas SEO · Coproactiva App Diaria

## Regla de producto

La pestaña **Recomendaciones** no pide que el usuario vuelva a analizar una URL: al abrirla consulta Search Console para identificar páginas asociadas a búsquedas prioritarias (máximo 12 consultas por revisión) y lee el HTML de cada URL. **Sólo agrupa búsquedas por la misma URL que entrega Google**. Si la URL no está identificada, el sistema no inventa destino ni propone publicación.

Se muestra la evidencia (consultas, impresiones, clics, CTR, posición), URL real, diagnóstico, hipótesis y comparación exacta actual/propuesto de título SEO y meta description. Las propuestas automáticas no alteran contenido comercial, H1 ni diseño.

## Estados

1. **Diagnóstico / propuesta**: fuentes directas de Google y sitio.
2. **Aprobar y preparar**: registra una propuesta en tabla seo_propuestas y, si GitHub está autorizado, crea rama y PR sobre web-coproactiva sin modificar main.
3. **Pedir ajuste / Descartar**: guarda la decisión y una observación opcional, sin tocar GitHub.
4. **Revisión final**: revisar el PR y el contenido, sólo superadmin puede publicar.
5. **Publicar**: exige escribir PUBLICAR, valida PR y comprobaciones de GitHub, integra en main, guarda SHA y fecha.
6. **Seguimiento**: conserva métricas y fecha como línea base para análisis posterior a 7, 28 y 90 días. El seguimiento comparativo automático queda pendiente de una etapa adicional; no afirmar que ya entrega esas comparativas.

«Integrado en GitHub» no garantiza que GitHub Pages ya haya desplegado el sitio. Aprobar nunca integra ni publica.

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
