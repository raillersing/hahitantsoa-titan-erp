import react from "@vitejs/plugin-react";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    testTimeout: 30000,
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "**/e2e/**",
      "playwright-report/**",
      "test-results/**"
    ],
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/api-auth": "http://127.0.0.1:8000",
    },
  },
});
