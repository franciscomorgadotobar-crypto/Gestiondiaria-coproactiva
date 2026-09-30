# Funciones edge

    _compartido/correo.ts   plantillas y envío por SMTP — fuente única
    equipo/index.ts         alta y mantención de usuarios (exige sesión)
    acceso/index.ts         pedir un enlace nuevo sin sesión (público, con límite)

`correo.ts` vive una sola vez. Al desplegar hay que copiarlo dentro de cada
función, porque el despliegue sube archivos planos y no resuelve `../`:

    node supabase/armar.mjs      # deja los paquetes en supabase/.armado/

Después se sube el contenido de cada carpeta. `.armado/` no se versiona: es
producto de la copia, y editarlo ahí perdería el cambio en la próxima corrida.

## La dirección de la app en los enlaces

Los enlaces de los correos apuntan al secreto `URL_APP` de las funciones o, si
no está definido, a `https://app.coproactiva.cl/`. Si la app cambia de
dirección hay que cambiar ambos y volver a desplegar las dos funciones: un
enlace a una dirección vieja llega bien al correo y falla recién al abrirlo.

## El logotipo del correo

`_compartido/logo.ts` lleva el logotipo en PNG ya codificado, y `enviar` lo
adjunta en línea para que el HTML lo pida con `cid:logo`. Si cambia el
logotipo del sitio, se regenera con:

    node supabase/logo.mjs

Al desplegar a mano (pegando el contenido en vez de usar el CLI de Supabase)
conviene comprobar que ese base64 llegó entero: `decode(..., 'base64')` en la
base falla si viene roto, y el sha256 del resultado tiene que coincidir con
`sha256sum supabase/functions/_compartido/logo.png`. Con el CLI el archivo
viaja desde el disco y el problema no existe.
