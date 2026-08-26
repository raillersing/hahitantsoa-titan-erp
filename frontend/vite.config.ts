import react from "@vitejs/plugin-react";
import { loadEnv, type ProxyOptions } from "vite";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig(({ mode }) => {
  const backendOrigin = loadEnv(mode, ".", "").VITE_BACKEND_ORIGIN || "http://127.0.0.1:8000";
  const backendProxy: ProxyOptions = {
    target: backendOrigin,
    changeOrigin: true,
    configure(proxy) {
      const eventProxy = proxy as unknown as {
        on: (event: "proxyReq", listener: (proxyRequest: { removeHeader: (name: string) => void }) => void) => void;
      };
      eventProxy.on("proxyReq", (proxyRequest) => {
        // The browser origin is the Vite dev port, which is not the Django
        // origin. The CSRF token remains mandatory; omit only the forwarded
        // origin metadata so Django validates the token instead of rejecting
        // an otherwise same-origin request made through the local proxy.
        proxyRequest.removeHeader("origin");
        proxyRequest.removeHeader("referer");
      });
    },
  };

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
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": backendProxy,
      "/api-auth": backendProxy,
    },
  },
  };
});
