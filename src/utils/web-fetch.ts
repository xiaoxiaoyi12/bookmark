import { Readability } from '@mozilla/readability'

export interface WebContent {
  title: string
  author: string
  content: string       // 提取后的 HTML 正文
  excerpt: string
  coverUrl?: string     // og:image
}

/**
 * 抓取网页 HTML
 * - 开发环境：通过 Vite 本地代理（Node.js 侧抓取，无 CORS 问题）
 * - 生产环境：通过 allorigins 公共代理
 */
async function fetchHtml(url: string): Promise<string> {
  // 开发环境使用本地代理
  if (import.meta.env.DEV) {
    const resp = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`)
    if (!resp.ok) {
      const msg = await resp.text().catch(() => '')
      throw new Error(msg || `代理请求失败 (${resp.status})`)
    }
    return resp.text()
  }

  // 生产环境使用 allorigins
  const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
  if (!resp.ok) throw new Error(`抓取失败 (${resp.status})`)
  const json = await resp.json()
  if (!json.contents) throw new Error('代理返回内容为空')
  return json.contents
}

export async function fetchWebContent(url: string): Promise<WebContent> {
  const html = await fetchHtml(url)
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // 修正相对路径（图片、链接）
  const base = new URL(url)
  doc.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      try { img.setAttribute('src', new URL(src, base).href) } catch {}
    }
  })
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href')
    if (href && !href.startsWith('http') && !href.startsWith('#')) {
      try { a.setAttribute('href', new URL(href, base).href) } catch {}
    }
  })

  // 提取 og:image 封面
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
  let coverUrl: string | undefined
  if (ogImage) {
    try {
      coverUrl = ogImage.startsWith('http') ? ogImage : new URL(ogImage, base).href
    } catch {}
  }

  // Readability 提取正文
  const reader = new Readability(doc)
  const article = reader.parse()
  if (!article || !article.content) {
    throw new Error('无法提取网页正文内容')
  }

  return {
    title: article.title || new URL(url).hostname,
    author: article.byline || new URL(url).hostname,
    content: article.content,
    excerpt: article.excerpt || '',
    coverUrl,
  }
}

export function htmlToArrayBuffer(html: string): ArrayBuffer {
  return new TextEncoder().encode(html).buffer as ArrayBuffer
}

export function arrayBufferToHtml(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer)
}
