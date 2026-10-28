import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleRequest } from "./server/router.js";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "xenoscope-local-api",
      configureServer(server) {
        Object.assign(process.env, loadEnv(mode, process.cwd(), "QLOO_"));
        server.middlewares.use("/api", async (req, res) => {
          req.url = `/api${req.url}`;
          await handleRequest(req, res);
        });
      },
    },
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    exclude: ["node_modules/**", "e2e/**"],
  },
  build: {
    rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } },
  },
}));
