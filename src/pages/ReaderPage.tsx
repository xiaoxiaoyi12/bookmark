import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../db'
import type { Book, ReaderHandle } from '../types'
import { useReaderStore } from '../stores/useReaderStore'
import EpubReader from '../components/reader/EpubReader'
import PdfReader from '../components/reader/PdfReader'
import NotePanel from '../components/notes/NotePanel'
import SearchBar from '../components/reader/SearchBar'

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const { noteOpen, toggleToc, toggleNote, searchOpen, toggleSearch } = useReaderStore()
  const readerRef = useRef<ReaderHandle>(null)

  // 可拖拽调整笔记面板宽度
  const [noteWidth, setNoteWidth] = useState(360)
  const resizing = useRef(false)

  useEffect(() => {
    if (!bookId) return
    db.books.get(Number(bookId)).then(b => {
      if (!b) navigate('/')
      else setBook(b)
    })
  }, [bookId, navigate])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const newWidth = window.innerWidth - e.clientX
      setNoteWidth(Math.max(240, Math.min(600, newWidth)))
    }
    const handleMouseUp = () => { resizing.current = false }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  if (!book) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">加载中...</div>

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="h-12 border-b border-gray-700 flex items-center px-4 shrink-0 relative select-none">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm mr-4">&larr; 书库</button>
        <h1 className="text-sm text-white font-medium truncate flex-1">{book.title}</h1>
        <button onClick={toggleSearch} className={`text-sm mx-2 transition-colors ${searchOpen ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}>搜索</button>
        <button onClick={toggleToc} className="text-gray-400 hover:text-white text-sm mx-2">目录</button>
        <button onClick={toggleNote} className="text-gray-400 hover:text-white text-sm">笔记</button>

        {book.id && (
          <SearchBar bookId={book.id} readerRef={readerRef} />
        )}
      </div>

      {/* 阅读区域 */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0">
          {book.format === 'epub' && book.id && (
            <EpubReader ref={readerRef} bookId={book.id} fileData={book.fileData} />
          )}
          {book.format === 'pdf' && book.id && (
            <PdfReader ref={readerRef} bookId={book.id} fileData={book.fileData} />
          )}
        </div>

        {noteOpen && (
          <div
            className="w-1 bg-gray-700 hover:bg-blue-500 cursor-col-resize shrink-0"
            onMouseDown={() => { resizing.current = true }}
          />
        )}

        {noteOpen && book.id && (
          <div className="border-l border-gray-700 shrink-0" style={{ width: noteWidth }}>
            <NotePanel bookId={book.id} readerRef={readerRef} />
          </div>
        )}
      </div>
    </div>
  )
}
