import { useState, useEffect, useCallback } from "react";
import { db } from "../../db";
import type { Note, ReaderHandle } from "../../types";
import TiptapEditor from "./TiptapEditor";
import HighlightList from "./HighlightList";

interface Props {
  bookId: number;
  readerRef?: React.RefObject<ReaderHandle | null>;
}

export default function NotePanel({ bookId, readerRef }: Props) {
  const [note, setNote] = useState<Note | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    db.notes
      .where("bookId")
      .equals(bookId)
      .first()
      .then((n) => {
        setNote(n || null);
        setLoaded(true);
      });
  }, [bookId]);

  const handleUpdate = useCallback(
    async (content: string) => {
      if (note?.id) {
        await db.notes.update(note.id, { content, updatedAt: Date.now() });
      } else {
        // 先查是否已存在，防止重复创建
        const existing = await db.notes.where("bookId").equals(bookId).first();
        if (existing?.id) {
          await db.notes.update(existing.id, {
            content,
            updatedAt: Date.now(),
          });
          setNote({ ...existing, content, updatedAt: Date.now() });
        } else {
          const id = await db.notes.add({
            bookId,
            content,
            updatedAt: Date.now(),
          });
          setNote({ id, bookId, content, updatedAt: Date.now() });
        }
      }
    },
    [bookId, note?.id],
  );

  if (!loaded) return null;

  return (
    <div className="h-full flex flex-col">
      <h2 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-700 shrink-0">
        笔记
      </h2>
      <TiptapEditor content={note?.content || ""} onUpdate={handleUpdate} />
      <HighlightList bookId={bookId} onDelete={(h) => readerRef?.current?.removeHighlight(h)} />
    </div>
  );
}
