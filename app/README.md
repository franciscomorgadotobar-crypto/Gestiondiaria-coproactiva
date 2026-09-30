# App CoproActiva

Aplicación de administración de comunidades: React + Vite sobre Supabase.

Es un proyecto aparte del generador de propuestas (`sitio/`), que sigue
funcionando igual y no se tocó.

## Levantar en local

```bash
cd app
npm install
cp .env.example .env      # completar con las credenciales del proyecto Supabase
npm run dev
```

Las dos variables son públicas por diseño: la clave `anon` no da acceso a nada
que las políticas de RLS no permitan. La clave `service_role` no va acá ni en
ningún archivo que llegue al navegador.

El proyecto conectado es `vnjqzpbtcccpnxngoqfx`; la URL y la clave `anon` están
en el panel de Supabase, en *Project Settings → API*.

Sin credenciales la app arranca igual y muestra el aviso en la pantalla de
ingreso, en vez de quedar en blanco.

## Desplegar en Netlify

El sitio es **coproactiva-app**
(`https://app.netlify.com/projects/coproactiva-app`), distinto del sitio del
generador de propuestas. Está enlazado a este repositorio con **base directory
`app`**; el build y el publish los toma de `app/netlify.toml`
(`npm run build` → `dist`).

El redirect `/*` → `/index.html` ya está configurado: sin él, entrar directo a
`/control/<id>` daría 404.

### Dos cosas que cuestan un deploy si no se saben

**Enlazar el repositorio borra las variables de entorno.** Si las cargas antes de
enlazar, desaparecen. Hay que cargarlas después y volver a desplegar.

**Vite incrusta las variables al compilar, no al cargar la página.** Cambiar una
variable en Netlify no cambia el sitio publicado: hay que reconstruir. Si la app
muestra "Falta configurar la conexión con Supabase" después de haberlas cargado,
es que el build es anterior a las variables.

## Qué hay construido

| Ruta | Pantalla |
|---|---|
| `/ingreso` | Autenticación con correo y contraseña |
| `/` | Inicio de terreno: controles asignados con su avance |
| `/control/:id` | Formulario de control con check-in geolocalizado |
| `/propiedades` | Arriendos y ventas del sitio (área Propiedades) |
| `/propiedades/nueva`, `/propiedades/:id` | Ficha de una propiedad: datos, fotos y publicación |

**Propiedades alimenta www.coproactiva.cl/propiedades.** El sitio lee la tabla
`propiedades` directo con la clave pública, así que guardar en la app ya es
publicar: no hay que volver a subir el sitio. RLS solo le entrega las
publicadas y sus columnas públicas; propietario, contacto, dirección exacta y
notas internas no salen de la app. Las fotos se comprimen en el navegador
(1600 px y una miniatura de 640 px) y van al bucket público `propiedades`. La
usan superadmin, admin y jefatura; eliminar es solo de administración.

La sección completa se enciende y apaga desde el listado ("Mostrar en el
sitio" / "Ocultar del sitio", solo administración; tabla `secciones_sitio`).
Parte apagada: el sitio no muestra Propiedades en el menú y la base no entrega
propiedades a la clave pública, aunque estén publicadas.

El diseño sale de `figma/` y usa los mismos valores del generador de propuestas:
padding 9/10 en campos, 11/12 en botones, tracking .16em en etiquetas, radio 2px.
No son aproximaciones.

## Tres decisiones que conviene conocer

**Los cambios se pintan antes de guardarse.** Al marcar un ítem del checklist la
interfaz responde de inmediato y el guardado va en segundo plano. En terreno la
conexión es mala y esperar al servidor por cada toque haría el formulario
inusable. Si el guardado falla, el cambio se revierte y aparece el aviso.

**El check-in guarda la precisión del GPS.** Un check-in con precisión de 500
metros no prueba que alguien estuvo en el lugar, así que el dato se conserva tal
cual y la vista web lo muestra.

**No se puede enviar un control incompleto ni sin check-in.** El botón queda
bloqueado y dice cuántos ítems faltan. Un control a medias enviado como completo
es peor que uno sin enviar.

## Estructura

```
src/
  lib/supabase.js      cliente
  lib/sesion.jsx       contexto de sesión con el perfil y el rol
  estilos/tokens.css   colores, tipografías y radios de marca
  estilos/base.css     componentes: botones, campos, chips, selector
  paginas/             pantallas
```

Los tokens están en tres lugares que deben cambiar juntos: `sitio/styles.css`,
las variables del archivo de Figma y `app/src/estilos/tokens.css`.

## Qué falta

- Subida de fotos a Supabase Storage: la tabla `adjuntos` y sus políticas ya
  están, la interfaz no.
- Registro de hallazgos como pantalla propia (hoy la nota del ítem cumple ese rol).
- Generación de órdenes de trabajo desde un hallazgo.
- Toda la cara web: supervisión, bandeja de controles, detalle, CRM y contratos.
- Funcionamiento sin conexión. Hoy la app necesita señal; en subterráneos no la
  hay, y ese es justamente donde se registran los hallazgos críticos.
