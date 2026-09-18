import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// To develop the local UI with HMR, run `i18kit open --no-open --port 4173` in a
// project and start vite with I18KIT_API_URL=http://127.0.0.1:4173, then open the
// printed link on the vite origin (swap the host/port, keep the #code=… part).
const apiTarget = process.env.I18KIT_API_URL;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    nodePolyfills({ include: ["buffer", "stream", "util", "string_decoder"] }),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],

  server: {
    proxy: apiTarget
      ? {
          "/api": {
            target: apiTarget,
            // The CLI server only accepts its own Host/Origin.
            changeOrigin: true,
            configure: (proxy) =>
              proxy.on("proxyReq", (req) => req.setHeader("origin", apiTarget)),
          },
        }
      : undefined,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
