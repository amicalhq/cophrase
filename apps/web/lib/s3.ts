import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.S3_BUCKET!

function getResourceKey(
  orgId: string,
  projectId: string,
  resourceId: string,
  fileName: string
) {
  return `orgs/${orgId}/projects/${projectId}/resources/${resourceId}/${fileName}`
}

export async function generatePresignedUploadUrl(
  orgId: string,
  projectId: string,
  resourceId: string,
  fileName: string,
  contentType: string
) {
  const key = getResourceKey(orgId, projectId, resourceId, fileName)
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  const url = await getSignedUrl(s3Client, command, { expiresIn: 900 })
  return { url, key }
}

export async function generatePresignedGetUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 })
}

export async function deleteS3Object(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  await s3Client.send(command)
}
