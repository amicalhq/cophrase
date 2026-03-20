import { SimpleHeader } from "@/components/navigation/simple-header"

export default function OrgsListingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      {children}
    </div>
  )
}
