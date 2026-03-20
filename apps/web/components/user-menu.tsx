"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTheme } from "next-themes"
import { authClient } from "@workspace/auth/client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Sun02Icon, Moon02Icon, ComputerIcon } from "@hugeicons/core-free-icons"

interface UserDropdownProps {
  size?: "icon" | "full"
  className?: string
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0]?.charAt(0).toUpperCase() ?? "U"
  return (
    (parts[0]?.charAt(0) ?? "") + (parts[parts.length - 1]?.charAt(0) ?? "")
  ).toUpperCase()
}

export function UserDropdown({ size = "icon", className }: UserDropdownProps) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in")
        },
      },
    })
  }

  if (isPending) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        disabled
      >
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      </Button>
    )
  }

  if (!session?.user) {
    return (
      <Link href="/sign-in">
        <Button variant="outline" size="sm">
          Sign In
        </Button>
      </Link>
    )
  }

  const user = session.user

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size === "icon" ? "icon" : "default"}
          className={cn(
            size === "icon"
              ? "h-8 w-8 rounded-full"
              : "w-full justify-start gap-2",
            className
          )}
        >
          <Avatar className="h-7 w-7">
            <AvatarImage
              src={user.image ?? undefined}
              alt={user.name ?? "User"}
            />
            <AvatarFallback className="text-xs">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {size === "full" && (
            <span className="truncate">{user.name ?? user.email}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/orgs" className="flex cursor-pointer items-center">
              Organizations
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const themes = [
  { value: "light", icon: Sun02Icon, label: "Light" },
  { value: "system", icon: ComputerIcon, label: "System" },
  { value: "dark", icon: Moon02Icon, label: "Dark" },
] as const

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(value) => {
        if (value) setTheme(value)
      }}
      variant="outline"
      size="sm"
      className="w-auto"
    >
      {themes.map(({ value, icon, label }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          className="flex-1"
        >
          <HugeiconsIcon icon={icon} size={14} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
