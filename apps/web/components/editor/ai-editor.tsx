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
import { useArtifacts } from "./artifact-picker"
import type { ArtifactData } from "./artifact-viewer"

interface AIEditorProps {
  contentTitle: string
  orgId: string
  projectId: string
  contentId: string
}

export function AIEditor({
  contentTitle,
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

  const { artifacts, grouped } = useArtifacts(contentId)

  const handleChatToggle = () => {
    if (isChatOpen) {
      chatPanelRef.current?.collapse()
    } else {
      chatPanelRef.current?.expand()
    }
  }

  const handleArtifactClick = useCallback(
    (artifactId: string) => {
      const artifact = artifacts.find((a) => a.id === artifactId)
      if (artifact) setSelectedArtifact(artifact)
    },
    [artifacts],
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
              onArtifactSelect={setSelectedArtifact}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}
