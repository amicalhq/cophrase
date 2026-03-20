"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type PanelImperativeHandle,
} from "@workspace/ui/components/resizable"
import { authClient } from "@workspace/auth/client"
import { useProject } from "@/app/orgs/[orgId]/projects/[projectId]/project-context"
import { TopNavigation } from "@/components/navigation/top-navigation"
import { ChatPanel } from "./chat-panel"
import type { ChatModelOption } from "./chat-panel"
import { EditorPanel } from "./editor-panel"
import { useArtifacts, sortedTypeKeys } from "./artifact-picker"
import type { ArtifactData } from "./artifact-viewer"
interface AIEditorProps {
  contentTitle: string
  orgId: string
  projectId: string
  contentId: string
  contentFormat: string
  languageModels: ChatModelOption[]
}

export function AIEditor({
  contentTitle,
  contentId,
  contentFormat,
  languageModels,
}: AIEditorProps) {
  const { project } = useProject()
  const { data: activeOrg } = authClient.useActiveOrganization()

  const organization = activeOrg
    ? { id: activeOrg.id, name: activeOrg.name, logo: activeOrg.logo }
    : undefined
  const [isChatOpen, setIsChatOpen] = useState(true)
  const chatPanelRef = useRef<PanelImperativeHandle>(null)

  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactData | null>(
    null
  )

  const { artifacts, grouped } = useArtifacts(contentId)

  // Auto-select the latest artifact (furthest stage) on initial load
  const hasAutoSelected = useRef(false)
  useEffect(() => {
    if (hasAutoSelected.current || artifacts.length === 0) return
    hasAutoSelected.current = true
    const types = sortedTypeKeys(Object.keys(grouped))
    const lastType = types[types.length - 1]
    if (!lastType || !grouped[lastType]) return
    const latest = grouped[lastType]![grouped[lastType]!.length - 1]
    if (latest) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/content/${contentId}/artifacts/${latest.id}`
          )
          if (!res.ok) return
          const { artifact } = (await res.json()) as { artifact: ArtifactData }
          setSelectedArtifact(artifact)
        } catch {
          // Silently fail
        }
      })()
    }
  }, [artifacts, grouped, contentId])

  const handleChatToggle = () => {
    if (isChatOpen) {
      chatPanelRef.current?.collapse()
    } else {
      chatPanelRef.current?.expand()
    }
  }

  const handleArtifactClick = useCallback(
    async (artifactId: string) => {
      try {
        const res = await fetch(
          `/api/content/${contentId}/artifacts/${artifactId}`
        )
        if (!res.ok) return
        const { artifact } = (await res.json()) as { artifact: ArtifactData }
        setSelectedArtifact(artifact)
      } catch {
        // Silently fail — artifact viewer won't update
      }
    },
    [contentId]
  )

  const handleArtifactSelect = useCallback(
    (artifact: ArtifactData | null) => {
      if (!artifact) {
        setSelectedArtifact(null)
        return
      }
      handleArtifactClick(artifact.id)
    },
    [handleArtifactClick]
  )

  return (
    <>
      <TopNavigation
        organization={organization}
        project={project}
        pageTitle={contentTitle}
      />

      {/* Split panel editor */}
      <div className="relative flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel
            panelRef={chatPanelRef}
            defaultSize={35}
            minSize={25}
            collapsible
            collapsedSize={0}
            onResize={(panelSize) => {
              setIsChatOpen(panelSize.asPercentage > 0)
            }}
          >
            <ChatPanel
              contentId={contentId}
              onArtifactClick={handleArtifactClick}
              artifacts={artifacts}
              groupedArtifacts={grouped}
              selectedArtifactId={selectedArtifact?.id ?? null}
              languageModels={languageModels}
            />
          </ResizablePanel>

          <ResizableHandle withHandle className={isChatOpen ? "" : "hidden"} />

          <ResizablePanel defaultSize={65} minSize={40}>
            <EditorPanel
              isChatOpen={isChatOpen}
              onChatToggle={handleChatToggle}
              artifact={selectedArtifact}
              artifacts={artifacts}
              groupedArtifacts={grouped}
              onArtifactSelect={handleArtifactSelect}
              contentFormat={contentFormat}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}
