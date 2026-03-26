import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { db } from '../../db'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

interface Props {
  bookId: number
  fileData: ArrayBuffer
}

export default function PdfReader({ bookId, fileData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  // 加载 PDF 文档
  useEffect(() => {
    const load = async () => {
      const doc = await pdfjsLib.getDocument({ data: fileData.slice(0) }).promise
      setPdfDoc(doc)
      setTotalPages(doc.numPages)

      // 恢复阅读进度
      const progress = await db.readingProgress.get(bookId)
      if (progress?.location) {
        setCurrentPage(Number(progress.location))
      }
    }
    load()
  }, [bookId, fileData])

  // 渲染当前页
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    const render = async () => {
      const page = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: canvas.getContext('2d')!,
        canvas,
        viewport,
      }).promise
    }
    render()

    // 保存进度
    db.readingProgress.put({
      bookId,
      location: String(currentPage),
      updatedAt: Date.now(),
    })
  }, [pdfDoc, currentPage, bookId])

  // 键盘翻页
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage(p => Math.min(p + 1, totalPages))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage(p => Math.max(p - 1, 1))
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [totalPages])

  return (
    <div className="h-full flex flex-col items-center">
      {/* 翻页控制 */}
      <div className="flex items-center gap-3 py-2 shrink-0">
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
      </div>

      {/* PDF 画布 */}
      <div className="flex-1 overflow-auto flex justify-center">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
