"use client"

import { createContext, useContext } from "react"

interface ProjectContextValue {
  orgId: string
  project: { id: string; name: string }
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({
  orgId,
  project,
  children,
}: ProjectContextValue & { children: React.ReactNode }) {
  return (
    <ProjectContext.Provider value={{ orgId, project }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProject must be used within ProjectProvider")
  return ctx
}
