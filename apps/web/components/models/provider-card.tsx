"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"

interface ProviderCardProps {
  name: string
  providerType: string
  modelCount: number
  onClick: () => void
}

export function ProviderCard({
  name,
  providerType,
  modelCount,
  onClick,
}: ProviderCardProps) {
  return (
    <button
      onClick={onClick}
      className="border-border hover:bg-accent flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors"
    >
      <Avatar className="h-8 w-8 rounded-md">
        <AvatarImage
          src={`https://models.dev/logos/${providerType === "ai-gateway" ? "vercel" : providerType}.svg`}
          alt={name}
          className="dark:invert"
        />
        <AvatarFallback className="rounded-md text-xs">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">
          {providerType === "ai-gateway" ? "Vercel AI Gateway" : providerType.charAt(0).toUpperCase() + providerType.slice(1)}
          {" · "}
          {modelCount} model{modelCount !== 1 ? "s" : ""} enabled
        </p>
      </div>
      <span className="text-muted-foreground text-sm">›</span>
    </button>
  )
}
