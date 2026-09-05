import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const paquet = JSON.parse(readFileSync("./package.json", "utf8"));

// Le commit exact qui tourne. Sur Vercel il est fourni en variable
// d'environnement ; en local on le demande à git. Jamais d'échec de build
// pour ça : sans dépôt, on affiche « local ».
const commit = (() => {
  const surVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (surVercel) return surVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "local";
  }
})();

// Manifest lives as a static file at public/manifest.webmanifest (provided by
// the design handoff, referenced directly from index.html) — VitePWA here only
// generates the service worker and caches it, it does not manage the manifest.
export default defineConfig({
  // Figés à la compilation : l'équipe travaille sur trois téléphones qui se
  // mettent à jour chacun à leur rythme, et « ferme et rouvre l'application »
  // est un conseil invérifiable tant que rien n'affiche la version en place.
  define: {
    __VERSION__: JSON.stringify(paquet.version),
    __COMMIT__: JSON.stringify(commit),
    __DATE_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
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
