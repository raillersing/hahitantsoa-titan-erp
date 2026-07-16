import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig(({ mode }) => {
  const backendOrigin = loadEnv(mode, ".", "").VITE_BACKEND_ORIGIN || "http://127.0.0.1:8000";

  return {
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
      "/api": backendOrigin,
      "/api-auth": backendOrigin,
    },
  },
  };
});
