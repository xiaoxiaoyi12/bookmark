import { useState, useEffect } from 'react'
import { db } from '../../db'
import type { Highlight } from '../../types'

interface Props {
  bookId: number
}

export default function HighlightList({ bookId }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    db.highlights.where('bookId').equals(bookId)
      .reverse().sortBy('createdAt')
      .then(setHighlights)
  }, [bookId])

  if (highlights.length === 0) return null

  return (
    <div className="border-t border-gray-700">
      <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
        高亮 ({highlights.length})
      </h3>
      <div className="max-h-60 overflow-y-auto">
        {highlights.map(h => (
          <div key={h.id} className="px-4 py-2 border-b border-gray-800">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: h.color }} />
              <p className="text-sm text-gray-300 line-clamp-3">{h.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
