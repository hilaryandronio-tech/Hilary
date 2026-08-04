import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Manifest lives as a static file at public/manifest.webmanifest (provided by
// the design handoff, referenced directly from index.html) — VitePWA here only
// generates the service worker and caches it, it does not manage the manifest.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      manifest: false,
      injectRegister: "auto",
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
    }),
  ],
});
