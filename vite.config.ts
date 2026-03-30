import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/** 开发环境代理：在 Node.js 侧抓取网页，绕过浏览器 CORS 限制 */
function corsProxyPlugin(): Plugin {
  return {
    name: "cors-proxy",
    configureServer(server) {
      server.middlewares.use("/api/proxy", async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing url parameter");
          return;
        }
        try {
          const resp = await fetch(targetUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; BookmarkReader/1.0)",
            },
          });
          if (!resp.ok) throw new Error(`上游返回 ${resp.status}`);
          const html = await resp.text();
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(html);
        } catch (err: any) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end(`抓取失败: ${err.message}`);
        }
      });
    },
  };
}

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
  base: isTauri ? "/" : "/bookmark/",
  plugins: [
    react(),
    tailwindcss(),
    corsProxyPlugin(),
    ...(isTauri
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            devOptions: { enabled: true },
            workbox: {
              globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
              navigateFallback: "index.html",
              navigateFallbackAllowlist: [/^\/bookmark\//],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                  handler: "CacheFirst",
                  options: {
                    cacheName: "cdn-cache",
                    expiration: {
                      maxEntries: 50,
                      maxAgeSeconds: 30 * 24 * 60 * 60,
                    },
                  },
                },
              ],
            },
            manifest: {
              name: "Bookmark Reader",
              short_name: "Bookmark",
              description:
                "支持 EPUB / PDF / 网页阅读，带 AI 助手的离线阅读器",
              theme_color: "#8b6914",
              background_color: "#faf6f0",
              display: "standalone",
              scope: "/bookmark/",
              start_url: "/bookmark/",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
            },
          }),
        ]),
  ],
  server: {
    proxy: {},
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
});
