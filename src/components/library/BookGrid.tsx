import type { Book } from '../../types'
import BookCard from './BookCard'

interface Props {
  books: Book[]
  onChanged: () => void
}

export default function BookGrid({ books, onChanged }: Props) {
  if (books.length === 0) {
    return <p className="text-gray-500 text-center py-12">还没有书籍，导入一本开始吧。</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {books.map(book => (
        <BookCard key={book.id} book={book} onDeleted={onChanged} />
      ))}
    </div>
  )
}
