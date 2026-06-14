import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/",
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
      "/prometheus": "http://localhost:8080"
    }
  },
  build: {
    target: "es2022",
    outDir: "dist"
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // no custom elements needed after removing MDS web components
        }
      }
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
