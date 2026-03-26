import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import ePub, { type Rendition, type NavItem } from 'epubjs'
import type Book from 'epubjs/types/book'
import { db } from '../../db'
import TableOfContents from './TableOfContents'
import SelectionToolbar from './SelectionToolbar'
import { useReaderStore } from '../../stores/useReaderStore'
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

export default forwardRef<ReaderHandle, Props>(function EpubReader({ bookId, fileData }, ref) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const bookRef = useRef<Book | null>(null)
  const [toc, setToc] = useState<NavItem[]>([])
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null)
  const { tocOpen } = useReaderStore()

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
          await item.load(book.load.bind(book) as (doc: Document) => Promise<Document>)
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
  }), [])

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

    // 注入暗色主题样式到 EPUB iframe
    rendition.themes.default({
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
    })

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

    // 翻页时保存进度
    rendition.on('relocated', (location: { start: { cfi: string } }) => {
      db.readingProgress.put({
        bookId,
        location: location.start.cfi,
        updatedAt: Date.now(),
      })
    })

    // 加载并应用已保存的高亮
    db.highlights.where('bookId').equals(bookId).toArray().then(highlights => {
      highlights.forEach(h => {
        rendition.annotations.highlight(
          h.cfiRange, {}, () => {}, '', { fill: h.color, 'fill-opacity': '0.3' }
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

    // 键盘切换章节（左右方向键）
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') rendition.next()
      if (e.key === 'ArrowLeft') rendition.prev()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      rendition.destroy()
      book.destroy()
      bookRef.current = null
    }
  }, [bookId, fileData])

  const handleHighlight = async (color: string) => {
    if (!selectionData) return
    await db.highlights.add({
      bookId,
      cfiRange: selectionData.cfiRange,
      text: selectionData.text,
      color,
      createdAt: Date.now(),
    })
    renditionRef.current?.annotations.highlight(
      selectionData.cfiRange, {}, () => {}, '', { fill: color, 'fill-opacity': '0.3' }
    )
    setSelectionData(null)
  }

  const handleAddToNote = async (color: string) => {
    if (!selectionData) return
    // 先高亮
    await db.highlights.add({
      bookId,
      cfiRange: selectionData.cfiRange,
      text: selectionData.text,
      color,
      createdAt: Date.now(),
    })
    renditionRef.current?.annotations.highlight(
      selectionData.cfiRange, {}, () => {}, '', { fill: color, 'fill-opacity': '0.3' }
    )
    // 插入引用到笔记编辑器
    const editor = (window as unknown as Record<string, unknown>).__tiptapEditor as
      { chain: () => { focus: () => { insertContent: (c: unknown) => { run: () => void } } } } | undefined
    if (editor) {
      editor.chain().focus().insertContent([
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: selectionData.text }] }] },
        { type: 'paragraph' },
      ]).run()
    }
    setSelectionData(null)
  }

  const handleTocSelect = (href: string) => {
    renditionRef.current?.display(href)
  }

  return (
    <div className="flex h-full">
      {tocOpen && (
        <div className="w-60 border-r border-gray-700 shrink-0">
          <TableOfContents items={toc} onSelect={handleTocSelect} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div ref={viewerRef} className="h-full" />
      </div>

      {selectionData && (
        <SelectionToolbar
          position={selectionData.position}
          onHighlight={handleHighlight}
          onAddToNote={handleAddToNote}
          onClose={() => setSelectionData(null)}
        />
      )}
    </div>
  )
})
