import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import ReaderPage from './pages/ReaderPage'
// 导入以触发 store 初始化（应用 dark class 到 html）
import './stores/useThemeStore'

declare const __IS_TAURI__: boolean
const isTauri = __IS_TAURI__

export default function App() {
  return (
    <BrowserRouter basename={isTauri ? '/' : '/bookmark'}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/read/:bookId" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  )
}
