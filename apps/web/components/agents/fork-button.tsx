"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

  async function handleFork() {
    setForking(true)
    setError("")

    try {
      const res = await fetch(`/api/content-types/${contentTypeId}/fork`, {
        method: "POST",
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to fork")
        return
      }

      const forked = await res.json()
      router.push(`/orgs/${orgId}/projects/${projectId}/agents/${forked.id}`)
    } catch {
      setError("Failed to fork")
    } finally {
      setForking(false)
    }
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
