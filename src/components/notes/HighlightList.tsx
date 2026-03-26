import { useState, useEffect } from 'react'
import { db } from '../../db'
import type { Highlight } from '../../types'

interface Props {
  bookId: number
  onDelete?: (highlight: Highlight) => void
}

export default function HighlightList({ bookId, onDelete }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    loadHighlights()
  }, [bookId])

  const loadHighlights = () => {
    db.highlights.where('bookId').equals(bookId)
      .reverse().sortBy('createdAt')
      .then(setHighlights)
  }

  const handleDelete = async (h: Highlight) => {
    if (!h.id) return
    await db.highlights.delete(h.id)
    onDelete?.(h)
    loadHighlights()
  }

  if (highlights.length === 0) return null

  return (
    <div className="border-t border-gray-700">
      <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase select-none">
        高亮 ({highlights.length})
      </h3>
      <div className="max-h-60 overflow-y-auto">
        {highlights.map(h => (
          <div key={h.id} className="group px-4 py-2 border-b border-gray-800 hover:bg-gray-800/50">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: h.color }} />
              <p className="text-sm text-gray-300 line-clamp-3 flex-1">{h.text}</p>
              <button
                onClick={() => handleDelete(h)}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-red-400 transition-opacity"
                title="删除高亮"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
