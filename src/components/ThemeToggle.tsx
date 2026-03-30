import type { ReactElement } from 'react'
import { useThemeStore } from '../stores/useThemeStore'

const modes = ['light', 'dark', 'system'] as const

const labels: Record<string, string> = {
  light: '护眼',
  dark: '暗色',
  system: '系统',
}

const icons: Record<string, ReactElement> = {
  light: (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
    </svg>
  ),
  dark: (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  ),
  system: (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.27.764-.707.707H7.537l-.707-.707.27-.764L7.22 15H5a2 2 0 01-2-2V5zm12 0H5v8h10V5z" clipRule="evenodd" />
    </svg>
  ),
}

export default function ThemeToggle() {
  const { mode, setMode } = useThemeStore()

  const cycle = () => {
    const idx = modes.indexOf(mode)
    setMode(modes[(idx + 1) % modes.length])
  }

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-1 px-2 py-1 text-sm rounded-lg transition-colors text-amber-800/70 hover:bg-amber-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 select-none"
      title={`当前: ${labels[mode]}，点击切换`}
    >
      {icons[mode]}
      <span className="text-xs">{labels[mode]}</span>
    </button>
  )
}
