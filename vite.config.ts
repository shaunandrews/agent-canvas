import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isLibrary = mode === "production";

  return {
    plugins: [react()],
    build: isLibrary
      ? {
          lib: {
            entry: resolve(__dirname, "src/lib/index.ts"),
            formats: ["es"],
            fileName: "index"
          },
          rollupOptions: {
            external: ["react", "react-dom", "react/jsx-runtime", "lucide-react"],
            output: {
              assetFileNames: "styles.css"
            }
          }
        }
      : undefined
  };
});
