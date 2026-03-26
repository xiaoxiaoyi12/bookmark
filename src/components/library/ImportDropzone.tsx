import { useCallback } from 'react'
import { db } from '../../db'
import { extractEpubMetadata } from '../../utils/epub-metadata'
import type { Book } from '../../types'

interface Props {
  onImported: () => void
}

export default function ImportDropzone({ onImported }: Props) {
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext !== 'epub' && ext !== 'pdf') continue

      const data = await file.arrayBuffer()
      const format = ext as 'epub' | 'pdf'

      let title = file.name.replace(/\.[^.]+$/, '')
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
    }

    onImported()
  }, [onImported])

  return (
    <div
      className="border-2 border-dashed border-amber-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-amber-400 dark:hover:border-gray-400 transition-colors"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.epub,.pdf'
        input.multiple = true
        input.onchange = () => handleFiles(input.files)
        input.click()
      }}
    >
      <p className="text-amber-700/70 dark:text-gray-400 text-lg">拖拽 EPUB / PDF 文件到这里，或点击导入</p>
    </div>
  )
}
