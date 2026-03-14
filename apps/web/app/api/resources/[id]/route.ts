import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { resourceCategoryEnum, type ResourceCategory } from "@workspace/db"
import {
  getResourceById,
  getResourceContent,
  updateResource,
  deleteResource,
} from "@/lib/data/resources"
import { isOrgMember } from "@/lib/data/projects"
import {
  generatePresignedGetUrl,
  generatePresignedUploadUrl,
  deleteS3Object,
} from "@/lib/s3"
import {
  MAX_TITLE_LENGTH,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from "@/lib/resource-constants"

const validCategories = resourceCategoryEnum.enumValues as readonly string[]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const searchParams = _request.nextUrl.searchParams
  const projectId = searchParams.get("projectId")
  const orgId = searchParams.get("orgId")

  if (!projectId || !orgId) {
    return NextResponse.json(
      { error: "projectId and orgId are required" },
      { status: 400 },
    )
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const resourceData = await getResourceById(id, projectId, orgId)
    if (!resourceData) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      )
    }

    const response: Record<string, unknown> = { ...resourceData }

    if (resourceData.type === "text") {
      const content = await getResourceContent(id)
      response.content = content?.content ?? null
    }

    if (resourceData.type === "file" && resourceData.fileUrl) {
      response.presignedUrl = await generatePresignedGetUrl(
        resourceData.fileUrl,
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to fetch resource:", error)
    return NextResponse.json(
      { error: "Failed to fetch resource" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const {
    projectId,
    orgId,
    title,
    category,
    linkUrl,
    content,
    fileName,
    fileMimeType,
    fileSize,
  } = body as {
    projectId?: string
    orgId?: string
    title?: string
    category?: string
    linkUrl?: string
    content?: Record<string, unknown>
    fileName?: string
    fileMimeType?: string
    fileSize?: number
  }

  if (!projectId || !orgId) {
    return NextResponse.json(
      { error: "projectId and orgId are required" },
      { status: 400 },
    )
  }

  if (title !== undefined && title.trim().length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
      { status: 400 },
    )
  }

  if (category && !validCategories.includes(category)) {
    return NextResponse.json(
      { error: "Invalid category" },
      { status: 400 },
    )
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const existing = await getResourceById(id, projectId, orgId)
  if (!existing) {
    return NextResponse.json(
      { error: "Resource not found" },
      { status: 404 },
    )
  }

  try {
    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (category) updateData.category = category as ResourceCategory
    if (content !== undefined) updateData.content = content
    if (existing.type === "link" && linkUrl !== undefined) {
      try {
        const url = new URL(linkUrl)
        if (!["http:", "https:"].includes(url.protocol)) {
          return NextResponse.json(
            { error: "URL must be http or https" },
            { status: 400 },
          )
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid URL" },
          { status: 400 },
        )
      }
      updateData.linkUrl = linkUrl
    }

    const response: Record<string, unknown> = { id }
    let oldFileUrl: string | null = null

    // Handle file replacement — generate new URL but keep old file until upload confirms
    if (existing.type === "file" && fileName && fileMimeType && fileSize) {
      if (
        !(ALLOWED_MIME_TYPES as readonly string[]).includes(fileMimeType)
      ) {
        return NextResponse.json(
          { error: "File type not allowed" },
          { status: 400 },
        )
      }
      if (fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File size must be 10MB or less" },
          { status: 400 },
        )
      }

      oldFileUrl = existing.fileUrl

      // Generate new presigned URL
      const { url, key } = await generatePresignedUploadUrl(
        existing.organizationId,
        projectId,
        id,
        fileName,
        fileMimeType,
      )
      updateData.fileUrl = key
      updateData.fileName = fileName
      updateData.fileMimeType = fileMimeType
      updateData.fileSize = fileSize
      response.uploadUrl = url
    }

    await updateResource(id, projectId, orgId, updateData)

    // Delete old S3 object after DB update succeeds
    if (oldFileUrl) {
      try {
        await deleteS3Object(oldFileUrl)
      } catch (error) {
        console.error("Failed to delete old S3 object:", error)
        // Non-fatal: old object becomes orphaned but new one is in place
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to update resource:", error)
    return NextResponse.json(
      { error: "Failed to update resource" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const searchParams = _request.nextUrl.searchParams
  const projectId = searchParams.get("projectId")
  const orgId = searchParams.get("orgId")

  if (!projectId || !orgId) {
    return NextResponse.json(
      { error: "projectId and orgId are required" },
      { status: 400 },
    )
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const deleted = await deleteResource(id, projectId, orgId)
    if (!deleted) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      )
    }

    // Delete S3 object for file resources
    if (deleted.type === "file" && deleted.fileUrl) {
      try {
        await deleteS3Object(deleted.fileUrl)
      } catch (error) {
        console.error("Failed to delete S3 object:", error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete resource:", error)
    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 },
    )
  }
}
