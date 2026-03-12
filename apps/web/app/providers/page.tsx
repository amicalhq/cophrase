import { db, asc } from "@workspace/db"
import { aiProvider } from "@workspace/db/schema"

export const metadata = {
  title: "AI Providers",
}

export default async function ProvidersPage() {
  const providers = await db
    .select()
    .from(aiProvider)
    .orderBy(asc(aiProvider.name))

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">AI Providers</h1>

      {providers.length === 0 ? (
        <p className="text-muted-foreground">
          No providers configured yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Provider Type</th>
                <th className="py-3 pr-4 font-medium">Base URL</th>
                <th className="py-3 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-border border-b">
                  <td className="py-3 pr-4 font-medium">{p.name}</td>
                  <td className="text-muted-foreground py-3 pr-4">
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {p.providerType}
                    </code>
                  </td>
                  <td className="text-muted-foreground py-3 pr-4">
                    {p.baseUrl ?? "—"}
                  </td>
                  <td className="text-muted-foreground py-3 pr-4">
                    {p.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
