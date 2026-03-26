import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'

interface Props {
  content: string
  onUpdate: (json: string) => void
}

const TEXT_COLORS = [
  { label: '默认', value: '', dot: '#d1d5db', ring: '#6b7280' },
  { label: '红色', value: '#f87171', dot: '#f87171', ring: '#f87171' },
  { label: '橙色', value: '#fb923c', dot: '#fb923c', ring: '#fb923c' },
  { label: '琥珀', value: '#fbbf24', dot: '#fbbf24', ring: '#fbbf24' },
  { label: '绿色', value: '#4ade80', dot: '#4ade80', ring: '#4ade80' },
  { label: '青色', value: '#22d3ee', dot: '#22d3ee', ring: '#22d3ee' },
  { label: '蓝色', value: '#60a5fa', dot: '#60a5fa', ring: '#60a5fa' },
  { label: '紫色', value: '#a78bfa', dot: '#a78bfa', ring: '#a78bfa' },
  { label: '粉色', value: '#f472b6', dot: '#f472b6', ring: '#f472b6' },
  { label: '灰色', value: '#9ca3af', dot: '#9ca3af', ring: '#9ca3af' },
]

const HIGHLIGHT_COLORS = [
  { label: '清除', value: '', bg: 'transparent', ring: '#6b7280' },
  { label: '黄色', value: '#fbbf2440', bg: '#fbbf24', ring: '#fbbf24' },
  { label: '绿色', value: '#4ade8040', bg: '#4ade80', ring: '#4ade80' },
  { label: '蓝色', value: '#60a5fa40', bg: '#60a5fa', ring: '#60a5fa' },
  { label: '粉色', value: '#f472b640', bg: '#f472b6', ring: '#f472b6' },
  { label: '紫色', value: '#a78bfa40', bg: '#a78bfa', ring: '#a78bfa' },
]

