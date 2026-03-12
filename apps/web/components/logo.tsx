import { cn } from "@workspace/ui/lib/utils"

interface LogoProps {
  variant?: "full" | "icon"
  iconClassName?: string
  textClassName?: string
  className?: string
}

export function Logo({
  variant = "full",
  iconClassName,
  textClassName,
  className,
}: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight",
          variant === "icon" ? "text-base" : "",
          iconClassName,
        )}
      >
        C
      </span>
      {variant === "full" && (
        <span
          className={cn("font-semibold tracking-tight", textClassName)}
        >
          oPhrase
        </span>
      )}
    </div>
  )
}
