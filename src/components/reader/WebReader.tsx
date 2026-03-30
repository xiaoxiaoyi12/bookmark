import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { db } from '../../db'
import { arrayBufferToHtml } from '../../utils/web-fetch'
import { useReaderStore } from '../../stores/useReaderStore'
import { useAIStore } from '../../stores/useAIStore'
import SelectionToolbar from './SelectionToolbar'
import type { SearchResult, ReaderHandle, Highlight } from '../../types'

interface Props {
  bookId: number
  fileData: ArrayBuffer
  url?: string
}

interface TocItem {
  id: string
  text: string
  level: number
}

interface SelectionData {
  text: string
  cfiRange: string
  position: { x: number; y: number }
}

export default forwardRef<ReaderHandle, Props>(function WebReader({ bookId, fileData, url }, ref) {
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null)
  const [highlightPopup, setHighlightPopup] = useState<{ text: string; position: { x: number; y: number } } | null>(null)
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const { tocOpen } = useReaderStore()
  const restoringScroll = useRef(false)

  const html = arrayBufferToHtml(fileData)

  // 渲染内容 & 生成目录
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    // 为标题添加 id 生成目录
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const items: TocItem[] = []
    headings.forEach((heading, i) => {
      const id = `web-heading-${i}`
      heading.id = id
      items.push({
        id,
        text: heading.textContent?.trim() || '',
        level: parseInt(heading.tagName[1]),
      })
    })
    setTocItems(items)

    // 恢复高亮
    restoreHighlights()
  }, [html, bookId])

  // 恢复已保存的高亮
  const restoreHighlights = useCallback(async () => {
    const container = contentRef.current
    if (!container) return

    const highlights = await db.highlights.where('bookId').equals(bookId).toArray()
    const webHighlights = highlights.filter(h => h.cfiRange.startsWith('web:'))

    for (const h of webHighlights) {
      applyHighlightToText(container, h.text, h.color)
    }
  }, [bookId])

  // 在 DOM 中高亮匹配文字
  const applyHighlightToText = (container: HTMLElement, text: string, color: string) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

    // 拼接全文用于查找
    let fullText = ''
    const nodeMap: { node: Text; start: number }[] = []
    for (const node of textNodes) {
      nodeMap.push({ node, start: fullText.length })
      fullText += node.textContent || ''
    }

    const idx = fullText.indexOf(text)
    if (idx === -1) return
    const endIdx = idx + text.length

    // 从后往前处理避免偏移
    const entries: { node: Text; localStart: number; localEnd: number }[] = []
    for (const { node, start } of nodeMap) {
      const nodeEnd = start + (node.textContent?.length || 0)
      if (nodeEnd <= idx || start >= endIdx) continue
      entries.push({
        node,
        localStart: Math.max(0, idx - start),
        localEnd: Math.min(node.textContent?.length || 0, endIdx - start),
      })
    }

    for (let i = entries.length - 1; i >= 0; i--) {
      const { node, localStart, localEnd } = entries[i]
      let target: Text = node
      if (localEnd < node.length) node.splitText(localEnd)
      if (localStart > 0) target = node.splitText(localStart)

      const mark = document.createElement('mark')
      mark.style.backgroundColor = color
      mark.style.opacity = '0.4'
      mark.style.borderRadius = '2px'
      mark.style.padding = '0'
      mark.style.margin = '0'
      target.parentNode!.insertBefore(mark, target)
      mark.appendChild(target)
    }
  }

  // ReaderHandle 接口
  useImperativeHandle(ref, () => ({
    async search(query: string): Promise<SearchResult[]> {
      const container = contentRef.current
      if (!container || !query.trim()) return []

      const results: SearchResult[] = []
      const q = query.toLowerCase()
      const text = container.textContent || ''
      const lower = text.toLowerCase()

      let idx = lower.indexOf(q)
      while (idx !== -1) {
        const start = Math.max(0, idx - 30)
        const end = Math.min(text.length, idx + query.length + 30)
        const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
        results.push({ type: 'content', text: excerpt, location: `web:${idx}` })
        idx = lower.indexOf(q, idx + 1)
      }
      return results
    },
    goTo(result: SearchResult) {
      if (!result.location?.startsWith('web:')) return
      const offset = parseInt(result.location.split(':')[1])
      const container = contentRef.current
      if (!container) return

      // 找到偏移位置对应的 DOM 节点
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let pos = 0
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const len = node.textContent?.length || 0
        if (pos + len > offset) {
          const el = node.parentElement
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
        pos += len
      }
    },
    removeHighlight(highlight: Highlight) {
      const container = contentRef.current
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
  }), [])

  // 保存阅读进度（滚动位置百分比）
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const handleScroll = () => {
      if (restoringScroll.current) return
      const pct = container.scrollTop / (container.scrollHeight - container.clientHeight || 1)
      clearTimeout((handleScroll as any)._timer)
      ;(handleScroll as any)._timer = setTimeout(() => {
        db.readingProgress.put({
          bookId,
          location: `scroll:${pct.toFixed(4)}`,
          updatedAt: Date.now(),
        })
      }, 500)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [bookId])

  // 恢复阅读进度
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    db.readingProgress.get(bookId).then(progress => {
      if (!progress?.location?.startsWith('scroll:')) return
      const pct = parseFloat(progress.location.split(':')[1])
      if (isNaN(pct)) return

      restoringScroll.current = true
      requestAnimationFrame(() => {
        container.scrollTop = pct * (container.scrollHeight - container.clientHeight)
        setTimeout(() => { restoringScroll.current = false }, 300)
      })
    })
  }, [bookId, html])

  // 文字选中后弹出工具栏
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) return
      const text = selection.toString().trim()
      if (!text) return

      const anchor = selection.anchorNode
      if (!anchor || !contentRef.current?.contains(anchor)) return

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setSelectionData({
        text,
        cfiRange: `web:${bookId}`,
        position: { x: rect.left + rect.width / 2 - 80, y: rect.bottom + 8 },
      })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [bookId])

  // 工具栏关闭时清除选区
  useEffect(() => {
    if (selectionData === null) {
      document.getSelection()?.removeAllRanges()
    }
  }, [selectionData])

  // 点击已高亮文字弹出取消选项
  useEffect(() => {
    const container = contentRef.current
    if (!container) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'MARK' && container.contains(target)) {
        e.stopPropagation()
        setHighlightPopup({
          text: target.textContent || '',
          position: { x: e.clientX, y: e.clientY + 8 },
        })
      }
    }
    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [html])

  const handleRemoveHighlight = async () => {
    if (!highlightPopup) return
    const highlights = await db.highlights.where('bookId').equals(bookId).toArray()
    const match = highlights.find(h =>
      h.cfiRange.startsWith('web:') && h.text.includes(highlightPopup.text)
    )
    if (match?.id) await db.highlights.delete(match.id)

    const container = contentRef.current
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

  const applyHighlightToSelection = (color: string) => {
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const container = contentRef.current
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

  const handleTocClick = (id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="h-full flex">
      {/* 目录侧栏 */}
      {tocOpen && tocItems.length > 0 && (
        <nav className="w-56 shrink-0 border-r border-amber-200 dark:border-gray-700 overflow-y-auto py-2">
          <h2 className="px-3 py-2 text-xs font-semibold text-amber-600/50 dark:text-gray-500 uppercase">目录</h2>
          <ul>
            {tocItems.map(item => (
              <li key={item.id}>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded truncate"
                  style={{ paddingLeft: `${12 + (item.level - 1) * 16}px` }}
                  onClick={() => handleTocClick(item.id)}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* 正文 */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mb-4 text-xs text-amber-500 hover:text-amber-700 dark:text-gray-500 dark:hover:text-gray-300 truncate max-w-full"
            >
              {url}
            </a>
          )}
          <div
            ref={contentRef}
            className="web-reader-content prose prose-amber dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
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
