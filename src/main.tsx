/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Map<K, V> {
    getOrInsertComputed(key: K, callbackFn: (key: K) => V): V
  }
  interface ReadableStream<R = any> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Polyfill: macOS WebKit 尚不支持 Map.prototype.getOrInsertComputed（pdfjs-dist v5.6 需要）
if (!Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function (key: unknown, callbackFn: (key: unknown) => unknown) {
    if (this.has(key)) return this.get(key)
    const value = callbackFn(key)
    this.set(key, value)
    return value
  }
}

// Polyfill: macOS WebKit 尚不支持 ReadableStream 异步迭代（pdfjs-dist v5.6 需要）
if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) return
        yield value
      }
    } finally {
      reader.releaseLock()
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
