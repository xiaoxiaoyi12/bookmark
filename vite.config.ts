import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** 开发环境代理：在 Node.js 侧抓取网页，绕过浏览器 CORS 限制 */
function corsProxyPlugin(): Plugin {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const targetUrl = url.searchParams.get('url')
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Missing url parameter')
          return
        }
        try {
          const resp = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkReader/1.0)' },
          })
          if (!resp.ok) throw new Error(`上游返回 ${resp.status}`)
          const html = await resp.text()
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(html)
        } catch (err: any) {
          res.writeHead(502, { 'Content-Type': 'text/plain' })
          res.end(`抓取失败: ${err.message}`)
        }
      })
    },
  }
}

export default defineConfig({
  base: '/bookmark/',
  plugins: [react(), tailwindcss(), corsProxyPlugin()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
