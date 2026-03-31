import { useCallback, useRef, useEffect, useState } from 'react'
import { db } from '../../db'
import { extractEpubMetadata } from '../../utils/epub-metadata'
import type { Book } from '../../types'

declare const __IS_TAURI__: boolean

interface Props {
  onImported: () => void
}

export default function ImportDropzone({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // 通用：从文件名和 ArrayBuffer 导入一本书
  const importBook = useCallback(async (fileName: string, data: ArrayBuffer) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext !== 'epub' && ext !== 'pdf') return

    const format = ext as 'epub' | 'pdf'
    let title = fileName.replace(/\.[^.]+$/, '')
    let author = '未知作者'
    let coverUrl: string | undefined

    if (format === 'epub') {
      const meta = await extractEpubMetadata(data)
      title = meta.title
      author = meta.author
      coverUrl = meta.coverUrl
    }

    const book: Book = {
      title,
      author,
      format,
      coverUrl,
      fileData: data,
      createdAt: Date.now(),
    }

    await db.books.add(book)
  }, [])

  // 浏览器 File 对象批量导入
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      const data = await file.arrayBuffer()
      await importBook(file.name, data)
    }
    if (inputRef.current) inputRef.current.value = ''
    onImported()
  }, [onImported, importBook])

  // Tauri 拖放：通过文件路径读取
  const handleTauriPaths = useCallback(async (paths: string[]) => {
    const { invoke } = await import('@tauri-apps/api/core')
    for (const path of paths) {
      const ext = path.split('.').pop()?.toLowerCase()
      if (ext !== 'epub' && ext !== 'pdf') continue
      const fileName = path.split('/').pop() || path.split('\\').pop() || path
      const bytes: number[] = await invoke('read_file', { path })
      const data = new Uint8Array(bytes).buffer
      await importBook(fileName, data)
    }
    onImported()
  }, [onImported, importBook])

  // Tauri 环境：监听系统级拖放事件
  useEffect(() => {
    if (!__IS_TAURI__) return

    let unlisten: (() => void) | null = null

    import('@tauri-apps/api/webview').then(({ getCurrentWebview }) => {
      getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === 'over') {
          setIsDragging(true)
        } else if (event.payload.type === 'drop') {
          setIsDragging(false)
          handleTauriPaths(event.payload.paths)
        } else {
          setIsDragging(false)
        }
      }).then(fn => { unlisten = fn })
    })

    return () => { unlisten?.() }
  }, [handleTauriPaths])

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-amber-500 bg-amber-50/50 dark:border-amber-400 dark:bg-amber-900/20'
          : 'border-amber-300 dark:border-gray-600 hover:border-amber-400 dark:hover:border-gray-400'
      }`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
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
