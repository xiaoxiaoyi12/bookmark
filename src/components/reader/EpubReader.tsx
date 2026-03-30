import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import ePub, { type Rendition, type NavItem } from 'epubjs'
import type Book from 'epubjs/types/book'
import { db } from '../../db'
import TableOfContents from './TableOfContents'
import { useAIStore } from '../../stores/useAIStore'
import { appendQuoteToNote } from '../../utils/note-insert'
import SelectionToolbar from './SelectionToolbar'
import { useReaderStore } from '../../stores/useReaderStore'
import { useThemeStore } from '../../stores/useThemeStore'
import type { SearchResult, ReaderHandle, Highlight } from '../../types'

interface Props {
  bookId: number
  fileData: ArrayBuffer
}

interface SelectionData {
  text: string
  cfiRange: string
  position: { x: number; y: number }
}

const LIGHT_THEME = {
  'body': {
    'color': '#3d3929 !important',
    'background': '#faf6f0 !important',
  },
  'p, div, span, li, td, th, dd, dt': {
    'color': '#3d3929 !important',
  },
  'h1, h2, h3, h4, h5, h6': {
    'color': '#2d2518 !important',
  },
  'a': {
    'color': '#8b6914 !important',
  },
}

const DARK_THEME = {
  'body': {
    'color': '#e5e7eb !important',
    'background': '#111827 !important',
  },
  'p, div, span, li, td, th, dd, dt': {
    'color': '#e5e7eb !important',
  },
  'h1, h2, h3, h4, h5, h6': {
    'color': '#f3f4f6 !important',
  },
  'a': {
    'color': '#60a5fa !important',
  },
}

