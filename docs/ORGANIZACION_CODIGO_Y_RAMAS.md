# Coproactiva — Organización del repositorio

## Objetivo

Mantener nombres claros, un flujo de trabajo estable y despliegues comprobables. No renombrar carpetas indiscriminadamente: los cambios deben ser pequeños y pasar pruebas.

## Estructura existente

| Carpeta | Responsabilidad |
| --- | --- |
| `app/` | Gestión Diaria (React/Vite/PWA/Capacitor) |
| `app/src/paginas/` | Pantallas y vistas por dominio |
| `app/src/componentes/` | Componentes reutilizables |
| `app/src/lib/` | Servicios, utilidades y lógica compartida |
| `app/src/estilos/` | Tokens, reglas y componentes visuales |
| `app/pruebas/` | Pruebas automatizadas |
| `sitio/` | Sitio público de Coproactiva; NO confundir con la app |
| `supabase/` | Migraciones SQL y Edge Functions |
| `docs/` | Contratos técnicos, instrucciones y decisiones |
| `figma/` | Referencias de diseño |
| `.github/workflows/` | Validación, compilación y publicación |

## Convenciones nuevas

- Ramas: `develop` (trabajo de la app), `main` (rama histórica principal; **no modificar hasta verificar dependencias del sitio público**), `gh-pages` (solo artefactos web publicados).
- Funcionalidades: `feat/<area>-<cambio>`, por ejemplo `feat/operaciones-proveedores`.
- Correcciones: `fix/<area>-<problema>`, por ejemplo `fix/documentos-encuadre-movil`.
- Mantenimiento: `chore/<area>-<tarea>`, por ejemplo `chore/ordenar-ramas-y-despliegue`.
- Seguridad: `security/<area>-<hallazgo>`.
- Ramas efímeras terminan al integrarse; no crear nuevas variantes de `develop` con nombres aleatorios.
- Archivos React: componentes `PascalCase.jsx` y hoja CSS del mismo nombre si aplica.
- Utilidades: `camelCase.js`, agrupadas por dominio, evitando duplicar motores de correos, Drive o documentos.
- Migraciones: nombres ordenados por fecha y propósito, con compatibilidad aditiva.

## Cambio controlado de rama de desarrollo

1. Crear `develop` desde el último commit de `claude/figma-coproactiva-interface-9y82xq`; no borrar la rama antigua.
2. Cambiar en la rama `chore/ordenar-ramas-y-despliegue` los cinco workflows de GitHub Actions para que apunten a `develop`.
3. Abrir un PR hacia `develop`, revisar que el código y los workflows coincidan y ejecutar las pruebas.
4. Una vez aprobado, fusionar ese PR: el workflow `publicar-app.yml` de `develop` pasará a publicar en `gh-pages`.
5. Proteger la rama `develop` con los status checks `validar` y `UX móvil en navegador real (sin autenticación)`. No proteger `gh-pages` con reglas que impidan el push automatizado.
6. Revisar las PR antiguas #36, #44 y #55 que aún apuntan a la rama anterior; decidir individualmente si cerrarlas o reaplicarlas, sin fusionarlas automáticamente.
7. Después de comprobar al menos un despliegue desde `develop`, retirar la rama antigua y ramas de trabajo fusionadas **solo con autorización y después de validar referencias**.

## Decisiones de seguridad

- No actualizar `main` sin confirmar si alimenta el sitio público `sitio/` o Netlify.
- No modificar `gh-pages` directamente; el workflow debe compilar y publicarla.
- No cambiar los IDs de Supabase, nombres de tablas, rutas públicas ni claves de almacenamiento durante este reordenamiento.
- Mantener `docs/CONTRATO_DISENO_COPROACTIVA.md` y `AGENTS.md` como reglas de diseño y desarrollo.
- Toda reorganización de archivos que afecte imports debe ir en un PR propio con compilación, pruebas y migración controlada.

## Nomenclatura sugerida por dominios (etapa posterior)

```
app/src/
  paginas/
    comercial/
    operaciones/
    finanzas/
    configuracion/
  componentes/
    comunes/
    correos/
    documentos/
  lib/
    correos/
    documentos/
    drive/
  estilos/
```

Esta estructura es un objetivo; **no mover carpetas masivamente** sin revisar rutas React, imports, enlaces de navegación, tests, scripts de compilación y el historial de despliegue.
