import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/compare": "http://backend:8000",
      "/health":  "http://backend:8000",
      "/auth":    "http://backend:8000",
      "/admin":   "http://backend:8000",
      "/analyze": "http://backend:8000",
      "/valuation":"http://backend:8000",
      "/inspection": "http://backend:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
