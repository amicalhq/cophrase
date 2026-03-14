"use client"

import { useRef, useState } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type PanelImperativeHandle,
} from "@workspace/ui/components/resizable"
import { Button } from "@workspace/ui/components/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { authClient } from "@workspace/auth/client"
import { useProject } from "@/app/orgs/[orgId]/projects/[projectId]/project-context"
import { TopNavigation } from "@/components/navigation/top-navigation"
import { ChatPanel } from "./chat-panel"
import { EditorPanel } from "./editor-panel"

interface AIEditorProps {
  contentTitle: string
}

export function AIEditor({ contentTitle }: AIEditorProps) {
  const { project } = useProject()
  const { data: activeOrg } = authClient.useActiveOrganization()

  const organization = activeOrg
    ? { id: activeOrg.id, name: activeOrg.name, logo: activeOrg.logo }
    : undefined
  const [isChatOpen, setIsChatOpen] = useState(true)
  const chatPanelRef = useRef<PanelImperativeHandle>(null)

  const handleCollapse = () => {
    chatPanelRef.current?.collapse()
    setIsChatOpen(false)
  }

  const handleExpand = () => {
    chatPanelRef.current?.expand()
    setIsChatOpen(true)
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
            <ChatPanel onCollapse={handleCollapse} />
          </ResizablePanel>

          <ResizableHandle withHandle className={isChatOpen ? "" : "hidden"} />

          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="relative h-full">
              {/* Expand chat toggle */}
              {!isChatOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-2 z-10 h-7 w-7"
                  onClick={handleExpand}
                  aria-label="Open chat"
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </Button>
              )}
              <EditorPanel />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}
