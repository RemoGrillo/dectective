import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:4410", "/sparql": "http://localhost:4410", "/portraits": "http://localhost:4410" } },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 1200 },
});
