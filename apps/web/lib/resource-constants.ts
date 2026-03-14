export const MAX_TITLE_LENGTH = 200
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_PROJECT_STORAGE = 500 * 1024 * 1024 // 500MB

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const
