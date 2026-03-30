export interface Book {
  id?: number
  title: string
  author: string
  format: 'epub' | 'pdf' | 'web'
  coverUrl?: string          // base64 data URL
  fileData: ArrayBuffer       // 文件原始字节（web 类型存 HTML）
  url?: string               // 网页原始 URL（仅 web 类型）
  createdAt: number           // Date.now()
}

export interface Highlight {
  id?: number
  bookId: number
  cfiRange: string            // EPUB CFI 或 PDF "page:N:rect"
  text: string                // 高亮文字内容
  color: string               // 颜色值
  createdAt: number
}

export interface Note {
  id?: number
  bookId: number
  content: string             // Tiptap JSON 序列化字符串
  updatedAt: number
}

export interface ReadingProgress {
  bookId: number              // 主键，每本书一条记录
  location: string            // EPUB CFI 或 PDF 页码
  updatedAt: number
}

export interface SearchResult {
  type: 'content' | 'note' | 'highlight'
  text: string                // 匹配摘要
  location?: string           // EPUB CFI 或 PDF 页码
  page?: number               // PDF 页码
}

export interface ReaderHandle {
  search: (query: string) => Promise<SearchResult[]>
  goTo: (result: SearchResult) => void
  removeHighlight: (highlight: Highlight) => void
}
