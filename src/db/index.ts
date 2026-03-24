import Dexie, { type Table } from 'dexie'
import type { Book, Highlight, Note, ReadingProgress } from '../types'

class BookMarkDB extends Dexie {
  books!: Table<Book, number>
  highlights!: Table<Highlight, number>
  notes!: Table<Note, number>
  readingProgress!: Table<ReadingProgress, number>

  constructor() {
    super('bookmark-db')
    this.version(1).stores({
      books: '++id, title, format, createdAt',
      highlights: '++id, bookId, createdAt',
      notes: '++id, bookId',
      readingProgress: 'bookId',
    })
  }
}

export const db = new BookMarkDB()