export default forwardRef<ReaderHandle, Props>(function EpubReader({ bookId, fileData }, ref) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const bookRef = useRef<Book | null>(null)
  const [toc, setToc] = useState<NavItem[]>([])
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null)
  const [highlightPopup, setHighlightPopup] = useState<{ cfiRange: string; position: { x: number; y: number } } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pageInput, setPageInput] = useState('1')
  const [fontSize, setFontSize] = useState(100)
  const { tocOpen } = useReaderStore()
  const resolved = useThemeStore(s => s.resolved)

  useImperativeHandle(ref, () => ({
    async search(query: string): Promise<SearchResult[]> {
      const book = bookRef.current
      if (!book || !query.trim()) return []

      const results: SearchResult[] = []
      const q = query.toLowerCase()
      const spine = book.spine as unknown as { each: (fn: (item: { load: (fn: (doc: Document) => Promise<Document>) => Promise<Document>, find: (q: string) => { cfi: string; excerpt: string }[] }) => void) => void }

      const items: { load: (fn: (doc: Document) => Promise<Document>) => Promise<Document>, find: (q: string) => { cfi: string; excerpt: string }[] }[] = []
      spine.each((item) => items.push(item))

      for (const item of items) {
        try {
          await item.load(book.load.bind(book) as unknown as (doc: Document) => Promise<Document>)
          const matches = item.find(q)
          for (const m of matches) {
            results.push({
              type: 'content',
              text: m.excerpt.trim(),
              location: m.cfi,
            })
          }
        } catch {
          // skip chapters that fail to load
        }
      }
      return results
    },
    goTo(result: SearchResult) {
      if (result.location) {
        renditionRef.current?.display(result.location)
      }
    },
    removeHighlight(highlight: Highlight) {
      renditionRef.current?.annotations.remove(highlight.cfiRange, 'highlight')
    },
    goToHighlight(highlight: Highlight) {
      renditionRef.current?.display(highlight.cfiRange)
    },
  }), [])

  // 主题变化时更新 EPUB 内容样式
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    const theme = resolved === 'dark' ? DARK_THEME : LIGHT_THEME
    rendition.themes.default(theme)
    // 强制重新渲染当前位置以应用新主题
    const loc = rendition.location
    if (loc?.start?.cfi) {
      rendition.display(loc.start.cfi)
    }
  }, [resolved])

  useEffect(() => {
    if (!viewerRef.current) return

    const book = ePub(fileData)
    bookRef.current = book as unknown as Book
    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'scrolled-doc',
    })

    renditionRef.current = rendition

    // Tauri WebKit 严格执行 iframe sandbox，需要给 epubjs 的 iframe 补上 allow-scripts
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLIFrameElement && node.hasAttribute('sandbox')) {
            const sb = node.getAttribute('sandbox') || ''
            if (!sb.includes('allow-scripts')) {
              node.setAttribute('sandbox', `${sb} allow-scripts allow-same-origin`.trim())
            }
          }
        }
      }
    })
    observer.observe(viewerRef.current!, { childList: true, subtree: true })

    // 根据当前主题注入样式
    const theme = useThemeStore.getState().resolved === 'dark' ? DARK_THEME : LIGHT_THEME
    rendition.themes.default(theme)

    // 加载保存的阅读进度，或从头开始
    db.readingProgress.get(bookId).then(progress => {
      if (progress?.location) {
        rendition.display(progress.location)
      } else {
        rendition.display()
      }
    })

    // 加载目录
    book.loaded.navigation.then(nav => setToc(nav.toc))

    // 生成虚拟页码
    book.ready.then(() => {
      return (book as unknown as { locations: { generate: (chars: number) => Promise<string[]> } }).locations.generate(1024)
    }).then(() => {
      const locations = (book as unknown as { locations: { length: () => number } }).locations
      setTotalPages(locations.length())
    })

    // 翻页时保存进度 & 更新页码
    rendition.on('relocated', (location: { start: { cfi: string; location: number } }) => {
      db.readingProgress.put({
        bookId,
        location: location.start.cfi,
        updatedAt: Date.now(),
      })
      if (location.start.location >= 0) {
        const page = location.start.location + 1
        setCurrentPage(page)
        setPageInput(String(page))
      }
    })

    // 加载并应用已保存的高亮（点击高亮弹出取消选项）
    db.highlights.where('bookId').equals(bookId).toArray().then(highlights => {
      highlights.forEach(h => {
        rendition.annotations.highlight(
          h.cfiRange, {}, (e: MouseEvent) => {
            e.stopPropagation()
            const iframe = viewerRef.current?.querySelector('iframe')
            const iframeRect = iframe?.getBoundingClientRect()
            setHighlightPopup({
              cfiRange: h.cfiRange,
              position: {
                x: (iframeRect?.left ?? 0) + e.clientX,
                y: (iframeRect?.top ?? 0) + e.clientY + 8,
              },
            })
          }, '', { fill: h.color, 'fill-opacity': '0.3' }
        )
      })
    })

    // 文字选中事件
    rendition.on('selected', (cfiRange: string) => {
      const iframe = viewerRef.current?.querySelector('iframe')
      const selection = iframe?.contentDocument?.getSelection()
      if (!selection || selection.isCollapsed) return

      const text = selection.toString().trim()
      if (!text) return

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const iframeRect = iframe!.getBoundingClientRect()

      setSelectionData({
        text,
        cfiRange,
        position: {
          x: iframeRect.left + rect.left + rect.width / 2 - 80,
          y: iframeRect.top + rect.bottom + 8,
        },
      })
    })

    // 点击 iframe 内部时关闭选中工具栏
    rendition.on('markClicked', () => { /* handled by highlight popup */ })
    const handleIframeClick = () => {
      setSelectionData(null)
    }
    rendition.hooks.content.register((contents: { document: Document }) => {
      contents.document.addEventListener('mousedown', handleIframeClick)

      // Tauri WebKit 下 epubjs 的 'selected' 事件可能不触发，手动监听 mouseup 作为备用
      contents.document.addEventListener('mouseup', () => {
        setTimeout(() => {
          const iframe = viewerRef.current?.querySelector('iframe')
          const sel = iframe?.contentDocument?.getSelection()
          if (!sel || sel.isCollapsed) return
          const text = sel.toString().trim()
          if (!text) return

          // 获取 cfiRange
          const range = sel.getRangeAt(0)
          const cfi = (rendition.currentLocation() as unknown as { start?: { cfi: string } })?.start?.cfi
          if (!cfi) return

          const rect = range.getBoundingClientRect()
          const iframeRect = iframe!.getBoundingClientRect()

          setSelectionData({
            text,
            cfiRange: cfi,
            position: {
              x: iframeRect.left + rect.left + rect.width / 2 - 80,
              y: iframeRect.top + rect.bottom + 8,
            },
          })
        }, 10)
      })
    })

    // 键盘切换章节（左右方向键）
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') rendition.next()
      if (e.key === 'ArrowLeft') rendition.prev()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', handleKeyDown)
      rendition.destroy()
      book.destroy()
      bookRef.current = null
    }
  }, [bookId, fileData])

  const addHighlightAnnotation = (cfiRange: string, color: string) => {
    renditionRef.current?.annotations.highlight(
      cfiRange, {}, (e: MouseEvent) => {
        e.stopPropagation()
        const iframe = viewerRef.current?.querySelector('iframe')
        const iframeRect = iframe?.getBoundingClientRect()
        setHighlightPopup({
          cfiRange,
          position: {
            x: (iframeRect?.left ?? 0) + e.clientX,
            y: (iframeRect?.top ?? 0) + e.clientY + 8,
          },
        })
      }, '', { fill: color, 'fill-opacity': '0.3' }
    )
  }

  const handleRemoveHighlight = async () => {
    if (!highlightPopup) return
    const h = await db.highlights.where('bookId').equals(bookId).and(h => h.cfiRange === highlightPopup.cfiRange).first()
    if (h?.id) await db.highlights.delete(h.id)
    renditionRef.current?.annotations.remove(highlightPopup.cfiRange, 'highlight')
    setHighlightPopup(null)
  }

  const handleHighlight = async (color: string) => {
    if (!selectionData) return
    await db.highlights.add({
      bookId,
      cfiRange: selectionData.cfiRange,
      text: selectionData.text,
      color,
      createdAt: Date.now(),
    })
    addHighlightAnnotation(selectionData.cfiRange, color)
    setSelectionData(null)
  }

  const handleAddToNote = () => {
    if (!selectionData) return
    appendQuoteToNote(selectionData.text)
    setSelectionData(null)
  }

  // 工具栏关闭时清除 iframe 内的文字选区
  useEffect(() => {
    if (selectionData === null) {
      const iframe = viewerRef.current?.querySelector('iframe')
      iframe?.contentDocument?.getSelection()?.removeAllRanges()
    }
  }, [selectionData])

  const handleTocSelect = (href: string) => {
    renditionRef.current?.display(href)
  }

  // 字号缩放
  const FONT_STEP = 10
  const FONT_MIN = 60
  const FONT_MAX = 200
  const applyFontSize = useCallback((size: number) => {
    setFontSize(size)
    renditionRef.current?.themes.fontSize(`${size}%`)
  }, [])
  const fontUp = useCallback(() => applyFontSize(Math.min(fontSize + FONT_STEP, FONT_MAX)), [fontSize, applyFontSize])
  const fontDown = useCallback(() => applyFontSize(Math.max(fontSize - FONT_STEP, FONT_MIN)), [fontSize, applyFontSize])
  const fontReset = useCallback(() => applyFontSize(100), [applyFontSize])

  // 页码跳转
  const handlePageJump = () => {
    const num = parseInt(pageInput, 10)
    if (isNaN(num) || num < 1 || num > totalPages) {
      setPageInput(String(currentPage))
      return
    }
    const book = bookRef.current
    if (!book) return
    const locations = (book as unknown as { locations: { cfiFromLocation: (loc: number) => string } }).locations
    const cfi = locations.cfiFromLocation(num - 1)
    if (cfi) renditionRef.current?.display(cfi)
  }

  // 键盘缩放
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '=') { e.preventDefault(); fontUp() }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); fontDown() }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); fontReset() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [fontUp, fontDown, fontReset])

  return (
    <div className="flex h-full">
      {tocOpen && (
        <div className="w-60 border-r border-amber-200 dark:border-gray-700 shrink-0">
          <TableOfContents items={toc} onSelect={handleTocSelect} />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 工具栏 */}
        <div className="flex items-center gap-3 py-2 px-4 shrink-0 flex-wrap justify-center select-none border-b border-amber-200 dark:border-gray-700">
          {totalPages > 0 && (
            <>
              <span className="text-amber-600 dark:text-gray-400 text-sm flex items-center gap-0.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePageJump() }}
                  onBlur={handlePageJump}
                  className="w-8 text-center bg-transparent border-b border-amber-300 dark:border-gray-600 outline-none text-amber-700 dark:text-gray-300 text-sm"
                />
                <span>/ {totalPages}</span>
              </span>
              <span className="text-amber-300 dark:text-gray-600 mx-1">|</span>
            </>
          )}
          <button onClick={fontDown} disabled={fontSize <= FONT_MIN}
            className="text-amber-700 hover:text-amber-900 disabled:opacity-30 text-sm px-1 dark:text-gray-400 dark:hover:text-white">
            A&minus;
          </button>
          <button onClick={fontReset}
            className="text-amber-700 hover:text-amber-900 text-sm min-w-10 text-center dark:text-gray-400 dark:hover:text-white">
            {fontSize}%
          </button>
          <button onClick={fontUp} disabled={fontSize >= FONT_MAX}
            className="text-amber-700 hover:text-amber-900 disabled:opacity-30 text-sm px-1 dark:text-gray-400 dark:hover:text-white">
            A+
          </button>
        </div>
        <div ref={viewerRef} className="flex-1 min-h-0" />
      </div>

      {selectionData && (
        <SelectionToolbar
          position={selectionData.position}
          selectedText={selectionData.text}
          onHighlight={handleHighlight}
          onAddToNote={handleAddToNote}
          onTranslate={() => { useAIStore.getState().requestTranslation(selectionData.text) }}
          onClose={() => setSelectionData(null)}
        />
      )}

      {highlightPopup && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setHighlightPopup(null)}
        >
          <button
            className="fixed z-50 px-3 py-1.5 text-sm text-red-600 bg-white dark:text-red-300 dark:bg-gray-800 rounded-lg shadow-xl border border-amber-200 dark:border-gray-600 hover:bg-amber-50 dark:hover:bg-gray-700 select-none"
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
