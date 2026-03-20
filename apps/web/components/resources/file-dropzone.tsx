"use client"

import { useCallback, useRef, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/resource-constants"

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  currentFileName?: string | null
  error?: string
}

export function FileDropzone({
  onFileSelect,
  currentFileName,
  error,
}: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      setValidationError("")
      if (
        !ALLOWED_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_MIME_TYPES)[number]
        )
      ) {
        setValidationError(
          "File type not allowed. Accepted: PNG, JPEG, SVG, WebP, GIF, PDF"
        )
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setValidationError("File must be 10MB or less")
        return
      }
      setSelectedFile(file)
      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) validateAndSelect(file)
    },
    [validateAndSelect]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) validateAndSelect(file)
    },
    [validateAndSelect]
  )

  const displayError = error || validationError

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          dragActive
            ? "border-foreground bg-accent"
            : "border-border hover:border-muted-foreground"
        )}
      >
        <p className="text-sm text-muted-foreground">
          {selectedFile
            ? selectedFile.name
            : currentFileName
              ? `Current: ${currentFileName}`
              : "Drag & drop a file here"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          {currentFileName ? "Replace file" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          PNG, JPEG, SVG, WebP, GIF, PDF — max 10MB
        </p>
      </div>
      {displayError && (
        <p className="text-sm text-destructive">{displayError}</p>
      )}
    </div>
  )
}
