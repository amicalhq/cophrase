import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { McpContext } from "@/lib/mcp/types"

import { listOrganizations } from "@/lib/mcp/tools/organizations"
import { listProjects, getProject } from "@/lib/mcp/tools/projects"
import { listContentTypes, getContentType } from "@/lib/mcp/tools/content-types"
import {
  listContent,
  getContent,
  createContentItem,
} from "@/lib/mcp/tools/content"
import { getStageInstructions } from "@/lib/mcp/tools/stages"
import {
  listArtifacts,
  getArtifact,
  saveArtifact,
  updateArtifactStatusTool,
} from "@/lib/mcp/tools/artifacts"
import { listResources, getResource } from "@/lib/mcp/tools/resources"

const SERVER_INSTRUCTIONS = `CoPhrase is a content marketing platform. It organizes content creation into projects, content types (templates), and staged pipelines.

## Workflow

1. Call \`list-organizations\` to see your organizations
2. Pick an organization and call \`list-projects\` with its organizationId
3. Call \`list-content-types\` with the organizationId and projectId to see available content templates
4. Call \`list-resources\` with the organizationId and projectId to see available brand assets, then \`get-resource\` to load ones relevant to your task (voice, personas, style guides)
5. Call \`create-content\` with organizationId, projectId, contentTypeId, and title to start a new content piece
6. For each stage in the content type:
   a. Call \`get-stage-instructions\` with contentId and stageId to get the stage description and context on expected outputs
   b. Generate content using the instructions + brand resources + any existing artifacts
   c. Call \`save-artifact\` with contentId, type, title, and data to persist what you generated
7. Use \`update-artifact-status\` to approve or reject artifacts

## Parameter patterns

- **Listing tools** (\`list-projects\`, \`list-content-types\`, \`list-content\`, \`list-resources\`, \`get-project\`, \`get-resource\`, \`create-content\`): require \`organizationId\` as a parameter. Call \`list-organizations\` first to get available org IDs.
- **Record-lookup tools** (\`get-content\`, \`get-artifact\`, \`list-artifacts\`, \`save-artifact\`, \`update-artifact-status\`, \`get-stage-instructions\`, \`get-content-type\`): take the record ID directly. The server resolves the org from the record and verifies your membership automatically.

## Tips

- Always fetch brand resources before generating content — they contain the voice, style, and audience context that makes content on-brand.
- Set \`parentIds\` when saving artifacts that build on prior stage outputs (e.g., a blog draft that references research notes).`

/** All tool definitions keyed by their MCP tool name */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allTools: Record<string, { description: string; inputSchema: any; handler: (input: any, ctx: McpContext) => Promise<any> }> = {
  "list-organizations": listOrganizations,
  "list-projects": listProjects,
  "get-project": getProject,
  "list-content-types": listContentTypes,
  "get-content-type": getContentType,
  "list-content": listContent,
  "get-content": getContent,
  "create-content": createContentItem,
  "get-stage-instructions": getStageInstructions,
  "list-artifacts": listArtifacts,
  "get-artifact": getArtifact,
  "save-artifact": saveArtifact,
  "update-artifact-status": updateArtifactStatusTool,
  "list-resources": listResources,
  "get-resource": getResource,
}

/**
 * Create and configure an MCP server instance.
 * Context (userId) is injected per-request by the route handler.
 */
export function createMcpServer(ctx: McpContext) {
  const server = new McpServer(
    { name: "CoPhrase", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  )

  for (const [name, tool] of Object.entries(allTools)) {
    server.registerTool(
      name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args: { [key: string]: unknown }) => tool.handler(args, ctx),
    )
  }

  return server
}
