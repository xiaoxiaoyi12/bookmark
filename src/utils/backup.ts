import { db } from '../db'

interface BackupData {
  version: number
  exportedAt: number
  books: Record<string, unknown>[]
  highlights: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  readingProgress: Record<string, unknown>[]
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function exportBackup(): Promise<void> {
  const books = await db.books.toArray()
  const highlights = await db.highlights.toArray()
  const notes = await db.notes.toArray()
  const readingProgress = await db.readingProgress.toArray()

  const data: BackupData = {
    version: 1,
    exportedAt: Date.now(),
    books: books.map(b => ({
      ...b,
      fileData: arrayBufferToBase64(b.fileData),
      _fileDataEncoding: 'base64',
    })),
    highlights,
    notes,
    readingProgress,
  }

  const json = JSON.stringify(data)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `bookmark-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<{ books: number; highlights: number; notes: number }> {
  const text = await file.text()
  const data: BackupData = JSON.parse(text)

  if (!data.version || !data.books) {
    throw new Error('无效的备份文件')
  }

  // 建立旧 id → 新 id 的映射（避免 id 冲突）
  const bookIdMap = new Map<number, number>()

  // 获取已有书名用于去重
  const existingBooks = await db.books.toArray()
  const existingTitles = new Set(existingBooks.map(b => `${b.title}_${b.format}`))

  let importedBooks = 0
  let importedHighlights = 0
  let importedNotes = 0

  for (const raw of data.books) {
    const book = raw as Record<string, unknown>
    const oldId = book.id as number

    // 跳过已存在的书（同名同格式）
    const key = `${book.title}_${book.format}`
    if (existingTitles.has(key)) {
      // 找到已有书的 id 做映射
      const existing = existingBooks.find(b => `${b.title}_${b.format}` === key)
      if (existing?.id) bookIdMap.set(oldId, existing.id)
      continue
    }

    // 还原 ArrayBuffer
    let fileData: ArrayBuffer
    if (book._fileDataEncoding === 'base64' && typeof book.fileData === 'string') {
      fileData = base64ToArrayBuffer(book.fileData)
    } else {
      fileData = book.fileData as ArrayBuffer
    }

    const newId = await db.books.add({
      title: book.title as string,
      author: book.author as string,
      format: book.format as 'epub' | 'pdf' | 'web',
      coverUrl: book.coverUrl as string | undefined,
      fileData,
      url: book.url as string | undefined,
      createdAt: book.createdAt as number,
    })

    bookIdMap.set(oldId, newId)
    importedBooks++
  }

  for (const raw of data.highlights) {
    const h = raw as Record<string, unknown>
    const newBookId = bookIdMap.get(h.bookId as number)
    if (!newBookId) continue

    await db.highlights.add({
      bookId: newBookId,
      cfiRange: h.cfiRange as string,
      text: h.text as string,
      color: h.color as string,
      createdAt: h.createdAt as number,
    })
    importedHighlights++
  }

  for (const raw of data.notes) {
    const n = raw as Record<string, unknown>
    const newBookId = bookIdMap.get(n.bookId as number)
    if (!newBookId) continue

    const existing = await db.notes.where('bookId').equals(newBookId).first()
    if (!existing) {
      await db.notes.add({
        bookId: newBookId,
        content: n.content as string,
        updatedAt: n.updatedAt as number,
      })
      importedNotes++
    }
  }

  for (const raw of data.readingProgress) {
    const p = raw as Record<string, unknown>
    const newBookId = bookIdMap.get(p.bookId as number)
    if (!newBookId) continue

    await db.readingProgress.put({
      bookId: newBookId,
      location: p.location as string,
      updatedAt: p.updatedAt as number,
    })
  }

  return { books: importedBooks, highlights: importedHighlights, notes: importedNotes }
}
