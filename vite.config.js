import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { watch: { ignored: ['**/.cache/**', '**/test-results/**'] } },
  plugins: [
    {
      name: 'public-supabase-key-only',
      configResolved(config) {
        const key =
          config.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          config.env.VITE_SUPABASE_ANON_KEY ||
          ''
        let role = ''
        try {
          role = JSON.parse(
            atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
          ).role
        } catch {
          /* Modern publishable keys are not JWTs. */
        }
        if (key.startsWith('sb_secret_') || role === 'service_role')
          throw new Error(
            'A privileged Supabase key cannot be included in the frontend. Use a publishable key.',
          )
      },
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/, /^\/functions/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'FinanCerto',
        short_name: 'FinanCerto',
        description: 'Controle financeiro pessoal',
        id: '/',
        lang: 'pt-BR',
        scope: '/',
        theme_color: '#2869e8',
        background_color: '#f5f7fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
