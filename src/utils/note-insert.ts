import type { Editor } from '@tiptap/react'

/**
 * 向笔记编辑器末尾追加引用块
 * - 始终插入到文档最末尾（不受当前光标位置影响）
 * - 如果末尾已经在 blockquote 内，先跳出再插入，避免嵌套引用
 */
export function appendQuoteToNote(text: string) {
  const editor = (window as unknown as Record<string, unknown>).__tiptapEditor as Editor | undefined
  if (!editor) return

  // 移动光标到文档末尾
  const endPos = editor.state.doc.content.size
  editor.chain().focus('end').setTextSelection(endPos).run()

  // 如果当前在 blockquote 内，先跳出
  if (editor.isActive('blockquote')) {
    // 在 blockquote 后面插入一个空段落来跳出
    editor.chain()
      .focus()
      .insertContent([{ type: 'paragraph' }])
      .run()

    // 取消 blockquote（确保新段落不在引用内）
    if (editor.isActive('blockquote')) {
      editor.chain().focus().lift('blockquote').run()
    }
  }

  // 插入引用块 + 一个空段落（方便后续继续输入）
  editor.chain().focus().insertContent([
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    { type: 'paragraph' },
  ]).run()
}
