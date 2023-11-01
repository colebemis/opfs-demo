import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Fixes isomorphic-git Buffer error
    // https://github.com/isomorphic-git/isomorphic-git/issues/1753
    nodePolyfills(),
  ],
});
