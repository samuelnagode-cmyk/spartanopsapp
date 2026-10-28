// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [VitePWA({
    strategies: "generateSW",
    filename: "sw.js",
    outDir: "dist/client",
    manifest: false,
    injectRegister: null,
    registerType: "autoUpdate",
    devOptions: { enabled: false },
    includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"],
    workbox: {
      globPatterns: ["**/*.{js,css}"],
      navigateFallback: undefined,
      cleanupOutdatedCaches: true,
      runtimeCaching: [{
        urlPattern: ({ request, url }) => request.mode === "navigate" && url.origin === self.location.origin && !/^\/(?:~oauth|api|_server|auth)(?:\/|$)/.test(url.pathname) && ["/spartanops", "/misija", "/join", "/field"].includes(url.pathname),
        handler: "NetworkFirst",
        options: {
          cacheName: "spartanops-pages",
          networkTimeoutSeconds: 5,
          cacheableResponse: { statuses: [200] },
          expiration: { maxEntries: 12, maxAgeSeconds: 24 * 60 * 60 },
        },
      }, {
        urlPattern: ({ url }) => url.origin === self.location.origin && /^\/assets\/.+-[\w-]{8,}\.(?:js|css|webp|png|jpg|woff2)$/.test(url.pathname),
        handler: "CacheFirst",
        options: { cacheName: "spartanops-assets", expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } },
      }],
    },
  })],
});
