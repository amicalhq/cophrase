"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryState } from "nuqs"
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
import { trpc } from "@/lib/trpc/client"

interface AIEditorProps {
  contentTitle: string
  currentStageName: string | null
  orgId: string
  projectId: string
  contentId: string
  contentFormat: string
  languageModels: ChatModelOption[]
}

export function AIEditor({
  contentTitle,
  currentStageName,
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

  // Artifact ID persisted in URL — artifact data fetched on change
  const [artifactId, setArtifactId] = useQueryState("artifact", {
    defaultValue: "",
  })
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactData | null>(
    null
  )

  const { artifacts, grouped } = useArtifacts(contentId)

  // Fetch full artifact data whenever the URL param changes
  const artifactQuery = trpc.content.artifact.useQuery(
    { contentId, artifactId: artifactId || "" },
    { enabled: !!artifactId }
  )

  useEffect(() => {
    if (!artifactId) {
      setSelectedArtifact(null)
    } else if (artifactQuery.data?.artifact) {
      setSelectedArtifact(artifactQuery.data.artifact as ArtifactData)
    }
  }, [artifactId, artifactQuery.data])

  // Auto-select the latest artifact (furthest stage) on initial load
  const hasAutoSelected = useRef(false)
  useEffect(() => {
    // Skip if URL already has an artifact or we already auto-selected
    if (hasAutoSelected.current || artifactId || artifacts.length === 0) return
    hasAutoSelected.current = true
    const types = sortedTypeKeys(Object.keys(grouped))
    const lastType = types[types.length - 1]
    if (!lastType || !grouped[lastType]) return
    const latest = grouped[lastType]![grouped[lastType]!.length - 1]
    if (latest) void setArtifactId(latest.id)
  }, [artifacts, grouped, artifactId, setArtifactId])

  const handleChatToggle = () => {
    if (isChatOpen) {
      chatPanelRef.current?.collapse()
    } else {
      chatPanelRef.current?.expand()
    }
  }

  const handleArtifactClick = useCallback(
    (id: string) => {
      void setArtifactId(id)
    },
    [setArtifactId]
  )

  const handleArtifactSelect = useCallback(
    (artifact: ArtifactData | null) => {
      void setArtifactId(artifact?.id ?? "")
    },
    [setArtifactId]
  )

  return (
    <>
      <TopNavigation
        organization={organization}
        project={project}
        pageTitle={contentTitle}
        pageBadge={currentStageName}
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
