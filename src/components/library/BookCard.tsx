import { useNavigate } from 'react-router-dom'
import type { Book } from '../../types'
import { db } from '../../db'

interface Props {
  book: Book
  onDeleted: () => void
}

export default function BookCard({ book, onDeleted }: Props) {
  const navigate = useNavigate()

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!book.id) return
    await db.books.delete(book.id)
    await db.highlights.where('bookId').equals(book.id).delete()
    await db.notes.where('bookId').equals(book.id).delete()
    await db.readingProgress.delete(book.id)
    onDeleted()
  }

  return (
    <div
      className="group relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
      onClick={() => navigate(`/read/${book.id}`)}
    >
      <div className="aspect-[3/4] bg-gray-700 flex items-center justify-center">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-4xl text-gray-500">📖</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate">{book.title}</h3>
        <p className="text-xs text-gray-400 truncate">{book.author}</p>
        <span className="text-xs text-gray-500 uppercase">{book.format}</span>
      </div>
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 hidden group-hover:block bg-red-600 text-white rounded-full w-6 h-6 text-xs leading-none"
      >
        ✕
      </button>
    </div>
  )
}
