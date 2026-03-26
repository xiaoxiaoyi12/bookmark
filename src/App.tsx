import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage'
import ReaderPage from './pages/ReaderPage'

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
