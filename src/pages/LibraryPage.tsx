import { useState, useEffect, useCallback } from 'react'
import { db } from '../db'
import type { Book } from '../types'
import ImportDropzone from '../components/library/ImportDropzone'
import BookGrid from '../components/library/BookGrid'

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])

  const loadBooks = useCallback(async () => {
    const all = await db.books.orderBy('createdAt').reverse().toArray()
    setBooks(all)
  }, [])

  useEffect(() => { loadBooks() }, [loadBooks])

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-6">BookMark</h1>
      <ImportDropzone onImported={loadBooks} />
      <div className="mt-8">
        <BookGrid books={books} onChanged={loadBooks} />
      </div>
    </div>
  )
}
