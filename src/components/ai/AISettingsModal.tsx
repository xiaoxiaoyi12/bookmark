import { useState } from 'react'
import { useAIStore } from '../../stores/useAIStore'

const PRESETS = [
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-turbo' },
] as const

interface Props {
  open: boolean
  onClose: () => void
}

export default function AISettingsModal({ open, onClose }: Props) {
  const { config, setConfig } = useAIStore()
  const [form, setForm] = useState({ ...config })

  if (!open) return null

  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    setForm((f) => ({ ...f, baseUrl: preset.baseUrl, model: preset.model }))
  }

  const handleSave = () => {
    setConfig(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[420px] max-w-[90vw] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-amber-900 dark:text-white mb-4">AI 设置</h2>

        {/* 预设选择 */}
        <div className="flex gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                form.baseUrl === p.baseUrl
                  ? 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-300'
                  : 'border-gray-300 text-gray-600 hover:border-amber-300 dark:border-gray-600 dark:text-gray-400 dark:hover:border-amber-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 表单 */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Base URL</label>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-amber-400 dark:focus:border-amber-500"
              placeholder="https://api.deepseek.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-amber-400 dark:focus:border-amber-500"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">模型</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-amber-400 dark:focus:border-amber-500"
              placeholder="deepseek-chat"
            />
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
