"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createAuthClient } from "better-auth/react"
import { oauthProviderClient } from "@better-auth/oauth-provider/client"

const oauthClient = createAuthClient({
  plugins: [oauthProviderClient()],
})
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

function ConsentPageContent() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("client_id")
  const scope = searchParams.get("scope")
  const [loading, setLoading] = useState(false)

  async function handleAllow() {
    setLoading(true)
    await oauthClient.oauth2.consent({ accept: true })
  }

  async function handleDeny() {
    setLoading(true)
    await oauthClient.oauth2.consent({ accept: false })
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Authorize CoPhrase</CardTitle>
          <CardDescription>
            An application is requesting access to your CoPhrase account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {clientId && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Client</p>
              <p className="text-sm text-muted-foreground">{clientId}</p>
            </div>
          )}
          {scope && (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Requested permissions</p>
              <p className="text-sm text-muted-foreground">{scope}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button
            className="w-full"
            size="lg"
            disabled={loading}
            onClick={handleAllow}
          >
            {loading ? "Processing..." : "Allow"}
          </Button>
          <Button
            className="w-full"
            size="lg"
            variant="outline"
            disabled={loading}
            onClick={handleDeny}
          >
            Deny
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function ConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">
            Loading authorization request...
          </p>
        </div>
      }
    >
      <ConsentPageContent />
    </Suspense>
  )
}
