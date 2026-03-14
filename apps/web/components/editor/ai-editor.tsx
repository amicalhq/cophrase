"use client"

import { useRef, useState } from "react"
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
import { ArtifactViewer } from "./artifact-viewer"
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

  const [runId, setRunId] = useState<string | null>(null)
  const [selectedArtifact, setSelectedArtifact] =
    useState<ArtifactData | null>(null)

  const handleChatToggle = () => {
    if (isChatOpen) {
      chatPanelRef.current?.collapse()
    } else {
      chatPanelRef.current?.expand()
    }
  }

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
              onRunId={setRunId}
            />
          </ResizablePanel>

          <ResizableHandle withHandle className={isChatOpen ? "" : "hidden"} />

          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="flex h-full flex-col">
              {runId && (
                <ArtifactPicker
                  runId={runId}
                  onSelect={setSelectedArtifact}
                  selectedId={selectedArtifact?.id ?? null}
                />
              )}
              {selectedArtifact ? (
                <div className="flex-1 overflow-y-auto">
                  <ArtifactViewer artifact={selectedArtifact} />
                </div>
              ) : (
                <EditorPanel
                  isChatOpen={isChatOpen}
                  onChatToggle={handleChatToggle}
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}
