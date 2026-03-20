"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"

interface InstallButtonProps {
  templateId: string
  projectId: string
  orgId: string
  isInstalled: boolean
}

export function InstallButton({
  templateId,
  projectId,
  orgId,
  isInstalled,
}: InstallButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInstall() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/content-types/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, projectId, orgId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to install")
        return
      }

      router.refresh()
    } catch {
      setError("Failed to install")
    } finally {
      setLoading(false)
    }
  }

  if (isInstalled) {
    return (
      <Button variant="outline" size="sm" disabled>
        Installed
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="default"
        size="sm"
        disabled={loading}
        onClick={handleInstall}
      >
        {loading ? "Installing..." : "Install"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
