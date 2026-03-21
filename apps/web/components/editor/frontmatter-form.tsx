"use client"

import { useEffect, useState } from "react"
import { Input } from "@workspace/ui/components/input"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { trpc } from "@/lib/trpc/client"

interface JsonSchemaProperty {
  type: string
  items?: { type: string }
}

interface JsonSchema {
  properties?: Record<string, JsonSchemaProperty>
}

interface FrontmatterValues {
  [key: string]: string | number | boolean | string[]
}

interface FrontmatterFormProps {
  contentId: string
}

export function FrontmatterForm({ contentId }: FrontmatterFormProps) {
  const [schema, setSchema] = useState<JsonSchema | null>(null)
  const [values, setValues] = useState<FrontmatterValues>({})
  const [loading, setLoading] = useState(true)
  const utils = trpc.useUtils()
  const updateFrontmatterMutation = trpc.content.updateFrontmatter.useMutation()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const fmData = await utils.content.getFrontmatter.fetch({ contentId })

        if (!fmData.contentTypeId) return

        // NOTE: content-types endpoint stays as raw fetch (Task 7)
        const ctRes = await fetch(`/api/content-types/${fmData.contentTypeId}`)
        if (!ctRes.ok) return
        const ctData = (await ctRes.json()) as {
          frontmatterSchema?: Record<string, unknown> | null
        }

        if (cancelled) return

        const s = ctData.frontmatterSchema as JsonSchema | null | undefined
        setSchema(s ?? null)
        setValues((fmData.frontmatter ?? {}) as FrontmatterValues)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [contentId, utils])

  function handleBlurSave(updatedValues: FrontmatterValues) {
    updateFrontmatterMutation.mutate({
      contentId,
      frontmatter: updatedValues,
    })
  }

  if (loading || !schema || !schema.properties) return null

  const properties = schema.properties

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {Object.entries(properties).map(([fieldName, fieldDef]) => {
        const currentValue = values[fieldName]

        if (fieldDef.type === "boolean") {
          const checked =
            typeof currentValue === "boolean" ? currentValue : false
          return (
            <div key={fieldName} className="flex items-center gap-2">
              <Checkbox
                id={`fm-${fieldName}`}
                checked={checked}
                onCheckedChange={(value) => {
                  const next = { ...values, [fieldName]: value === true }
                  setValues(next)
                  void handleBlurSave(next)
                }}
              />
              <Label htmlFor={`fm-${fieldName}`} className="text-sm">
                {fieldName}
              </Label>
            </div>
          )
        }

        if (fieldDef.type === "number") {
          const numVal =
            typeof currentValue === "number" ? String(currentValue) : ""
          return (
            <div key={fieldName} className="flex flex-col gap-1">
              <Label htmlFor={`fm-${fieldName}`} className="text-xs">
                {fieldName}
              </Label>
              <Input
                id={`fm-${fieldName}`}
                type="number"
                value={numVal}
                onChange={(e) => {
                  setValues((prev) => ({
                    ...prev,
                    [fieldName]: e.target.valueAsNumber,
                  }))
                }}
                onBlur={(e) => {
                  const next = {
                    ...values,
                    [fieldName]: e.target.valueAsNumber,
                  }
                  setValues(next)
                  void handleBlurSave(next)
                }}
              />
            </div>
          )
        }

        if (fieldDef.type === "array" && fieldDef.items?.type === "string") {
          const arrVal = Array.isArray(currentValue)
            ? (currentValue as string[]).join(", ")
            : typeof currentValue === "string"
              ? currentValue
              : ""
          return (
            <div key={fieldName} className="flex flex-col gap-1">
              <Label htmlFor={`fm-${fieldName}`} className="text-xs">
                {fieldName}{" "}
                <span className="text-muted-foreground">(comma-separated)</span>
              </Label>
              <Input
                id={`fm-${fieldName}`}
                value={arrVal}
                onChange={(e) => {
                  setValues((prev) => ({
                    ...prev,
                    [fieldName]: e.target.value,
                  }))
                }}
                onBlur={(e) => {
                  const parsed = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                  const next = { ...values, [fieldName]: parsed }
                  setValues(next)
                  void handleBlurSave(next)
                }}
              />
            </div>
          )
        }

        // Default: string
        const strVal = typeof currentValue === "string" ? currentValue : ""
        return (
          <div key={fieldName} className="flex flex-col gap-1">
            <Label htmlFor={`fm-${fieldName}`} className="text-xs">
              {fieldName}
            </Label>
            <Input
              id={`fm-${fieldName}`}
              value={strVal}
              onChange={(e) => {
                setValues((prev) => ({
                  ...prev,
                  [fieldName]: e.target.value,
                }))
              }}
              onBlur={(e) => {
                const next = { ...values, [fieldName]: e.target.value }
                setValues(next)
                void handleBlurSave(next)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
