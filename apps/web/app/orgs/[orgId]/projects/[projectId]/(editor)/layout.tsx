export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background flex h-screen flex-col">
      {children}
    </div>
  )
}
