import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  content: string    // JSON 字符串
  onUpdate: (json: string) => void
}

export default function TiptapEditor({ content, onUpdate }: Props) {
  const initialContent = useRef(content)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始写笔记...' }),
    ],
    content: initialContent.current ? JSON.parse(initialContent.current) : undefined,
    onUpdate: ({ editor }) => {
      onUpdate(JSON.stringify(editor.getJSON()))
    },
  })

  // 暴露编辑器实例，供外部插入高亮引用
  useEffect(() => {
    if (editor) {
      (window as unknown as Record<string, unknown>).__tiptapEditor = editor
    }
    return () => { (window as unknown as Record<string, unknown>).__tiptapEditor = undefined }
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex gap-1 p-2 border-b border-gray-700 shrink-0 flex-wrap">
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 text-xs rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
          H2
        </button>
        <button onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 text-xs rounded ${editor.isActive('bold') ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
          B
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 text-xs rounded ${editor.isActive('italic') ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
          I
        </button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 text-xs rounded ${editor.isActive('bulletList') ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
          列表
        </button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 text-xs rounded ${editor.isActive('blockquote') ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
          引用
        </button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 text-xs rounded ${editor.isActive('codeBlock') ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
          代码
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
