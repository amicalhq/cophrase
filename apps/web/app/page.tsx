import { AppHeader } from "@/components/app-header"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Welcome to CoPhrase.
        </p>
      </main>
    </div>
  )
}
