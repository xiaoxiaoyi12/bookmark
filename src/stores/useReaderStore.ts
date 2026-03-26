import { create } from 'zustand'

interface ReaderState {
  tocOpen: boolean
  noteOpen: boolean
  toggleToc: () => void
  toggleNote: () => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  tocOpen: true,
  noteOpen: true,
  toggleToc: () => set(s => ({ tocOpen: !s.tocOpen })),
  toggleNote: () => set(s => ({ noteOpen: !s.noteOpen })),
}))
