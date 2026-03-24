import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Saat dev: /compare → http://localhost:8000/compare
      // Ini menghindari CORS issue saat development
      "/compare": "http://localhost:8000",
      "/health":  "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
