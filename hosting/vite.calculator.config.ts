import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The offline calculator — a second, self-contained build served at /calculator/.
 *
 * Deliberately separate from vite.config.ts rather than another route in the SPA:
 *
 *  - Service worker scope. A worker at the site root would control the whole
 *    site. Building into dist/calculator puts it at /calculator/sw.js, whose
 *    scope is exactly this app. That is also why the app lives at /calculator/
 *    WITH the trailing slash — a page at /calculator sits outside that scope.
 *  - Precaching. vite-plugin-pwa precaches its build output, so a shared build
 *    would precache the marketing site and the 1.18MB developer-docs chunk.
 *
 * None of the graphql/Apollo dedupe and chunking from vite.config.ts is repeated
 * here: this app talks to the REST API with fetch and never loads Apollo.
 */

/**
 * Flags precached for offline use — the base currency, the local ones, and the
 * currencies of Zimbabwe's main trading partners. Every other flag is fetched
 * and cached the first time it is seen, so an unusual currency works offline
 * from its second view onward.
 */
const CORE_FLAGS = 'us,zw,za,gb,eu,bw,zm,mz,cn,ae,in,au,ca,jp,ch,na,mw,tz,ke'

/**
 * Stages flag-icons' SVGs into calculator/public so they are served from our own
 * origin as one cacheable file per country — the package's own entry point is a
 * CSS sprite, which a service worker cannot cache a country at a time.
 *
 * They land in public/ rather than being emitted during the bundle because three
 * things need to see them as ordinary files: the dev server, the build copy, and
 * Workbox's precache glob. The directory is gitignored.
 *
 * Runs from buildStart so it covers `vite dev` and `vite build` alike, with no
 * npm pre-hook to forget or bypass.
 */
function flagAssets(): Plugin {
  return {
    name: 'zimrate-flag-assets',
    buildStart() {
      const from = resolve(process.cwd(), 'node_modules/flag-icons/flags/4x3')
      const to = resolve(process.cwd(), 'calculator/public/flags')

      cpSync(from, to, { recursive: true })
      this.info(`staged ${readdirSync(to).length} flags`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiOrigin = env.VITE_PUBLIC_API_ORIGIN || 'https://zimrate.tyganeutronics.com'

  const apiProxy = {
    '/api': {
      target: env.VITE_DEV_API_TARGET || apiOrigin,
      changeOrigin: true,
      secure: true,
    },
  }

  return {
    root: 'calculator',
    base: '/calculator/',
    plugins: [
      react(),
      flagAssets(),
      VitePWA({
        // The manifest is a real file in calculator/public so the same document
        // works in dev, where the plugin does not generate one.
        manifest: false,
        registerType: 'autoUpdate',
        workbox: {
          // Flags are excluded wholesale, then the core set is added back —
          // precaching all 271 would push ~2.2MB at every install.
          globPatterns: [
            `**/*.{js,css,html,woff2}`,
            `*.png`,
            `flags/{${CORE_FLAGS}}.svg`,
          ],
          navigateFallback: '/calculator/index.html',
          runtimeCaching: [
            {
              urlPattern: /\/calculator\/flags\/[a-z-]+\.svg$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'zimrate-flags',
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
          // Rates are persisted by the app itself (see calculator/store), which is
          // the durable copy — there is no API caching here on purpose.
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { proxy: apiProxy },
    // The same proxy for `vite preview`, which is the only way to exercise the
    // service worker locally — it is disabled in dev.
    preview: { proxy: apiProxy },
    build: {
      outDir: '../dist/calculator',
      emptyOutDir: true,
    },
  }
})
