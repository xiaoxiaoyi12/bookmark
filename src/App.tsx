import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import ReaderPage from './pages/ReaderPage'
// 导入以触发 store 初始化（应用 dark class 到 html）
import './stores/useThemeStore'

export default function App() {
  return (
    <BrowserRouter basename="/bookmark">
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/read/:bookId" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  )
}
