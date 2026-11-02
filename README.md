# Coproactiva — Gestión Diaria

Aplicación web y móvil para la gestión comercial, operativa, financiera y documental de Coproactiva Administración SpA.

**Aplicación:** https://app.coproactiva.cl  
**Sitio público:** https://www.coproactiva.cl

## Dónde está cada cosa

| Carpeta | Contenido |
| --- | --- |
| [app](app/) | Aplicación React / Vite, PWA y configuración Android |
| [app/src/paginas](app/src/paginas/) | Pantallas de los módulos |
| [app/src/componentes](app/src/componentes/) | Componentes reutilizables |
| [app/src/lib](app/src/lib/) | Utilidades y servicios compartidos |
| [app/pruebas](app/pruebas/) | Pruebas automatizadas y de UX |
| [supabase](supabase/) | Base de datos, migraciones y funciones |
| [sitio](sitio/) | Sitio web institucional |
| [figma](figma/) | Material de diseño |
| [docs](docs/) | Arquitectura, contratos y convenciones |

## Ramas y despliegue

- `develop`: rama de trabajo de Gestión Diaria.
- `feat/*`, `fix/*`, `chore/*`: cambios aislados; mediante pull request a `develop`.
- `gh-pages`: versión compilada de la aplicación; no editar manualmente.
- `main`: rama histórica predeterminada; no actualizarla automáticamente hasta auditar las dependencias del sitio público.

**Migración en curso:** se mantiene intacta la rama anterior `claude/figma-coproactiva-interface-9y82xq` hasta confirmar que GitHub Actions valida y publica correctamente desde `develop`.

## Reglas para cambiar código

Lee primero [el contrato de diseño](docs/CONTRATO_DISENO_COPROACTIVA.md), [la organización técnica](docs/ORGANIZACION_CODIGO_Y_RAMAS.md) y [las instrucciones para asistentes](AGENTS.md).

Los cambios de interfaz deben pasar `validar` y `UX móvil en navegador real (sin autenticación)`, incluidos los controles del Gestor Documental. No reorganizar carpetas funcionales mediante movimientos masivos sin ajustar imports, rutas y pruebas.
