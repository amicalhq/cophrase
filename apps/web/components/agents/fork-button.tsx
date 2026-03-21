"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@workspace/ui/components/button"

interface ForkButtonProps {
  contentTypeId: string
  orgId: string
  projectId: string
}

export function ForkButton({ contentTypeId, orgId, projectId }: ForkButtonProps) {
  const router = useRouter()
  const [forking, setForking] = useState(false)
  const [error, setError] = useState("")

  const forkMutation = trpc.contentTypes.fork.useMutation({
    onSuccess(forked) {
      router.push(`/orgs/${orgId}/projects/${projectId}/agents/${forked.id}`)
    },
    onError(err) {
      setError(err.message ?? "Failed to fork")
      setForking(false)
    },
  })

  async function handleFork() {
    setForking(true)
    setError("")
    forkMutation.mutate({ id: contentTypeId })
  }

  return (
    <div>
      <Button variant="outline" size="sm" disabled={forking} onClick={handleFork}>
        {forking ? "Forking..." : "Fork"}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
