import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import { db } from '../../db'
import SelectionToolbar from './SelectionToolbar'
import type { SearchResult, ReaderHandle, Highlight } from '../../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

interface Props {
  bookId: number
  fileData: ArrayBuffer
}

const SCALE_STEP = 0.25
const SCALE_MIN = 0.5
const SCALE_MAX = 4
const PAGE_GAP = 12

interface SelectionData {
  text: string
  cfiRange: string
  position: { x: number; y: number }
}

export default forwardRef<ReaderHandle, Props>(function PdfReader({ bookId, fileData }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null)
  const [highlightPopup, setHighlightPopup] = useState<{ text: string; page: number; position: { x: number; y: number } } | null>(null)

  // 每页的容器 ref
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  // 已渲染的页码集合
  const renderedPages = useRef<Set<number>>(new Set())
  // 是否正在恢复进度滚动
  const restoringScroll = useRef(false)

  useImperativeHandle(ref, () => ({
    async search(query: string): Promise<SearchResult[]> {
      if (!pdfDoc || !query.trim()) return []
      const results: SearchResult[] = []
      const q = query.toLowerCase()

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
        const lower = pageText.toLowerCase()

        let idx = lower.indexOf(q)
        while (idx !== -1) {
          const start = Math.max(0, idx - 30)
          const end = Math.min(pageText.length, idx + query.length + 30)
          const excerpt = (start > 0 ? '...' : '') + pageText.slice(start, end) + (end < pageText.length ? '...' : '')
          results.push({ type: 'content', text: excerpt, page: i })
          idx = lower.indexOf(q, idx + 1)
        }
      }
      return results
    },
    goTo(result: SearchResult) {
      if (result.page) {
        const el = pageRefs.current.get(result.page)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }
    },
    removeHighlight(highlight: Highlight) {
      // PDF 高亮是 page:N 格式，找到对应页面中的 mark 元素
      const pageNum = highlight.cfiRange.startsWith('page:') ? Number(highlight.cfiRange.split(':')[1]) : null
      if (!pageNum) return
      const container = pageRefs.current.get(pageNum)
      if (!container) return
      const marks = container.querySelectorAll('mark')
      marks.forEach(mark => {
        if (mark.textContent === highlight.text) {
          const parent = mark.parentNode!
          while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
          parent.removeChild(mark)
          parent.normalize()
        }
      })
    },
  }), [pdfDoc])

  // 加载 PDF
  useEffect(() => {
    const load = async () => {
      const doc = await pdfjsLib.getDocument({ data: fileData.slice(0) }).promise
      setPdfDoc(doc)
      setTotalPages(doc.numPages)
    }
    load()
  }, [bookId, fileData])

  // 渲染单页
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || renderedPages.current.has(pageNum)) return
    const container = pageRefs.current.get(pageNum)
    if (!container) return

    renderedPages.current.add(pageNum)

    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const w = Math.floor(viewport.width)
    const h = Math.floor(viewport.height)

    container.style.width = `${w}px`
    container.style.height = `${h}px`

    // Canvas
    const canvas = document.createElement('canvas')
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    canvas.style.display = 'block'
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    container.innerHTML = ''
    container.appendChild(canvas)

    try {
      await page.render({ canvasContext: ctx, canvas, viewport }).promise
    } catch {
      return
    }

    // Text layer
    const textDiv = document.createElement('div')
    textDiv.className = 'pdf-text-layer'
    textDiv.style.width = `${w}px`
    textDiv.style.height = `${h}px`
    container.appendChild(textDiv)

    const textContent = await page.getTextContent()
    const textLayer = new TextLayer({
      textContentSource: textContent,
      container: textDiv,
      viewport,
    })
    await textLayer.render()

    // 恢复该页高亮
    const highlights = await db.highlights
      .where('bookId').equals(bookId)
      .toArray()
    const pageHighlights = highlights.filter(hl => hl.cfiRange === `page:${pageNum}`)
    if (pageHighlights.length > 0) {
      applyHighlightsToPage(textDiv, pageHighlights)
    }
  }, [pdfDoc, scale, bookId])

  // 缩放时清除已渲染状态，重新渲染可见页
  useEffect(() => {
    renderedPages.current.clear()
    // 设置占位尺寸（用第一页估算）
    if (!pdfDoc) return
    pdfDoc.getPage(1).then(page => {
      const viewport = page.getViewport({ scale })
      const w = Math.floor(viewport.width)
      const h = Math.floor(viewport.height)
      pageRefs.current.forEach((container) => {
        container.style.width = `${w}px`
        container.style.height = `${h}px`
        container.innerHTML = ''
      })
    })
  }, [pdfDoc, scale])

  // IntersectionObserver 懒渲染
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-page'))
            if (pageNum && !renderedPages.current.has(pageNum)) {
              renderPage(pageNum)
            }
          }
        }
      },
      {
        root: scrollRef.current,
        rootMargin: '200px 0px',
      }
    )

    pageRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pdfDoc, totalPages, renderPage])

  // 跟踪当前页码（滚动时更新）
  useEffect(() => {
    const container = scrollRef.current
    if (!container || totalPages === 0) return

    const handleScroll = () => {
      if (restoringScroll.current) return

      const containerRect = container.getBoundingClientRect()
      const center = containerRect.top + containerRect.height / 2

      let closest = 1
      let minDist = Infinity
      pageRefs.current.forEach((el, num) => {
        const rect = el.getBoundingClientRect()
        const dist = Math.abs(rect.top + rect.height / 2 - center)
        if (dist < minDist) {
          minDist = dist
          closest = num
        }
      })

      setCurrentPage(closest)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [totalPages])

  // 保存阅读进度（防抖）
  useEffect(() => {
    if (restoringScroll.current) return
    const timer = setTimeout(() => {
      db.readingProgress.put({
        bookId,
        location: String(currentPage),
        updatedAt: Date.now(),
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [currentPage, bookId])

  // 恢复阅读进度 — 滚动到保存的页码
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return
    db.readingProgress.get(bookId).then(progress => {
      if (!progress?.location) return
      const savedPage = Number(progress.location)
      if (savedPage <= 1 || savedPage > totalPages) return

      restoringScroll.current = true
      // 等待页面容器挂载后滚动
      requestAnimationFrame(() => {
        const el = pageRefs.current.get(savedPage)
        if (el) {
          el.scrollIntoView({ behavior: 'instant' })
          setCurrentPage(savedPage)
        }
        setTimeout(() => { restoringScroll.current = false }, 300)
      })
    })
  }, [pdfDoc, totalPages, bookId])

  // 高亮到具体页面的文字层
  const applyHighlightsToPage = (textDiv: HTMLDivElement, highlights: { text: string; color: string }[]) => {
    const allSpans = Array.from(textDiv.querySelectorAll('span'))
    let fullText = ''
    const map: { span: HTMLSpanElement; startInFull: number }[] = []
    for (const span of allSpans) {
      map.push({ span, startInFull: fullText.length })
      fullText += span.textContent || ''
    }

    for (const h of highlights) {
      const idx = fullText.indexOf(h.text)
      if (idx === -1) continue
      const endIdx = idx + h.text.length

      for (const { span, startInFull } of map) {
        const spanText = span.textContent || ''
        const spanEnd = startInFull + spanText.length
        if (spanEnd <= idx || startInFull >= endIdx) continue

        const textNode = span.firstChild
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue
        const tn = textNode as Text

        const localStart = Math.max(0, idx - startInFull)
        const localEnd = Math.min(spanText.length, endIdx - startInFull)

        let target: Text = tn
        if (localEnd < tn.length) tn.splitText(localEnd)
        if (localStart > 0) target = tn.splitText(localStart)

        const mark = document.createElement('mark')
        mark.style.backgroundColor = h.color
        mark.style.opacity = '0.4'
        mark.style.borderRadius = '2px'
        mark.style.color = 'transparent'
        mark.style.padding = '0'
        mark.style.margin = '0'
        target.parentNode!.insertBefore(mark, target)
        mark.appendChild(target)
      }
    }
  }

  // 选中文字后弹出工具栏
  const findPageForNode = (node: Node): number | null => {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement
    while (el) {
      const page = el.getAttribute?.('data-page')
      if (page) return Number(page)
      el = el.parentElement
    }
    return null
  }

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) return
      const text = selection.toString().trim()
      if (!text) return

      const anchor = selection.anchorNode
      if (!anchor || !scrollRef.current?.contains(anchor)) return

      const pageNum = findPageForNode(anchor)
      if (!pageNum) return

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setSelectionData({
        text,
        cfiRange: `page:${pageNum}`,
        position: { x: rect.left + rect.width / 2 - 80, y: rect.bottom + 8 },
      })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // 点击已高亮文字弹出取消选项
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'MARK' && container.contains(target)) {
        e.stopPropagation()
        const pageNum = findPageForNode(target)
        if (!pageNum) return
        setHighlightPopup({
          text: target.textContent || '',
          page: pageNum,
          position: { x: e.clientX, y: e.clientY + 8 },
        })
      }
    }
    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [])

  const handleRemoveHighlight = async () => {
    if (!highlightPopup) return
    // 从 DB 中删除
    const highlights = await db.highlights.where('bookId').equals(bookId).toArray()
    const match = highlights.find(h =>
      h.cfiRange === `page:${highlightPopup.page}` && h.text.includes(highlightPopup.text)
    )
    if (match?.id) await db.highlights.delete(match.id)
    // 从 DOM 中移除 mark
    const container = pageRefs.current.get(highlightPopup.page)
    if (container) {
      const marks = container.querySelectorAll('mark')
      marks.forEach(mark => {
        if (mark.textContent === highlightPopup.text) {
          const parent = mark.parentNode!
          while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
          parent.removeChild(mark)
          parent.normalize()
        }
      })
    }
    setHighlightPopup(null)
  }

  // 高亮选区
  const applyHighlightToSelection = (color: string) => {
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const container = scrollRef.current
    if (!container) return

    const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const entries: { node: Text; start: number; end: number }[] = []
    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode as Text
      if (!range.intersectsNode(node)) continue
      const start = node === range.startContainer ? range.startOffset : 0
      const end = node === range.endContainer ? range.endOffset : node.length
      if (start < end) entries.push({ node, start, end })
    }

    for (let i = entries.length - 1; i >= 0; i--) {
      const { node, start, end } = entries[i]
      let target: Text = node
      if (end < node.length) node.splitText(end)
      if (start > 0) target = node.splitText(start)

      const mark = document.createElement('mark')
      mark.style.backgroundColor = color
      mark.style.opacity = '0.4'
      mark.style.borderRadius = '2px'
      mark.style.color = 'transparent'
      mark.style.padding = '0'
      mark.style.margin = '0'
      target.parentNode!.insertBefore(mark, target)
      mark.appendChild(target)
    }
  }

  const handleHighlight = async (color: string) => {
    if (!selectionData) return
    applyHighlightToSelection(color)
    await db.highlights.add({
      bookId,
      cfiRange: selectionData.cfiRange,
      text: selectionData.text,
      color,
      createdAt: Date.now(),
    })
    setSelectionData(null)
    document.getSelection()?.removeAllRanges()
  }

  const handleAddToNote = async () => {
    if (!selectionData) return
    // 仅插入引用到笔记编辑器，不做高亮
    const editor = (window as unknown as Record<string, unknown>).__tiptapEditor as
      { chain: () => { focus: () => { insertContent: (c: unknown) => { run: () => void } } } } | undefined
    if (editor) {
      editor.chain().focus().insertContent([
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: selectionData.text }] }] },
        { type: 'paragraph' },
      ]).run()
    }
    setSelectionData(null)
    document.getSelection()?.removeAllRanges()
  }

  // 缩放
  const zoomIn = useCallback(() => setScale(s => Math.min(s + SCALE_STEP, SCALE_MAX)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(s - SCALE_STEP, SCALE_MIN)), [])
  const zoomReset = useCallback(() => setScale(1.5), [])

  // 点击页码跳转
  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current.get(pageNum)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  // 键盘缩放
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '=') { e.preventDefault(); zoomIn() }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomOut() }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); zoomReset() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [zoomIn, zoomOut, zoomReset])

  // 生成页码数组
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="h-full flex flex-col items-center">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 py-2 shrink-0 flex-wrap justify-center select-none">
        <button
          onClick={() => scrollToPage(Math.max(currentPage - 1, 1))}
          disabled={currentPage <= 1}
          className="text-gray-400 hover:text-white disabled:opacity-30 text-sm"
        >
          &larr; 上一页
        </button>
        <span className="text-gray-400 text-sm">{currentPage} / {totalPages}</span>
        <button
          onClick={() => scrollToPage(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage >= totalPages}
          className="text-gray-400 hover:text-white disabled:opacity-30 text-sm"
        >
          下一页 &rarr;
        </button>

        <span className="text-gray-600 mx-1">|</span>

        <button onClick={zoomOut} disabled={scale <= SCALE_MIN}
          className="text-gray-400 hover:text-white disabled:opacity-30 text-sm px-1">
          &minus;
        </button>
        <button onClick={zoomReset} className="text-gray-400 hover:text-white text-sm min-w-14 text-center">
          {Math.round(scale * 100)}%
        </button>
        <button onClick={zoomIn} disabled={scale >= SCALE_MAX}
          className="text-gray-400 hover:text-white disabled:opacity-30 text-sm px-1">
          +
        </button>
      </div>

      {/* 连续滚动容器 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto w-full"
      >
        <div className="flex flex-col items-center" style={{ gap: `${PAGE_GAP}px`, padding: '16px 0' }}>
          {pages.map(pageNum => (
            <div
              key={pageNum}
              data-page={pageNum}
              ref={(el) => { if (el) pageRefs.current.set(pageNum, el) }}
              className="relative shrink-0 bg-white shadow-lg"
              style={{ minHeight: 200 }}
            />
          ))}
        </div>
      </div>

      {selectionData && (
        <SelectionToolbar
          position={selectionData.position}
          onHighlight={handleHighlight}
          onAddToNote={handleAddToNote}
          onClose={() => setSelectionData(null)}
        />
      )}

      {highlightPopup && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setHighlightPopup(null)}
        >
          <button
            className="fixed z-50 px-3 py-1.5 text-sm text-red-300 bg-gray-800 rounded-lg shadow-xl border border-gray-600 hover:bg-gray-700 select-none"
            style={{ left: highlightPopup.position.x, top: highlightPopup.position.y }}
            onClick={(e) => { e.stopPropagation(); handleRemoveHighlight() }}
          >
            取消高亮
          </button>
        </div>
      )}
    </div>
  )
})
