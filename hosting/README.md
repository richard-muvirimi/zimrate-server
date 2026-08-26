# ZimRate — web app

React 19 + Vite 8 + MUI 7 single-page app serving both the public site and the `/admin` dashboard.

Project-wide setup, deployment and API documentation live in the [root readme](../readme.md).
This file covers only what is specific to this package.

## Commands

```bash
npm run dev      # dev server; proxies /api to the deployed API
npm run build    # tsc -b && vite build
npm run lint     # eslint (runs as a deploy predeploy hook)
npm run preview  # serve the production build locally
```

## Layout

| Path | Contents |
| --- | --- |
| `src/pages/` | Public routes |
| `src/sections/` | Landing page sections |
| `src/components/` | Shared UI |
| `src/admin/` | Admin dashboard — pages, hooks, components |
| `src/theme/` | Theme presets and the preset store |
| `src/hooks/` | Cross-cutting hooks |

## Two constraints worth knowing before you edit

**The public bundle must stay Firebase-free.** Nothing outside `src/admin/` and `src/firebase.ts`
may import `firebase/*`. That isolation is what keeps the Firebase SDK off the landing page —
importing `adminFetch`, `firebase.ts`, or anything under `src/admin/` from a public page silently
adds hundreds of kilobytes to every visit. Public pages that need server data use `/api` instead;
branding is read that way for exactly this reason.

Verify after any change to imports:

```bash
npm run build
for f in $(grep -o 'assets/[A-Za-z0-9_-]*\.js' dist/index.html | sort -u); do
  grep -qE "@firebase|RedocStandalone|ApolloSandbox" "dist/$f" && echo "LEAK: $f"
done
```

**Firestore `orderBy` silently drops documents missing the sorted field.** This has already
caused a list to render empty with no error. Prefer sorting client-side for small collections;
where a server-side sort is required, make sure the field is written on every document.

## Theming

`src/theme/presets.ts` holds named palettes, each supplying a full light and dark scheme. Presets
are typed through an explicit interface rather than MUI's `PaletteOptions`, because `code.*` is
optional there — a preset missing it would compile and then crash at runtime.

The selected preset is read synchronously from `localStorage` so the theme is correct on first
paint; Firestore only corrects it afterwards, from inside the admin chunk.
