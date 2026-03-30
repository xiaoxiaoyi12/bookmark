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
  const [activeTab, setActiveTab] = useState<'note' | 'highlight'>('note');

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

  const tabBtn = (tab: 'note' | 'highlight', label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
        activeTab === tab
          ? 'text-amber-800 dark:text-white border-b-2 border-amber-600 dark:border-blue-500'
          : 'text-amber-500/60 dark:text-gray-500 hover:text-amber-700 dark:hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Tab 切换栏 */}
      <div className="flex border-b border-amber-200 dark:border-gray-700 shrink-0 select-none">
        {tabBtn('note', '笔记')}
        {tabBtn('highlight', '高亮')}
      </div>

      {/* 内容区域 */}
      {activeTab === 'note' && (
        <TiptapEditor content={note?.content || ""} onUpdate={handleUpdate} />
      )}
      {activeTab === 'highlight' && (
        <HighlightList
          bookId={bookId}
          onDelete={(h) => readerRef?.current?.removeHighlight(h)}
          onNavigate={(h) => readerRef?.current?.goToHighlight(h)}
        />
      )}
    </div>
  );
}
