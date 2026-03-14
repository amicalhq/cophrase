import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import {
  resourceTypeEnum,
  resourceCategoryEnum,
  type ResourceType,
  type ResourceCategory,
} from "@workspace/db"
import {
  getResourcesByProject,
  createResource,
  updateResource,
  getProjectStorageUsage,
} from "@/lib/data/resources"
import { getProjectByIdAndOrg, isOrgMember } from "@/lib/data/projects"
import { generatePresignedUploadUrl, generatePresignedGetUrl } from "@/lib/s3"
import {
  MAX_TITLE_LENGTH,
  MAX_FILE_SIZE,
  MAX_PROJECT_STORAGE,
  ALLOWED_MIME_TYPES,
} from "@/lib/resource-constants"

const validTypes = resourceTypeEnum.enumValues as readonly string[]
const validCategories = resourceCategoryEnum.enumValues as readonly string[]

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
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

  const project = await getProjectByIdAndOrg(projectId, orgId)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const type = searchParams.get("type") as ResourceType | null
  const category = searchParams.get("category") as ResourceCategory | null
  const search = searchParams.get("search") || undefined

  try {
    const resources = await getResourcesByProject(projectId, orgId, {
      type: type && validTypes.includes(type) ? type : undefined,
      category:
        category && validCategories.includes(category) ? category : undefined,
      search,
    })

    const resourcesWithUrls = await Promise.all(
      resources.map(async (r) => {
        if (r.type === "file" && r.fileUrl) {
          const presignedUrl = await generatePresignedGetUrl(r.fileUrl)
          return { ...r, presignedUrl }
        }
        return r
      }),
    )

    return NextResponse.json(resourcesWithUrls)
  } catch (error) {
    console.error("Failed to fetch resources:", error)
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
    type,
    category,
    linkUrl,
    fileName,
    fileMimeType,
    fileSize,
    content,
  } = body as {
    projectId?: string
    orgId?: string
    title?: string
    type?: string
    category?: string
    linkUrl?: string
    fileName?: string
    fileMimeType?: string
    fileSize?: number
    content?: Record<string, unknown>
  }

  if (!projectId || !orgId) {
    return NextResponse.json(
      { error: "projectId and orgId are required" },
      { status: 400 },
    )
  }
  if (!title?.trim()) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 },
    )
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Title must be ${MAX_TITLE_LENGTH} characters or less` },
      { status: 400 },
    )
  }
  if (!type || !validTypes.includes(type)) {
    return NextResponse.json(
      { error: "type must be 'text', 'link', or 'file'" },
      { status: 400 },
    )
  }
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json(
      { error: "Invalid category" },
      { status: 400 },
    )
  }

  // Type-specific validation
  if (type === "link") {
    if (!linkUrl) {
      return NextResponse.json(
        { error: "URL is required for link resources" },
        { status: 400 },
      )
    }
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
  }

  if (type === "text" && !content) {
    return NextResponse.json(
      { error: "Content is required for text resources" },
      { status: 400 },
    )
  }

  if (type === "file") {
    if (!fileName || !fileMimeType || !fileSize) {
      return NextResponse.json(
        { error: "fileName, fileMimeType, and fileSize are required for file resources" },
        { status: 400 },
      )
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(fileMimeType)) {
      return NextResponse.json(
        { error: "File type not allowed. Accepted: PNG, JPEG, SVG, WebP, GIF, PDF" },
        { status: 400 },
      )
    }
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be 10MB or less" },
        { status: 400 },
      )
    }
  }

  const isMember = await isOrgMember(session.user.id, orgId)
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const project = await getProjectByIdAndOrg(projectId, orgId)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  // Check project storage limit for file resources
  if (type === "file" && fileSize) {
    const currentUsage = await getProjectStorageUsage(projectId)
    if (currentUsage + fileSize > MAX_PROJECT_STORAGE) {
      return NextResponse.json(
        { error: "Project storage limit exceeded (500MB max)" },
        { status: 400 },
      )
    }
  }

  try {
    const created = await createResource({
      projectId,
      organizationId: project.organizationId,
      createdBy: session.user.id,
      title: title.trim(),
      type: type as ResourceType,
      category: category as ResourceCategory,
      linkUrl: type === "link" ? linkUrl : undefined,
      content: type === "text" ? content : undefined,
    })

    const response: Record<string, unknown> = { ...created }

    // Generate presigned upload URL for file resources
    if (type === "file" && fileName && fileMimeType) {
      const { url, key } = await generatePresignedUploadUrl(
        project.organizationId,
        projectId,
        created.id,
        fileName,
        fileMimeType,
      )
      // Update the resource with file metadata
      await updateResource(created.id, projectId, project.organizationId, {
        fileUrl: key,
        fileName,
        fileMimeType,
        fileSize,
      })
      response.uploadUrl = url
      response.fileUrl = key
      response.fileName = fileName
      response.fileMimeType = fileMimeType
      response.fileSize = fileSize
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error("Failed to create resource:", error)
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 },
    )
  }
}
