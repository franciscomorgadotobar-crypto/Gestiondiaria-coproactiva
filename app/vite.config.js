import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/* `base`: la app se publica en la raíz de https://app.coproactiva.cl/ (GitHub
 * Pages con dominio propio, ver public/CNAME), así que por defecto es '/'. Se
 * pasa por variable para publicarla bajo una subcarpeta, como
 * github.io/<repositorio>/: ahí, sin ella, la página carga en blanco porque
 * busca /assets/... en la raíz del dominio. */
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['iconos/favicon-64.png', 'logo-coproactiva.svg'],

      manifest: {
        name: 'CoproActiva — Levantamiento en terreno',
        short_name: 'CoproActiva',
        description:
          'Levantamiento técnico de comunidades: recorrido por categorías, fotos con pie y ' +
          'generación del informe. Funciona sin señal.',
        lang: 'es-CL',
        start_url: base,
        scope: base,
        display: 'standalone',
        // En terreno el teléfono se sostiene con una mano mientras la otra abre
        // una puerta o sujeta una linterna. Nunca se usa horizontal.
        orientation: 'portrait',
        background_color: '#f7f4f0',
        theme_color: '#2b3138',
        icons: [
          { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          // Android recorta el icono a la forma del lanzador; el maskable trae
          // el margen que necesita para no quedar cortado.
          { src: 'iconos/icono-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },

      workbox: {
        // Todo el shell entra al precache, tipografías incluidas: si la primera
        // pantalla en un subterráneo aparece sin fuentes, la app se ve rota.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,ttf,otf,woff2}'],
        // Montserrat variable pesa 688 KB y el bundle 400 KB. El tope por
        // defecto (2 MiB) alcanza, pero deja poco margen para crecer.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        // Las llamadas a Supabase NO se cachean a propósito. El trabajo sin
        // señal lo resuelve la cola en IndexedDB, que sabe qué está pendiente
        // de subir. Una respuesta cacheada mostraría datos viejos como si
        // fueran actuales, que es peor que no mostrar nada.
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],
        cleanupOutdatedCaches: true
      },

      devOptions: { enabled: false }
    })
  ],
  server: { port: 5173 }
});
