import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import { db } from '../../db'
import SelectionToolbar from './SelectionToolbar'

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

interface SelectionData {
  text: string
  cfiRange: string  // PDF 用 "page:N" 格式
  position: { x: number; y: number }
}

export default function PdfReader({ bookId, fileData }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const renderTaskRef = useRef<ReturnType<pdfjsLib.PDFPageProxy['render']> | null>(null)
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null)

  // 加载 PDF 文档
  useEffect(() => {
    const load = async () => {
      const doc = await pdfjsLib.getDocument({ data: fileData.slice(0) }).promise
      setPdfDoc(doc)
      setTotalPages(doc.numPages)

      const progress = await db.readingProgress.get(bookId)
      if (progress?.location) {
        setCurrentPage(Number(progress.location))
      }
    }
    load()
  }, [bookId, fileData])

  // 渲染当前页（canvas + text layer）
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return

    // 取消上一次渲染
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
      renderTaskRef.current = null
    }

    const render = async () => {
      const page = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current!
      const textLayerDiv = textLayerRef.current!

      canvas.width = viewport.width
      canvas.height = viewport.height

      const renderTask = page.render({
        canvasContext: canvas.getContext('2d')!,
        canvas,
        viewport,
      })
      renderTaskRef.current = renderTask

      try {
        await renderTask.promise
      } catch {
        // render cancelled
        return
      }

      // 清空并重建文字层
      textLayerDiv.innerHTML = ''
      textLayerDiv.style.width = `${viewport.width}px`
      textLayerDiv.style.height = `${viewport.height}px`

      const textContent = await page.getTextContent()
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      })
      await textLayer.render()
    }
    render()

    // 保存进度
    db.readingProgress.put({
      bookId,
      location: String(currentPage),
      updatedAt: Date.now(),
    })
  }, [pdfDoc, currentPage, bookId, scale])

  // 监听文字选中
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) return

      const text = selection.toString().trim()
      if (!text) return

      // 确保选中发生在文字层内
      const anchor = selection.anchorNode
      if (!textLayerRef.current?.contains(anchor)) return

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setSelectionData({
        text,
        cfiRange: `page:${currentPage}`,
        position: {
          x: rect.left + rect.width / 2 - 80,
          y: rect.bottom + 8,
        },
      })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [currentPage])

  // 高亮
  const handleHighlight = async (color: string) => {
    if (!selectionData) return
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

  // 添加到笔记
  const handleAddToNote = async (color: string) => {
    if (!selectionData) return
    await db.highlights.add({
      bookId,
      cfiRange: selectionData.cfiRange,
      text: selectionData.text,
      color,
      createdAt: Date.now(),
    })
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
    document.getSelection()?.removeAllRanges()
  }

  // 缩放
  const zoomIn = useCallback(() => setScale(s => Math.min(s + SCALE_STEP, SCALE_MAX)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(s - SCALE_STEP, SCALE_MIN)), [])
  const zoomReset = useCallback(() => setScale(1.5), [])

  // 键盘：翻页 + 缩放
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '=') { e.preventDefault(); zoomIn() }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); zoomOut() }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); zoomReset() }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage(p => Math.min(p + 1, totalPages))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage(p => Math.max(p - 1, 1))
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [totalPages, zoomIn, zoomOut, zoomReset])

  return (
    <div className="h-full flex flex-col items-center">
      {/* 工具栏：翻页 + 缩放 */}
      <div className="flex items-center gap-3 py-2 shrink-0 flex-wrap justify-center">
        <button
          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
          disabled={currentPage <= 1}
          className="text-gray-400 hover:text-white disabled:opacity-30 text-sm"
        >
          &larr; 上一页
        </button>
        <span className="text-gray-400 text-sm">{currentPage} / {totalPages}</span>
        <button
          onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
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

      {/* PDF 画布 + 文字层 */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center">
        <div className="relative" style={{ display: 'inline-block' }}>
          <canvas ref={canvasRef} />
          <div
            ref={textLayerRef}
            className="textLayer"
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
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
    </div>
  )
}
