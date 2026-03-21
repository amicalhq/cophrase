"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
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

  const installMutation = trpc.contentTypes.install.useMutation({
    onSuccess() {
      router.refresh()
      setLoading(false)
    },
    onError(err) {
      setError(err.message ?? "Failed to install")
      setLoading(false)
    },
  })

  async function handleInstall() {
    setLoading(true)
    setError(null)
    installMutation.mutate({ templateId, projectId, orgId })
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