export default function TiptapEditor({ content, onUpdate }: Props) {
  const initialContent = useRef(content)
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: 'tiptap-code-block' } },
      }),
      Placeholder.configure({ placeholder: '开始写笔记...' }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialContent.current ? JSON.parse(initialContent.current) : undefined,
    onUpdate: ({ editor }) => {
      onUpdate(JSON.stringify(editor.getJSON()))
    },
  })

  useEffect(() => {
    if (editor) {
      (window as unknown as Record<string, unknown>).__tiptapEditor = editor
    }
    return () => { (window as unknown as Record<string, unknown>).__tiptapEditor = undefined }
  }, [editor])

  useEffect(() => {
    if (!showColorPicker) return
    const close = () => setShowColorPicker(null)
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0)
    return () => document.removeEventListener('click', close)
  }, [showColorPicker])

  if (!editor) return null

  const btn = (active: boolean) =>
    `px-1.5 py-1 text-xs rounded transition-colors ${active ? 'bg-blue-600/80 text-white' : 'text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'}`

  const currentColor = editor.getAttributes('textStyle').color || ''

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex gap-0.5 px-2 py-1.5 border-b border-gray-700/80 shrink-0 flex-wrap items-center select-none">
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive('heading', { level: 2 }))} title="二级标题">
          H2
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btn(editor.isActive('heading', { level: 3 }))} title="三级标题">
          H3
        </button>

        <span className="w-px h-3.5 bg-gray-700/60 mx-1" />

        <button onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive('bold'))} title="粗体">
          <strong>B</strong>
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive('italic'))} title="斜体">
          <em>I</em>
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btn(editor.isActive('underline'))} title="下划线">
          <span className="underline">U</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btn(editor.isActive('strike'))} title="删除线">
          <span className="line-through">S</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleCode().run()}
          className={btn(editor.isActive('code'))} title="行内代码">
          <span className="font-mono text-[10px]">&lt;/&gt;</span>
        </button>

        <span className="w-px h-3.5 bg-gray-700/60 mx-1" />

        {/* 字体颜色 */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(showColorPicker === 'text' ? null : 'text') }}
            className={`${btn(!!currentColor)} relative`}
            title="文字颜色"
          >
            <span className="font-semibold">A</span>
            <span
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3.5 h-0.75 rounded-full transition-colors"
              style={{ backgroundColor: currentColor || '#d1d5db' }}
            />
          </button>
          {showColorPicker === 'text' && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-600/50 z-50"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">文字颜色</p>
              <div className="flex gap-2">
                {TEXT_COLORS.map(c => {
                  const isActive = c.value ? currentColor === c.value : !currentColor
                  return (
                    <button key={c.value || 'default'} title={c.label}
                      onClick={() => {
                        if (c.value) editor.chain().focus().setColor(c.value).run()
                        else editor.chain().focus().unsetColor().run()
                        setShowColorPicker(null)
                      }}
                      className={`w-6 h-6 rounded-full transition-all duration-150 border-2
                        ${isActive ? 'scale-110' : 'border-transparent hover:scale-110'}
                      `}
                      style={{
                        backgroundColor: c.value ? `${c.dot}30` : 'transparent',
                        borderColor: isActive ? c.ring : undefined,
                        boxShadow: isActive ? `0 0 8px ${c.ring}40` : undefined,
                      }}
                    >
                      {!c.value ? (
                        <span className="flex items-center justify-center w-full h-full">
                          <svg className="w-3 h-3 text-gray-500" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="2" y1="2" x2="10" y2="10" />
                            <line x1="10" y1="2" x2="2" y2="10" />
                          </svg>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center w-full h-full">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.dot }} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 背景高亮 */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(showColorPicker === 'bg' ? null : 'bg') }}
            className={`${btn(editor.isActive('highlight'))}`}
            title="背景高亮"
          >
            <span className="font-semibold px-0.5 rounded-sm" style={{ backgroundColor: 'rgba(251,191,36,0.25)' }}>H</span>
          </button>
          {showColorPicker === 'bg' && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-600/50 z-50"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">背景高亮</p>
              <div className="flex gap-2">
                {HIGHLIGHT_COLORS.map(c => {
                  const isActive = c.value
                    ? editor.isActive('highlight', { color: c.value })
                    : !editor.isActive('highlight')
                  return (
                    <button key={c.value || 'none'} title={c.label}
                      onClick={() => {
                        if (c.value) editor.chain().focus().toggleHighlight({ color: c.value }).run()
                        else editor.chain().focus().unsetHighlight().run()
                        setShowColorPicker(null)
                      }}
                      className={`w-6 h-6 rounded-full transition-all duration-150 border-2
                        ${isActive ? 'scale-110' : 'border-transparent hover:scale-110'}
                      `}
                      style={{
                        backgroundColor: c.value ? `${c.bg}30` : 'transparent',
                        borderColor: isActive ? c.ring : undefined,
                        boxShadow: isActive ? `0 0 8px ${c.ring}40` : undefined,
                      }}
                    >
                      {!c.value ? (
                        <span className="flex items-center justify-center w-full h-full">
                          <svg className="w-3 h-3 text-gray-500" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="2" y1="2" x2="10" y2="10" />
                            <line x1="10" y1="2" x2="2" y2="10" />
                          </svg>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center w-full h-full">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.bg }} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <span className="w-px h-3.5 bg-gray-700/60 mx-1" />

        <button onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive('bulletList'))} title="无序列表">
          <span className="flex items-center gap-0.5"><span className="text-[8px]">&#9679;</span>列表</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive('orderedList'))} title="有序列表">
          <span className="flex items-center gap-0.5"><span className="text-[9px] font-mono">1.</span>列表</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={btn(editor.isActive('taskList'))} title="任务列表">
          <span className="flex items-center gap-0.5">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <path d="M5 8l2 2 4-4" />
            </svg>
            待办
          </span>
        </button>

        <span className="w-px h-3.5 bg-gray-700/60 mx-1" />

        <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btn(editor.isActive('blockquote'))} title="引用">
          <span className="flex items-center gap-0.5">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 3h2v2H3V3zm0 4h10v1H3V7zm0 3h10v1H3v-1z" opacity="0.7"/>
            </svg>
            引用
          </span>
        </button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={btn(editor.isActive('codeBlock'))} title="代码块">
          <span className="flex items-center gap-0.5">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 4L1.5 8 5 12M11 4l3.5 4L11 12" />
            </svg>
            代码
          </span>
        </button>
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={btn(false)} title="分割线">
          <svg className="w-3.5 h-3" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="1" y1="6" x2="15" y2="6" />
          </svg>
        </button>
      </div>

      {/* 编辑器 */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto p-4 prose prose-invert prose-sm max-w-none"
      />
    </div>
  )
}
