"use client"

import { useCallback, useRef, useState } from "react"
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
import { EditorPanel } from "./editor-panel"
import { ArtifactPicker } from "./artifact-picker"
import type { ArtifactData } from "./artifact-viewer"

interface AIEditorProps {
  contentTitle: string
  orgId: string
  projectId: string
  contentId: string
}

export function AIEditor({
  contentTitle,
  orgId,
  projectId,
  contentId,
}: AIEditorProps) {
  const { project } = useProject()
  const { data: activeOrg } = authClient.useActiveOrganization()

  const organization = activeOrg
    ? { id: activeOrg.id, name: activeOrg.name, logo: activeOrg.logo }
    : undefined
  const [isChatOpen, setIsChatOpen] = useState(true)
  const chatPanelRef = useRef<PanelImperativeHandle>(null)

  const [selectedArtifact, setSelectedArtifact] =
    useState<ArtifactData | null>(null)

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
        const res = await fetch(`/api/content/${contentId}/artifacts`)
        if (!res.ok) return
        const data = (await res.json()) as {
          artifacts: ArtifactData[]
          grouped: Record<string, ArtifactData[]>
        }
        const artifact = data.artifacts.find((a) => a.id === artifactId)
        if (artifact) setSelectedArtifact(artifact)
      } catch {
        // silently fail
      }
    },
    [contentId],
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
              orgId={orgId}
              projectId={projectId}
              contentId={contentId}
              onArtifactClick={handleArtifactClick}
            />
          </ResizablePanel>

          <ResizableHandle withHandle className={isChatOpen ? "" : "hidden"} />

          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="flex h-full flex-col">
              <ArtifactPicker
                contentId={contentId}
                onSelect={setSelectedArtifact}
                selectedId={selectedArtifact?.id ?? null}
              />
              <EditorPanel
                isChatOpen={isChatOpen}
                onChatToggle={handleChatToggle}
                artifact={selectedArtifact}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}
