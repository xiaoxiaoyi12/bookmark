import { create } from 'zustand'

interface ReaderState {
  tocOpen: boolean
  noteOpen: boolean
  searchOpen: boolean
  searchQuery: string
  toggleToc: () => void
  toggleNote: () => void
  toggleSearch: () => void
  setSearchQuery: (q: string) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  tocOpen: true,
  noteOpen: true,
  searchOpen: false,
  searchQuery: '',
  toggleToc: () => set(s => ({ tocOpen: !s.tocOpen })),
  toggleNote: () => set(s => ({ noteOpen: !s.noteOpen })),
  toggleSearch: () => set(s => ({ searchOpen: !s.searchOpen, searchQuery: s.searchOpen ? '' : s.searchQuery })),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))
