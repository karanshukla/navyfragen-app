import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";

export default defineConfig({
  plugins: [react()],
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
        "src/Theme.ts",
      ],
    },
  },
});
