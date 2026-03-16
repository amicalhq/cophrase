/**
 * Shared utility for harness modules.
 *
 * This file must stay free of Node.js-specific imports and DB access so it can
 * be used from both "use workflow" bundles and "use client" components.
 */

/** Extract plain text from DB `parts` (string or [{text,type}] array). */
export function extractTextFromParts(parts: unknown): string {
  if (typeof parts === "string") return parts
  if (Array.isArray(parts)) {
    return parts
      .map((p) => {
        if (typeof p === "string") return p
        if (typeof p === "object" && p !== null && "text" in p) {
          const text = (p as { text: unknown }).text
          if (typeof text === "string") {
            // Unwrap double-serialized JSON strings
            if (text.startsWith("[{")) {
              try {
                return extractTextFromParts(JSON.parse(text))
              } catch {
                return text
              }
            }
            return text
          }
        }
        return ""
      })
      .join("")
  }
  return String(parts ?? "")
}
