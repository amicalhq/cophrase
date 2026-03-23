/**
 * Extract plaintext from a TipTap JSONContent document tree.
 * Walks the node tree recursively, joins text nodes, and adds
 * newlines between block-level nodes (paragraph, heading, etc.).
 */
export function tiptapToPlaintext(json: unknown): string {
  if (!json || typeof json !== "object") return ""

  const node = json as { type?: string; text?: string; content?: unknown[] }

  // Leaf text node
  if (node.type === "text" && typeof node.text === "string") {
    return node.text
  }

  // Recurse into children
  if (!Array.isArray(node.content)) return ""

  const childTexts = node.content
    .map((child) => tiptapToPlaintext(child))
    .filter(Boolean)

  // Block-level nodes get newlines between them
  const blockTypes = new Set([
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "bulletList",
    "orderedList",
    "listItem",
    "horizontalRule",
    "doc",
  ])

  if (blockTypes.has(node.type ?? "")) {
    return childTexts.join("\n")
  }

  return childTexts.join("")
}
