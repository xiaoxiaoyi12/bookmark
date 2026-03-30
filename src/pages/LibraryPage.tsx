import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '../db'
import type { Book } from '../types'
import ImportDropzone from '../components/library/ImportDropzone'
import BookGrid from '../components/library/BookGrid'
import { exportBackup, importBackup } from '../utils/backup'
import { fetchWebContent, htmlToArrayBuffer } from '../utils/web-fetch'
import ThemeToggle from '../components/ThemeToggle'

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadBooks = useCallback(async () => {
    const all = await db.books.orderBy('createdAt').reverse().toArray()
    setBooks(all)
  }, [])

  useEffect(() => { loadBooks() }, [loadBooks])

  const filteredBooks = searchQuery.trim()
    ? books.filter(b => b.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : books

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

  const handleWebImport = async () => {
    const url = urlInput.trim()
    if (!url) return
    setUrlLoading(true)
    try {
      const result = await fetchWebContent(url)
      const fileData = htmlToArrayBuffer(result.content)
      await db.books.add({
        title: result.title,
        author: result.author,
        format: 'web',
        coverUrl: result.coverUrl,
        fileData,
        url,
        createdAt: Date.now(),
      })
      await loadBooks()
      setUrlInput('')
      setShowUrlInput(false)
      setToast(`已保存：${result.title}`)
    } catch (err) {
      setToast(`抓取失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setUrlLoading(false)
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
        <div className="flex items-center gap-3">
          <a
            href="https://xiaoxiaoyi12.github.io/"
            className="flex items-center gap-1 px-2 py-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="返回主页"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
          </a>
          <h1 className="text-2xl font-bold text-amber-900 dark:text-white">BookMark</h1>
        </div>
        <div className="flex gap-2 select-none items-center">
          {books.length > 0 && (
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400 dark:text-gray-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <path d="M10 10l4 4" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索书名..."
                className="w-48 pl-8 pr-3 py-1.5 text-sm rounded-lg border border-amber-200 bg-white placeholder-amber-400 text-amber-900 outline-none focus:border-amber-400 transition-colors dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-500 dark:text-gray-200 dark:focus:border-gray-500"
              />
            </div>
          )}
          <ThemeToggle />
          {showUrlInput ? (
            <div className="flex items-center gap-1">
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleWebImport(); if (e.key === 'Escape') { setShowUrlInput(false); setUrlInput('') } }}
                placeholder="输入网页 URL..."
                autoFocus
                className="w-64 px-3 py-1.5 text-sm rounded-lg border border-amber-200 bg-white placeholder-amber-400 text-amber-900 outline-none focus:border-amber-400 transition-colors dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-500 dark:text-gray-200 dark:focus:border-gray-500"
              />
              <button
                onClick={handleWebImport}
                disabled={urlLoading || !urlInput.trim()}
                className="px-3 py-1.5 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {urlLoading ? '抓取中...' : '保存'}
              </button>
              <button
                onClick={() => { setShowUrlInput(false); setUrlInput('') }}
                className="px-2 py-1.5 text-sm text-amber-600 hover:text-amber-800 dark:text-gray-400 dark:hover:text-white"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              className="px-3 py-1.5 text-sm text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700"
            >
              添加网页
            </button>
          )}
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
        <BookGrid books={filteredBooks} onChanged={loadBooks} />
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
