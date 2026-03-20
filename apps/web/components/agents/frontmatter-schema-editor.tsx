"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

type FieldType = "string" | "number" | "boolean" | "string[]"

interface FieldDef {
  name: string
  type: FieldType
  required: boolean
}

function parseSchema(
  schema: Record<string, unknown> | null | undefined
): FieldDef[] {
  if (!schema) return []
  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined
  if (!properties) return []
  const required = (schema.required as string[]) ?? []

  return Object.entries(properties).map(([name, def]) => {
    let type: FieldType = "string"
    if (def.type === "number") {
      type = "number"
    } else if (def.type === "boolean") {
      type = "boolean"
    } else if (def.type === "array") {
      type = "string[]"
    }
    return { name, type, required: required.includes(name) }
  })
}

function buildSchema(fields: FieldDef[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const requiredFields: string[] = []

  for (const field of fields) {
    if (!field.name) continue
    if (field.type === "string[]") {
      properties[field.name] = { type: "array", items: { type: "string" } }
    } else {
      properties[field.name] = { type: field.type }
    }
    if (field.required) {
      requiredFields.push(field.name)
    }
  }

  const schema: Record<string, unknown> = { type: "object", properties }
  if (requiredFields.length > 0) {
    schema.required = requiredFields
  }
  return schema
}

interface FrontmatterSchemaEditorProps {
  initialSchema?: Record<string, unknown> | null
  onSave: (schema: Record<string, unknown>) => void | Promise<void>
}

export function FrontmatterSchemaEditor({
  initialSchema,
  onSave,
}: FrontmatterSchemaEditorProps) {
  const [fields, setFields] = useState<FieldDef[]>(() =>
    parseSchema(initialSchema)
  )
  const [saving, setSaving] = useState(false)

  function addField() {
    setFields((prev) => [...prev, { name: "", type: "string", required: false }])
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  function updateField(index: number, patch: Partial<FieldDef>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(buildSchema(fields))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.length > 0 && (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <div className="flex flex-1 flex-col gap-1">
                <Label className="text-xs">Name</Label>
                <Input
                  placeholder="field_name"
                  value={field.name}
                  onChange={(e) => updateField(index, { name: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={field.type}
                  onValueChange={(value) =>
                    updateField(index, { type: value as FieldType })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="boolean">boolean</SelectItem>
                    <SelectItem value="string[]">string[]</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col items-center gap-1 pt-1">
                <Label className="text-xs">Required</Label>
                <Checkbox
                  checked={field.required}
                  onCheckedChange={(checked) =>
                    updateField(index, { required: checked === true })
                  }
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-destructive hover:text-destructive"
                onClick={() => removeField(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addField}>
          Add field
        </Button>
        <Button size="sm" disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save schema"}
        </Button>
      </div>
    </div>
  )
}
