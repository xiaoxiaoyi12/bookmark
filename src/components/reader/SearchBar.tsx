import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../../db'
import { useReaderStore } from '../../stores/useReaderStore'
import type { SearchResult, ReaderHandle } from '../../types'

interface Props {
  bookId: number
  readerRef: React.RefObject<ReaderHandle | null>
}

type Tab = 'content' | 'note' | 'highlight'

function extractTiptapText(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) || ''
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractTiptapText).join(' ')
  }
  return ''
}

export default function SearchBar({ bookId, readerRef }: Props) {
  const { searchOpen, searchQuery, setSearchQuery, toggleSearch } = useReaderStore()
  const [activeTab, setActiveTab] = useState<Tab>('content')
  const [results, setResults] = useState<{ content: SearchResult[]; note: SearchResult[]; highlight: SearchResult[] }>({
    content: [], note: [], highlight: [],
  })
  const [searching, setSearching] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 聚焦输入框
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [searchOpen])

  // Cmd/Ctrl+F 快捷键
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        toggleSearch()
      }
      if (e.key === 'Escape' && searchOpen) {
        toggleSearch()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [searchOpen, toggleSearch])

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults({ content: [], note: [], highlight: [] })
      return
    }

    setSearching(true)
    const q = query.toLowerCase()

    // 并行搜索书籍内容、笔记、高亮
    const [contentResults, noteResults, highlightResults] = await Promise.all([
      // 书籍内容搜索
      readerRef.current?.search(query) ?? Promise.resolve([]),

      // 笔记搜索
      (async () => {
        const note = await db.notes.where('bookId').equals(bookId).first()
        if (!note?.content) return []
        try {
          const json = JSON.parse(note.content)
          const text = extractTiptapText(json)
          const lower = text.toLowerCase()
          const items: SearchResult[] = []
          let idx = lower.indexOf(q)
          while (idx !== -1) {
            const start = Math.max(0, idx - 40)
            const end = Math.min(text.length, idx + query.length + 40)
            items.push({
              type: 'note',
              text: (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : ''),
            })
            idx = lower.indexOf(q, idx + 1)
          }
          return items
        } catch { return [] }
      })(),

      // 高亮搜索
      (async () => {
        const highlights = await db.highlights.where('bookId').equals(bookId).toArray()
        return highlights
          .filter(h => h.text.toLowerCase().includes(q))
          .map(h => ({
            type: 'highlight' as const,
            text: h.text,
            location: h.cfiRange,
            page: h.cfiRange.startsWith('page:') ? Number(h.cfiRange.split(':')[1]) : undefined,
          }))
      })(),
    ])

    setResults({
      content: contentResults,
      note: noteResults,
      highlight: highlightResults,
    })
    setCurrentIdx(0)

    // 自动切到有结果的 tab
    if (contentResults.length > 0) setActiveTab('content')
    else if (noteResults.length > 0) setActiveTab('note')
    else if (highlightResults.length > 0) setActiveTab('highlight')

    setSearching(false)
  }, [bookId, readerRef])

  // 输入防抖
  const handleInput = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 400)
  }

  const currentResults = results[activeTab]
  const totalCount = results.content.length + results.note.length + results.highlight.length

  const handleResultClick = (result: SearchResult, idx: number) => {
    setCurrentIdx(idx)
    if (result.type === 'content' || result.type === 'highlight') {
      readerRef.current?.goTo(result)
    }
  }

  const handlePrev = () => {
    if (currentResults.length === 0) return
    const next = (currentIdx - 1 + currentResults.length) % currentResults.length
    setCurrentIdx(next)
    handleResultClick(currentResults[next], next)
  }

  const handleNext = () => {
    if (currentResults.length === 0) return
    const next = (currentIdx + 1) % currentResults.length
    setCurrentIdx(next)
    handleResultClick(currentResults[next], next)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.shiftKey ? handlePrev() : handleNext()
    }
  }

  if (!searchOpen) return null

  const tabBtn = (tab: Tab, label: string, count: number) => (
    <button
      onClick={() => { setActiveTab(tab); setCurrentIdx(0) }}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        activeTab === tab
          ? 'bg-blue-600/80 text-white'
          : 'text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200'
      }`}
    >
      {label}{count > 0 && <span className="ml-1 text-[10px] opacity-70">({count})</span>}
    </button>
  )

  return (
    <div className="absolute top-12 right-4 z-40 w-96 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-amber-200/50 dark:border-gray-600/50 overflow-hidden select-none">
      {/* 搜索输入 */}
      <div className="flex items-center gap-2 p-3 border-b border-amber-200/60 dark:border-gray-700/60">
        <svg className="w-4 h-4 text-amber-400 dark:text-gray-500 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="M10 10l4 4" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索书籍内容、笔记、高亮..."
          className="flex-1 bg-transparent text-sm text-amber-900 dark:text-gray-200 placeholder-amber-400 dark:placeholder-gray-500 outline-none"
        />
        {searching && (
          <span className="text-[10px] text-amber-500 dark:text-gray-500">搜索中...</span>
        )}
        {!searching && searchQuery && (
          <span className="text-[10px] text-amber-500 dark:text-gray-500">{totalCount} 条结果</span>
        )}
        <div className="flex gap-0.5">
          <button onClick={handlePrev} className="p-1 text-amber-600 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white rounded hover:bg-amber-100 dark:hover:bg-gray-700/60" title="上一个">
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 10L5 6l4-4" /></svg>
          </button>
          <button onClick={handleNext} className="p-1 text-amber-600 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white rounded hover:bg-amber-100 dark:hover:bg-gray-700/60" title="下一个">
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2l4 4-4 4" /></svg>
          </button>
        </div>
        <button onClick={toggleSearch} className="p-1 text-amber-600 hover:text-amber-900 dark:text-gray-400 dark:hover:text-white rounded hover:bg-amber-100 dark:hover:bg-gray-700/60" title="关闭">
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      {searchQuery && (
        <div className="flex gap-1 px-3 py-2 border-b border-amber-200/40 dark:border-gray-700/40">
          {tabBtn('content', '书籍内容', results.content.length)}
          {tabBtn('note', '笔记', results.note.length)}
          {tabBtn('highlight', '高亮', results.highlight.length)}
        </div>
      )}

      {/* 结果列表 */}
      {searchQuery && (
        <div className="max-h-72 overflow-y-auto">
          {currentResults.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-amber-500 dark:text-gray-500">
              {searching ? '正在搜索...' : '没有找到匹配结果'}
            </div>
          ) : (
            currentResults.map((r, i) => (
              <button
                key={i}
                onClick={() => handleResultClick(r, i)}
                className={`w-full text-left px-3 py-2 text-xs border-b border-amber-100/50 dark:border-gray-700/30 transition-colors ${
                  i === currentIdx ? 'bg-blue-600/20' : 'hover:bg-amber-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  {r.page && (
                    <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 dark:bg-gray-700 rounded text-[10px] text-amber-600 dark:text-gray-400">
                      P{r.page}
                    </span>
                  )}
                  <span className="text-amber-800 dark:text-gray-300 line-clamp-2 leading-relaxed">
                    <HighlightText text={r.text} query={searchQuery} />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-500/40 text-yellow-800 dark:text-yellow-200 rounded-sm px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}
