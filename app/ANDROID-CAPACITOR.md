# Coproactiva App Diaria · Android con Capacitor

## Qué entrega esta integración

Se mantiene la web React/Vite en https://app.coproactiva.cl y se incorpora Capacitor 8 para generar una **APK de prueba** que incluye el contenido web compilado.

- Identificador Android: cl.coproactiva.appdiaria.
- Nombre: Coproactiva App Diaria.
- Iconos adaptativos: isotipo oficial naranja y fondo blanco cálido.
- Splash: imagologo corporativo, blanco cálido y barra web existente.
- Atrás nativo: historial de React Router y Home autorizado por rol.
- WebView con bundle local, sin URL externa de contenido.
- Copias de seguridad del almacenamiento de la app desactivadas; HTTP no cifrado desactivado.

**La APK no se actualiza cuando se publica una nueva versión web.** Hay que compilar/distribuir otra APK o actualizar en Google Play. La APK y la PWA Chrome guardan sesiones y datos locales separados.

## Compilación GitHub Actions

1. En Gestiondiaria-coproactiva abrir Actions.
2. Elegir Construir APK Android con Capacitor.
3. Abrir una ejecución exitosa de la rama principal de desarrollo.
4. En Artifacts descargar el ZIP llamado coproactiva-apk-debug-N.
5. Extraer app-debug.apk y copiarlo al teléfono. Confirmar la instalación desde archivos descargados.
6. Iniciar sesión con cuenta de prueba y verificar la operación.

El flujo prepara Node.js 22, Java 21, Android SDK 36, instala dependencias, compila React, genera la plataforma Android, sincroniza assets y construye assembleDebug de Gradle.

**La APK debug no es apta para Google Play**, y las distintas compilaciones GitHub pueden usar certificados de debug diferentes. Para instalar otra compilación sobre la anterior puede ser necesario desinstalar primero. Desinstalar elimina los datos locales: subir y verificar todo levantamiento pendiente antes.

## Compilar desde Android Studio

Requisitos: Node.js 22+, JDK 21, Android Studio y Android SDK 36.

Desde la carpeta app ejecutar:

1. npm install
2. CAPACITOR_BUILD=true npm run build
3. npx cap add android (primera vez)
4. npx cap sync android
5. npm run android:icons
6. cd android
7. ./gradlew assembleDebug (en Windows usar gradlew.bat)

Archivo: app/android/app/build/outputs/apk/debug/app-debug.apk.

En compilaciones siguientes basta con npm run android:sync (con CAPACITOR_BUILD=true), actualizar iconos si corresponde y compilar Gradle.

Esta primera fase genera el proyecto Android dentro del flujo CI; una versión posterior puede versionar los archivos nativos para personalizaciones adicionales y la preparación de Google Play.

## Validación obligatoria en Android real

Probar: Home según permisos, gesto Atrás, inicio/cierre de sesión, cámaras/fotografías, adjuntos, PDFs, geolocalización, notificaciones, controles de levantamiento, subida sin conexión y sincronización al recuperar internet. El bundle funciona sin red, pero Supabase requiere conexión para autenticar y sincronizar.

No distribuir masivamente hasta completar estas pruebas. Para Google Play, preparar AAB firmado con clave de producción protegida fuera de GitHub, identidad del desarrollador y ficha legal.

La configuración Supabase de compilación utiliza URL pública y anon key presentes ya en el workflow web. **Nunca incluir service_role ni claves de firma de producción** en el APK o en el repositorio. Los permisos efectivos deben seguir protegidos por RLS y validaciones en Supabase.
