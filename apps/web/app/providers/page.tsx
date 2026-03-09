import { db, asc } from "@workspace/db"
import { aiProviders } from "@workspace/db/schema"

export const metadata = {
  title: "AI Providers",
}

export default async function ProvidersPage() {
  const providers = await db
    .select()
    .from(aiProviders)
    .orderBy(asc(aiProviders.name))

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">AI Providers</h1>

      {providers.length === 0 ? (
        <p className="text-muted-foreground">
          No providers found. Run{" "}
          <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
            pnpm --filter @workspace/db db:seed
          </code>{" "}
          to populate.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Provider</th>
                <th className="py-3 pr-4 font-medium">Description</th>
                <th className="py-3 pr-4 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-border border-b">
                  <td className="py-3 pr-4 font-medium">
                    {p.website ? (
                      <a
                        href={p.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                  </td>
                  <td className="text-muted-foreground py-3 pr-4">
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {p.provider}
                    </code>
                  </td>
                  <td className="text-muted-foreground py-3 pr-4">
                    {p.description}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        p.isEnabled ? "text-green-600" : "text-muted-foreground"
                      }
                    >
                      {p.isEnabled ? "Yes" : "No"}
                    </span>
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
