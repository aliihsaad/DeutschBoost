# App Icons

DeutschBoost icons are generated from the root `app-icon.svg` master.

The icon uses a German `ß` inside a speech bubble with a small German flag accent, matching the local-first German speaking tutor direction.

Important outputs:

- `src-tauri/icons/*` for the desktop installer, app window, and platform bundles.
- `public/favicon.svg` and `public/favicon.ico` for browser tabs.
- `public/pwa-192x192.png`, `public/pwa-512x512.png`, and `public/apple-touch-icon.png` for install surfaces.
- `public/app-icon.svg`, `public/icon-192.svg`, `public/icon-512.svg`, `public/pwa-192x192.svg`, and `public/pwa-512x512.svg` for scalable web usage.

Regenerate native icons with:

```bash
npm run tauri -- icon app-icon.svg
```
