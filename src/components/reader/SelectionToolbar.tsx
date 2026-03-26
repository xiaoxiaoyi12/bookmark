import { useState } from 'react'

const COLORS = ['#FBBF24', '#34D399', '#60A5FA', '#F87171', '#C084FC']

interface Props {
  position: { x: number; y: number }
  onHighlight: (color: string) => void
  onAddToNote: (color: string) => void
  onClose: () => void
}

export default function SelectionToolbar({ position, onHighlight, onAddToNote, onClose }: Props) {
  const [showColors, setShowColors] = useState(false)
  const [action, setAction] = useState<'highlight' | 'note' | null>(null)

  const handleColorPick = (color: string) => {
    if (action === 'highlight') onHighlight(color)
    if (action === 'note') onAddToNote(color)
    setShowColors(false)
    setAction(null)
    onClose()
  }

  return (
    <div
      className="fixed z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-600 p-1 flex gap-1 select-none"
      style={{ left: position.x, top: position.y }}
    >
      {!showColors ? (
        <>
          <button
            className="px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded"
            onClick={() => { setAction('highlight'); setShowColors(true) }}
          >
            高亮
          </button>
          <button
            className="px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded"
            onClick={() => { setAction('note'); setShowColors(true) }}
          >
            添加到笔记
          </button>
          <button
            className="px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded"
            onClick={() => { navigator.clipboard.writeText(window.getSelection()?.toString() || ''); onClose() }}
          >
            复制
          </button>
        </>
      ) : (
        <div className="flex gap-1 p-1">
          {COLORS.map(c => (
            <button
              key={c}
              className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white"
              style={{ backgroundColor: c }}
              onClick={() => handleColorPick(c)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
