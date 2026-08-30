import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { configDefaults } from "vitest/config";

import brand from "../brand.json" with { type: "json" };

// index.html can't import brand.ts (it isn't a module), so its brand text
// goes through %APP_NAME%/%APP_DOMAIN% placeholders substituted here instead
// of via Vite's built-in %VITE_*% HTML replacement — that reads from env
// vars, and brand.json is the source of truth, not the environment.
function brandHtmlPlugin(): Plugin {
  return {
    name: "brand-html-vars",
    transformIndexHtml(html) {
      return html.replaceAll("%APP_NAME%", brand.appName).replaceAll("%APP_DOMAIN%", brand.appDomain);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    brandHtmlPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // "prompt", not "autoUpdate": autoUpdate reloads the page as soon as a new
      // worker activates, which interrupts whatever the user is doing. In prompt
      // mode the registration reports the waiting worker to main.tsx, which
      // surfaces it as the header's "Update" button (see src/sw.ts).
      registerType: "prompt",
      // We register the SW ourselves via virtual:pwa-register in main.tsx so we
      // can keep the push-notification registration flow (and its error
      // handling) in one place.
      injectRegister: false,

      // Port of client/public/site.webmanifest. vite-plugin-pwa generates and
      // injects the manifest link, so the static file is no longer needed.
      manifest: {
        name: `${brand.appName} - Anonymous question inbox for Bluesky`,
        short_name: brand.appName,
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
      // istanbul, not v8: @vitest/coverage-v8 drives node:inspector's Profiler
      // domain, which Bun does not implement, so under the Bun runtime every
      // worker throws "Coverage APIs are not supported" and the run reports 0%.
      // istanbul instruments the source at transform time instead and needs no
      // V8 inspector, which is what lets the client drop Node entirely.
      // Unreachable code is suppressed with `/* istanbul ignore ... */` markers
      // (istanbul does not honor the `/* v8 ignore */` form) — see
      // docs/testing-notes.md.
      provider: "istanbul",
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
        // `*.styles.ts` modules hold CSS objects and the pure functions that
        // select between them — no behaviour, nothing an assertion could pin
        // that reading the file would not tell you more directly. Rendering
        // logic stays in the `.tsx` beside them, which is measured.
        "src/**/*.styles.ts",
        "src/pushPayload.ts",
        "src/index.css",
      ],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
