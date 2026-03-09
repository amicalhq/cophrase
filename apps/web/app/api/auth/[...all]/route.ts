import { auth, toNextJsHandler } from "@workspace/auth"

export const { GET, POST } = toNextJsHandler(auth)
