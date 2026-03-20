"use client"

export type ConnectionTestStatus = "idle" | "testing" | "success" | "error"

interface ConnectionTestBannerProps {
  status: ConnectionTestStatus
  error?: string
}

export function ConnectionTestBanner({
  status,
  error,
}: ConnectionTestBannerProps) {
  if (status === "idle") return null

  if (status === "testing") {
    return (
      <div
        data-testid="connection-test-banner"
        className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
      >
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Testing connection...
      </div>
    )
  }

  if (status === "success") {
    return (
      <div
        data-testid="connection-test-banner"
        className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Connection successful
      </div>
    )
  }

  // status === "error"
  return (
    <div
      data-testid="connection-test-banner"
      className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
      {error}
    </div>
  )
}
