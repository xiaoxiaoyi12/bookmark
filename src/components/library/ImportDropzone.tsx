import { useCallback, useRef, useEffect, useState } from 'react'
import { db } from '../../db'
import { extractEpubMetadata } from '../../utils/epub-metadata'
import type { Book } from '../../types'

interface Props {
  onImported: () => void
}

export default function ImportDropzone({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Tauri 拖放是否已接管（浏览器 onDrop 在 Tauri 中不生效，避免重复处理）
  const tauriActive = useRef(false)

  const importBook = useCallback(async (fileName: string, data: ArrayBuffer) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext !== 'epub' && ext !== 'pdf') return

    const format = ext as 'epub' | 'pdf'
    let title = fileName.replace(/\.[^.]+$/, '')
    let author = '未知作者'
    let coverUrl: string | undefined

    if (format === 'epub') {
      try {
        const meta = await extractEpubMetadata(data.slice(0))
        title = meta.title
        author = meta.author
        coverUrl = meta.coverUrl
      } catch {
        // 元数据提取失败，使用文件名
      }
    }

    const book: Book = { title, author, format, coverUrl, fileData: data, createdAt: Date.now() }
    await db.books.add(book)
  }, [])

  // 浏览器 File 对象导入
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      const data = await file.arrayBuffer()
      await importBook(file.name, data)
    }
    if (inputRef.current) inputRef.current.value = ''
    onImported()
  }, [onImported, importBook])

  // Tauri 文件路径导入
  const handleTauriPaths = useCallback(async (paths: string[]) => {
    const { invoke } = await import('@tauri-apps/api/core')
    for (const path of paths) {
      const ext = path.split('.').pop()?.toLowerCase()
      if (ext !== 'epub' && ext !== 'pdf') continue
      const fileName = path.split('/').pop() || path.split('\\').pop() || path
      const result = await invoke('read_file', { path })
      // Tauri v2 对 Vec<u8> 可能返回 ArrayBuffer 或 number[]
      const data = result instanceof ArrayBuffer
        ? result
        : new Uint8Array(result as number[]).buffer
      await importBook(fileName, data)
    }
    onImported()
  }, [onImported, importBook])

  // Tauri 拖放监听（StrictMode 安全：用 cancelled flag 防止旧 effect 注册）
  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | null = null

    import('@tauri-apps/api/webview').then(({ getCurrentWebview }) => {
      if (cancelled) return
      return getCurrentWebview().onDragDropEvent((event) => {
        if (cancelled) return
        if (event.payload.type === 'over') {
          setIsDragging(true)
        } else if (event.payload.type === 'drop') {
          setIsDragging(false)
          handleTauriPaths(event.payload.paths)
        } else {
          setIsDragging(false)
        }
      })
    }).then(fn => {
      if (cancelled) {
        fn?.()  // 已被 cleanup，立即取消注册
      } else {
        unlisten = fn ?? null
        tauriActive.current = true
      }
    }).catch(() => {})

    return () => {
      cancelled = true
      unlisten?.()
      tauriActive.current = false
    }
  }, [handleTauriPaths])

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-amber-500 bg-amber-50/50 dark:border-amber-400 dark:bg-amber-900/20'
          : 'border-amber-300 dark:border-gray-600 hover:border-amber-400 dark:hover:border-gray-400'
      }`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        if (!tauriActive.current) handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".epub,.pdf"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <p className="text-amber-700/70 dark:text-gray-400 text-lg">
        {isDragging ? '松开以导入文件' : '拖拽 EPUB / PDF 文件到这里，或点击导入'}
      </p>
    </div>
  )
}
