import tailwindcss from "@tailwindcss/vite";
import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  optimizeDeps: { exclude: ["maplibre-gl"] },
  plugins: [mdx(), tailwindcss(), react()],
});
