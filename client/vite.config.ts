import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      // We register the SW ourselves via virtual:pwa-register in main.tsx so we
      // can keep the push-notification registration flow (and its error
      // handling) in one place.
      injectRegister: false,

      // Port of client/public/site.webmanifest. vite-plugin-pwa generates and
      // injects the manifest link, so the static file is no longer needed.
      manifest: {
        name: "Navyfragen - Anonymous question inbox for Bluesky",
        short_name: "Navyfragen",
        theme_color: "#1E1B4B",
        background_color: "#FDF8FF",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },

      // Core fix for the dev-mode interference bug (issue #193): keep the
      // service worker entirely disabled during `vite dev`. The plugin will
      // also proactively unregister any SW left over from a previous production
      // build/preview on the same origin, so a stale worker can no longer
      // intercept TanStack Query's first fetches on a fresh dev reload.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/tests/setupTests.ts"],
    exclude: [...configDefaults.exclude, "**/*.e2e.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**"],
      exclude: [
        ...(configDefaults.coverage?.exclude ?? []),
        "src/tests/**",
        "src/main.tsx",
        "src/Theme.tsx",
        "src/vite-env.d.ts",
        "src/styles/tokens.ts",
        "src/pushPayload.ts",
        "src/index.css",
      ],
    },
  },
});
