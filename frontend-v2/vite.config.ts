import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import path from "path";
import fs from "fs";

// Custom plugin to copy the required dynamic WebAssembly modules for @oqs/liboqs-js
// The library uses `import('../../../../dist/ml-kem-768.min.js')` which resolves
// to `/dist/ml-kem-768.min.js` in the browser after Rollup bundling.
function copyLibOQSFiles() {
  return {
    name: "copy-liboqs-files",
    generateBundle() {
      const liboqsDist = path.resolve(__dirname, "node_modules", "@oqs", "liboqs-js", "dist");
      // We only copy the algorithms explicitly used to avoid bloating the build (the folder is ~50MB)
      const requiredFiles = ["ml-kem-768.min.js", "ml-dsa-65.min.js"];

      if (fs.existsSync(liboqsDist)) {
        for (const file of requiredFiles) {
          const filePath = path.join(liboqsDist, file);
          if (fs.existsSync(filePath)) {
            // Emitting to 'dist/[file]' places it in 'dist/dist/[file]' in the final output
            // This perfectly matches the browser's request to 'http://localhost:4173/dist/[file]'
            this.emitFile({
              type: "asset",
              fileName: `dist/${file}`,
              source: fs.readFileSync(filePath),
            });
          }
        }
      }
    },
  };
}

export default defineConfig({
  publicDir: "public",
  plugins: [
    react(),
    wasm(),
    copyLibOQSFiles(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@oqs/liboqs-js"],
  },
  build: {
    target: "esnext",
    copyPublicDir: true,
  },
});