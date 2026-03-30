import { useState, useRef, useEffect, useCallback } from 'react'
import { useAIStore } from '../../stores/useAIStore'
import {
  chatStream,
  buildSummaryMessages,
  buildQAMessages,
  buildTranslateMessages,
  type ChatMessage,
} from '../../utils/ai-api'
import AISettingsModal from './AISettingsModal'

interface Props {
  bookId: number
  getContent: () => string
}

const MAX_CONTEXT_LENGTH = 8000

export default function AIChatPanel({ bookId, getContent }: Props) {
  const { config, pendingTranslation, clearPendingTranslation } = useAIStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevBookId = useRef(bookId)

  // 切书时重置对话
  useEffect(() => {
    if (bookId !== prevBookId.current) {
      setMessages([])
      setInput('')
      prevBookId.current = bookId
    }
  }, [bookId])

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const getContextText = useCallback(() => {
    const text = getContent()
    return text.length > MAX_CONTEXT_LENGTH
      ? text.slice(0, MAX_CONTEXT_LENGTH) + '\n\n[...文档内容过长，已截断...]'
      : text
  }, [getContent])

  const runStream = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!config.apiKey) {
        setSettingsOpen(true)
        return
      }

      setLoading(true)
      const controller = new AbortController()
      abortRef.current = controller

      // 添加空的 assistant 消息用于流式填充
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      try {
        let full = ''
        for await (const chunk of chatStream(config, msgs, controller.signal)) {
          full += chunk
          setMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: full }
            return next
          })
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        const errMsg = err instanceof Error ? err.message : '未知错误'
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: `❌ ${errMsg}`,
          }
          return next
        })
      } finally {
        setLoading(false)
        abortRef.current = null
      }
    },
    [config],
  )

  // 处理选中文本翻译请求
  useEffect(() => {
    if (pendingTranslation && !loading) {
      clearPendingTranslation()
      const userMsg: ChatMessage = { role: 'user', content: `请翻译以下内容：\n\n${pendingTranslation}` }
      setMessages((prev) => [...prev, userMsg])
      runStream(buildTranslateMessages(pendingTranslation))
    }
  }, [pendingTranslation, loading, clearPendingTranslation, runStream])

  const handleSummary = () => {
    const text = getContextText()
    const userMsg: ChatMessage = { role: 'user', content: '请为这篇文档生成摘要' }
    setMessages((prev) => [...prev, userMsg])
    runStream(buildSummaryMessages(text))
  }

  const handleTranslate = () => {
    const text = getContextText()
    const userMsg: ChatMessage = { role: 'user', content: '请翻译这篇文档' }
    setMessages((prev) => [...prev, userMsg])
    runStream(buildTranslateMessages(text))
  }

  const handleSend = () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    const userMsg: ChatMessage = { role: 'user', content: q }
    setMessages((prev) => [...prev, userMsg])
    const context = getContextText()
    runStream(buildQAMessages(context, messages, q))
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasKey = !!config.apiKey

  return (
    <div className="h-full flex flex-col bg-[#faf6f0] dark:bg-gray-900">
      {/* 顶部栏 */}
      <div className="shrink-0 px-3 py-2 border-b border-amber-200 dark:border-gray-700 flex items-center gap-1 select-none">
        <span className="text-sm font-medium text-amber-900 dark:text-white flex-1">AI 助手</span>
        <button
          onClick={handleSummary}
          disabled={loading || !hasKey}
          className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 disabled:opacity-40 transition-colors"
          title="生成摘要"
        >
          摘要
        </button>
        <button
          onClick={handleTranslate}
          disabled={loading || !hasKey}
          className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 disabled:opacity-40 transition-colors"
          title="翻译文档"
        >
          翻译
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1 text-gray-500 hover:text-amber-700 dark:text-gray-400 dark:hover:text-white transition-colors"
          title="AI 设置"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {!hasKey && messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">请先配置 API Key</p>
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline"
            >
              打开设置
            </button>
          </div>
        )}
        {hasKey && messages.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
            <p>点击「摘要」生成文档摘要</p>
            <p className="mt-1">或直接输入问题进行问答</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-amber-200 dark:border-gray-700'
              }`}
            >
              {msg.content || (loading && i === messages.length - 1 ? '思考中...' : '')}
            </div>
          </div>
        ))}
      </div>

      {/* 底部输入 */}
      <div className="shrink-0 border-t border-amber-200 dark:border-gray-700 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasKey ? '输入问题...' : '请先配置 API Key'}
            disabled={!hasKey}
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 disabled:opacity-50"
          />
          {loading ? (
            <button
              onClick={handleStop}
              className="shrink-0 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !hasKey}
              className="shrink-0 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors"
            >
              发送
            </button>
          )}
        </div>
      </div>

      <AISettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
