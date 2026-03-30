import type { AIConfig } from '../stores/useAIStore'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * OpenAI 兼容的 streaming chat completion
 * 支持 OpenAI / DeepSeek / 通义千问 等任何兼容 API
 */
export async function* chatStream(
  config: AIConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
    signal,
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`API 请求失败 (${resp.status}): ${text || resp.statusText}`)
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') return

      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // 忽略解析错误
      }
    }
  }
}

/** 构建文档摘要的消息 */
export function buildSummaryMessages(text: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: '你是一个专业的文档分析助手。请用简洁清晰的语言生成文档摘要，包含主要观点和关键信息。使用中文回复。',
    },
    {
      role: 'user',
      content: `请为以下文档生成摘要：\n\n${text}`,
    },
  ]
}

/** 构建问答的消息 */
export function buildQAMessages(
  context: string,
  history: ChatMessage[],
  question: string,
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个专业的文档分析助手。请基于以下文档内容回答用户的问题。如果问题与文档无关，可以使用你的通用知识回答，但请注明。使用中文回复。\n\n文档内容：\n${context}`,
    },
    ...history.filter((m) => m.role !== 'system'),
    {
      role: 'user',
      content: question,
    },
  ]
}

/** 构建翻译的消息 */
export function buildTranslateMessages(
  text: string,
  targetLang: string = '中文',
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个专业的翻译助手。请将用户提供的文本翻译成${targetLang}。只输出翻译结果，不要添加解释。如果原文已经是${targetLang}，则翻译成英文。`,
    },
    {
      role: 'user',
      content: text,
    },
  ]
}
