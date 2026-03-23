import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@workspace/auth"
import { SimpleHeader } from "@/components/navigation/simple-header"

export default async function OrgsListingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      {children}
    </div>
  )
}
