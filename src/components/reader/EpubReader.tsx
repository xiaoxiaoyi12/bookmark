import { useEffect, useRef, useState } from 'react'
import ePub, { type Rendition, type NavItem } from 'epubjs'
import { db } from '../../db'
import TableOfContents from './TableOfContents'
import { useReaderStore } from '../../stores/useReaderStore'

interface Props {
  bookId: number
  fileData: ArrayBuffer
}

export default function EpubReader({ bookId, fileData }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const [toc, setToc] = useState<NavItem[]>([])
  const { tocOpen } = useReaderStore()

  useEffect(() => {
    if (!viewerRef.current) return

    const book = ePub(fileData)
    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
    })

    renditionRef.current = rendition

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

    // 键盘翻页
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendition.next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') rendition.prev()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      rendition.destroy()
      book.destroy()
    }
  }, [bookId, fileData])

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
    </div>
  )
}
