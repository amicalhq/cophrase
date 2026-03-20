"use client"

import { createContext, useContext } from "react"
import type { Editor } from "@tiptap/react"

const ToolbarContext = createContext<Editor | null>(null)

export function ToolbarProvider({
  editor,
  children,
}: {
  editor: Editor | null
  children: React.ReactNode
}) {
  return (
    <ToolbarContext.Provider value={editor}>{children}</ToolbarContext.Provider>
  )
}

export function useToolbarEditor() {
  return useContext(ToolbarContext)
}
