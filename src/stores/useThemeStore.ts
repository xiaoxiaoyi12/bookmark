import { create } from 'zustand'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** 当前实际生效的主题（resolved from system preference if mode is 'system'） */
  resolved: 'light' | 'dark'
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

const stored = (localStorage.getItem('theme-mode') || 'dark') as ThemeMode
const initialResolved = resolveTheme(stored)
applyTheme(initialResolved)

export const useThemeStore = create<ThemeState>((set) => ({
  mode: stored,
  resolved: initialResolved,
  setMode: (mode) => {
    localStorage.setItem('theme-mode', mode)
    const resolved = resolveTheme(mode)
    applyTheme(resolved)
    set({ mode, resolved })
  },
}))

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { mode } = useThemeStore.getState()
  if (mode === 'system') {
    const resolved = getSystemTheme()
    applyTheme(resolved)
    useThemeStore.setState({ resolved })
  }
})
