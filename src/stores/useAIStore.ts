import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface AIState {
  config: AIConfig
  setConfig: (c: Partial<AIConfig>) => void
  aiOpen: boolean
  toggleAI: () => void
  // 选中文本翻译请求
  pendingTranslation: string | null
  requestTranslation: (text: string) => void
  clearPendingTranslation: () => void
}

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      config: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
      },
      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
      aiOpen: false,
      toggleAI: () => set((s) => ({ aiOpen: !s.aiOpen })),
      pendingTranslation: null,
      requestTranslation: (text) => set({ pendingTranslation: text, aiOpen: true }),
      clearPendingTranslation: () => set({ pendingTranslation: null }),
    }),
    {
      name: 'bookmark-ai-config',
      partialize: (state) => ({ config: state.config }),
    }
  )
)
