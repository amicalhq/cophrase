import { SimpleHeader } from "@/components/navigation/simple-header"

export default function OrgsListingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background min-h-screen">
      <SimpleHeader />
      {children}
    </div>
  )
}
