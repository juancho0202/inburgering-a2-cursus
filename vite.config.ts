import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";
import { coursePlugin } from "./scripts/vitePluginCourse";

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    coursePlugin(),
    // Installable and works offline (everything except Claude). New versions install themselves in the background.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Inburgering A2",
        short_name: "Inburgering",
        description: "Oefen Lezen, KNM en Schrijven voor het inburgeringsexamen (A2).",
        lang: "nl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#14171b",
        theme_color: "#e8710a",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The app, the course and the lazy chunks are stored up front. The background photos are not
        // (they are big): each one is kept the first time it is shown.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["**/bg*.jpg", "**/tulips*.jpg"],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.jpg$/,
            handler: "CacheFirst",
            options: { cacheName: "backgrounds", expiration: { maxEntries: 15 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
        navigateFallback: "/index.html",
        // Anthropic calls (BYOK) must always go to the network.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
