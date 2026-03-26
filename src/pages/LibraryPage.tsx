import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '../db'
import type { Book } from '../types'
import ImportDropzone from '../components/library/ImportDropzone'
import BookGrid from '../components/library/BookGrid'
import { exportBackup, importBackup } from '../utils/backup'
import ThemeToggle from '../components/ThemeToggle'

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadBooks = useCallback(async () => {
    const all = await db.books.orderBy('createdAt').reverse().toArray()
    setBooks(all)
  }, [])

  useEffect(() => { loadBooks() }, [loadBooks])

  // toast 自动消失
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleExport = async () => {
    try {
      await exportBackup()
      setToast('备份文件已下载')
    } catch {
      setToast('导出失败')
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImporting(true)
    try {
      const result = await importBackup(file)
      await loadBooks()
      setToast(`导入完成：${result.books} 本书，${result.highlights} 条高亮，${result.notes} 条笔记`)
    } catch (err) {
      setToast(`导入失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#faf6f0] dark:bg-gray-900 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-900 dark:text-white">BookMark</h1>
        <div className="flex gap-2 select-none items-center">
          <ThemeToggle />
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-sm text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700"
          >
            导出备份
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="px-3 py-1.5 text-sm text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors disabled:opacity-50 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700"
          >
            {importing ? '导入中...' : '导入备份'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>
      <ImportDropzone onImported={loadBooks} />
      <div className="mt-8">
        <BookGrid books={books} onChanged={loadBooks} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-50 text-sm text-amber-900 rounded-lg shadow-xl border border-amber-200 animate-fade-in dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
          {toast}
        </div>
      )}
    </div>
  )
}
