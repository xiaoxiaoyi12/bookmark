import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../db'
import type { Book, ReaderHandle } from '../types'
import { useReaderStore } from '../stores/useReaderStore'
import { useAIStore } from '../stores/useAIStore'
import EpubReader from '../components/reader/EpubReader'
import PdfReader from '../components/reader/PdfReader'
import WebReader from '../components/reader/WebReader'
import NotePanel from '../components/notes/NotePanel'
import AIChatPanel from '../components/ai/AIChatPanel'
import SearchBar from '../components/reader/SearchBar'
import ThemeToggle from '../components/ThemeToggle'

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const { noteOpen, toggleToc, toggleNote, searchOpen, toggleSearch } = useReaderStore()
  const { aiOpen, toggleAI } = useAIStore()
  const readerRef = useRef<ReaderHandle>(null)
  const readerContainerRef = useRef<HTMLDivElement>(null)

  // 可拖拽调整面板宽度
  const [noteWidth, setNoteWidth] = useState(360)
  const [aiWidth, setAIWidth] = useState(360)
  const resizing = useRef<false | 'note' | 'ai'>(false)

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
      if (resizing.current === 'note') {
        setNoteWidth(Math.max(240, Math.min(600, newWidth)))
      } else if (resizing.current === 'ai') {
        setAIWidth(Math.max(280, Math.min(600, newWidth)))
      }
    }
    const handleMouseUp = () => { resizing.current = false }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const getBookContent = useCallback(() => {
    return readerContainerRef.current?.innerText || ''
  }, [])

  if (!book) return <div className="min-h-screen bg-[#faf6f0] dark:bg-gray-900 flex items-center justify-center text-amber-700 dark:text-gray-400">加载中...</div>

  return (
    <div className="h-screen bg-[#faf6f0] dark:bg-gray-900 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="h-12 border-b border-amber-200 dark:border-gray-700 flex items-center px-4 shrink-0 relative select-none">
        <button onClick={() => navigate('/')} className="text-amber-700 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white text-sm mr-4">&larr; 书库</button>
        <h1 className="text-sm text-amber-900 dark:text-white font-medium truncate flex-1">{book.title}</h1>
        <button onClick={toggleSearch} className={`text-sm mx-2 transition-colors ${searchOpen ? 'text-blue-500 dark:text-blue-400' : 'text-amber-700 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white'}`}>搜索</button>
        <button onClick={toggleToc} className="text-amber-700 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white text-sm mx-2">目录</button>
        <button onClick={toggleNote} className="text-amber-700 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white text-sm mr-2">笔记</button>
        <button onClick={toggleAI} className={`text-sm mx-2 transition-colors ${aiOpen ? 'text-blue-500 dark:text-blue-400' : 'text-amber-700 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white'}`}>AI</button>
        <ThemeToggle />

        {book.id && (
          <SearchBar bookId={book.id} readerRef={readerRef} />
        )}
      </div>

      {/* 阅读区域 */}
      <div className="flex-1 min-h-0 flex">
        <div ref={readerContainerRef} className="flex-1 min-w-0">
          {book.format === 'epub' && book.id && (
            <EpubReader ref={readerRef} bookId={book.id} fileData={book.fileData} />
          )}
          {book.format === 'pdf' && book.id && (
            <PdfReader ref={readerRef} bookId={book.id} fileData={book.fileData} />
          )}
          {book.format === 'web' && book.id && (
            <WebReader ref={readerRef} bookId={book.id} fileData={book.fileData} url={book.url} />
          )}
        </div>

        {noteOpen && (
          <div
            className="w-1 bg-amber-200 hover:bg-blue-500 dark:bg-gray-700 dark:hover:bg-blue-500 cursor-col-resize shrink-0"
            onMouseDown={() => { resizing.current = 'note' }}
          />
        )}

        {noteOpen && book.id && (
          <div className="border-l border-amber-200 dark:border-gray-700 shrink-0" style={{ width: noteWidth }}>
            <NotePanel bookId={book.id} readerRef={readerRef} />
          </div>
        )}

        {aiOpen && (
          <div
            className="w-1 bg-amber-200 hover:bg-blue-500 dark:bg-gray-700 dark:hover:bg-blue-500 cursor-col-resize shrink-0"
            onMouseDown={() => { resizing.current = 'ai' }}
          />
        )}

        {aiOpen && book.id && (
          <div className="border-l border-amber-200 dark:border-gray-700 shrink-0" style={{ width: aiWidth }}>
            <AIChatPanel
              bookId={book.id}
              getContent={getBookContent}
            />
          </div>
        )}
      </div>
    </div>
  )
}
