import ePub from 'epubjs'

export async function extractEpubMetadata(data: ArrayBuffer) {
  const book = ePub(data)
  await book.ready

  const metadata = await book.loaded.metadata
  let coverUrl: string | undefined

  try {
    const coverUrl_ = await book.coverUrl()
    if (coverUrl_) coverUrl = coverUrl_
  } catch {
    // 无封面
  }

  book.destroy()

  return {
    title: metadata.title || '未命名',
    author: metadata.creator || '未知作者',
    coverUrl,
  }
}
