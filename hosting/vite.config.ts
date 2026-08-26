import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiOrigin = env.VITE_PUBLIC_API_ORIGIN || 'https://zimrate.tyganeutronics.com'

  return {
    plugins: [react()],
    // `graphql` has circular internal imports. If the bundler splits it across
    // chunks, its modules get lazy initialisers and `print()` runs before
    // printDocASTReducer is assigned — every query then fails with
    // "Cannot read properties of undefined (reading 'Name')". Keeping graphql
    // and @apollo/client resolved once and pre-bundled together avoids that.
    resolve: {
      dedupe: ['graphql', '@apollo/client', 'react', 'react-dom'],
      // Force the CJS entry. graphql's ESM build (index.mjs) has circular
      // imports that Rolldown wraps in lazy initialisers; printer.mjs then runs
      // before printDocASTReducer is assigned, so every print() — and therefore
      // every Apollo query — dies with "Cannot read properties of undefined
      // (reading 'Name')". The CJS build's require cycles evaluate correctly.
      alias: [{ find: /^graphql$/, replacement: 'graphql/index.js' }],
    },
    optimizeDeps: {
      include: ['graphql', '@apollo/client', '@apollo/client/react'],
    },
    server: {
      // Proxy /api/* to the deployed API so `vite` serves the same data as the
      // hosted site. Override with VITE_DEV_API_TARGET to point somewhere else.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || apiOrigin,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Rolldown's current chunking API. `manualChunks` / `advancedChunks`
          // are deprecated in the Rolldown version Vite 8 bundles.
          //
          // These groups are tuning, not correctness: the React.lazy boundaries
          // in App.tsx are what actually keep redoc, @apollo/sandbox and the
          // Firebase SDK off the landing page. The groups just give the shared
          // vendor code stable, recognisable names.
          //
          // Regexes use [\\/] because this repo is developed on Windows.
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                priority: 40,
              },
              {
                // @mui/icons-material is deliberately excluded: icons are imported
                // per-icon, so leaving them ungrouped lets each land in the chunk
                // of the route that uses it rather than one shared blob.
                name: 'mui-vendor',
                test: /node_modules[\\/](@mui[\\/](material|system|utils|base|private-theming|styled-engine)|@emotion)[\\/]/,
                priority: 35,
              },
              {
                // graphql must not be split across chunks: its modules are
                // circular, and a split leaves printDocASTReducer uninitialised
                // when Apollo calls print(), failing every query with
                // "Cannot read properties of undefined (reading 'Name')".
                // Keeping it with @apollo/client in one chunk fixes the order.
                // Matched explicitly, never @apollo[\\/] broadly, or
                // @apollo/sandbox would land on the landing page too.
                name: 'apollo-vendor',
                test: /node_modules[\\/](@apollo[\\/]client|graphql|@wry|optimism|ts-invariant|rehackt|zen-observable|rxjs)[\\/]/,
                priority: 35,
              },
              {
                name: 'firebase-core',
                test: /node_modules[\\/]@firebase[\\/](app|util|component|logger|app-check)[\\/]/,
                priority: 30,
              },
              {
                // Split from firestore so /admin/login doesn't pull the much
                // larger Firestore SDK just to sign in.
                name: 'firebase-auth',
                test: /node_modules[\\/]@firebase[\\/]auth/,
                priority: 30,
              },
              {
                name: 'firebase-firestore',
                test: /node_modules[\\/]@firebase[\\/]firestore/,
                priority: 30,
              },
              // No groups for redoc / @apollo/sandbox either. Both are imported
              // only by the lazy DevelopersPage, so automatic splitting already
              // keeps them off the landing page — whereas naming them pulled
              // shared modules into a chunk the entry imported statically.
              // No groups for src/admin/**: forcing app code into named shared
              // chunks made the entry chunk import them statically, which dragged
              // the Firebase SDK back onto the landing page. The React.lazy
              // boundaries in App.tsx already split the admin area correctly.
            ],
          },
        },
      },
    },
  }
})
