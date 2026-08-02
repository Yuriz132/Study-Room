import { useState, useCallback } from 'react'
import { pushToCloud } from '@/lib/progressSync'
import type { Note } from '@/lib/authApi'

const NOTES_KEY = 'liquid-words:notes'

function readNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    return raw ? (JSON.parse(raw) as Note[]) : []
  } catch {
    return []
  }
}

function writeNotes(notes: Note[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

/** 生成唯一 id */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 个人笔记 hook：本地存储 + 登录后自动同步到云端 */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => readNotes())

  const addNote = useCallback(
    (title: string, content: string, images?: string[], analysis?: string) => {
      const now = Date.now()
      const note: Note = { id: uid(), title, content, images, analysis, createdAt: now, updatedAt: now }
      setNotes((prev) => {
        const next = [note, ...prev]
        writeNotes(next)
        pushToCloud({ notes: next })
        return next
      })
      return note.id
    },
    []
  )

  const updateNote = useCallback(
    (id: string, title: string, content: string, images?: string[], analysis?: string) => {
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === id
            ? { ...n, title, content, images: images ?? n.images, analysis: analysis ?? n.analysis, updatedAt: Date.now() }
            : n
        )
        writeNotes(next)
        pushToCloud({ notes: next })
        return next
      })
    },
    []
  )

  const removeNote = useCallback((id: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id)
      writeNotes(next)
      pushToCloud({ notes: next })
      return next
    })
  }, [])

  const getNote = useCallback((id: string) => notes.find((n) => n.id === id), [notes])

  return { notes, addNote, updateNote, removeNote, getNote, count: notes.length }
}
