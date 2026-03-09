import { customAlphabet } from "nanoid"

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"

function createIdGenerator(prefix: string, size: number) {
  const generate = customAlphabet(alphabet, size)
  return () => `${prefix}_${generate()}`
}

// --- Resource ID generators ---
// Add a new generator here for every new table/resource.
// Use shorter sizes (8) for low-cardinality, longer (16) for high-cardinality.

export const createAiProviderId = createIdGenerator("aip", 10)
