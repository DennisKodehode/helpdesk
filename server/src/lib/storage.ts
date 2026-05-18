import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client } from "@bradenmacdonald/s3-lite-client";
import { env } from "./env";

export interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /**
   * Returns a URL the client can fetch to download the object. For the local
   * driver this is a same-origin route served by the app; for S3 it's a
   * presigned GET URL with the original filename baked into the
   * Content-Disposition. The contentType drives whether the disposition is
   * "inline" (image/* + PDF — browser previews in a new tab) or "attachment"
   * (everything else — browser downloads).
   */
  presignDownload(
    key: string,
    filename: string,
    contentType: string,
    expirySeconds?: number,
  ): Promise<string>;
  /** Reads the object back into memory. Used by the local-driver file route. */
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const INLINE_PREVIEWABLE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

/**
 * Decide whether the browser should render an attachment inline (preview in a
 * new tab) or download it. Images and PDFs preview cleanly; everything else
 * (docx, xlsx, zip, csv, plain text) is more useful as a download.
 */
export function dispositionForMime(mime: string): "inline" | "attachment" {
  return INLINE_PREVIEWABLE_MIMES.has(mime) ? "inline" : "attachment";
}

const LOCAL_ROOT = path.resolve(process.cwd(), ".attachments");

function localPath(key: string): string {
  return path.join(LOCAL_ROOT, key);
}

function createLocalAdapter(): StorageAdapter {
  return {
    async put(key, body) {
      const full = localPath(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
    },
    async get(key) {
      return readFile(localPath(key));
    },
    async presignDownload(_key, _filename, _contentType) {
      // The route layer maps storageKey → attachment ID → /api/attachments/:id/file.
      // This is never the actual URL surfaced to the client; the attachments
      // route builds the public URL using the attachment ID, not the storage key.
      // We return a marker so callers don't accidentally use this directly.
      return "local:";
    },
    async delete(key) {
      await rm(localPath(key), { force: true });
    },
  };
}

function createS3Adapter(): StorageAdapter {
  const client = new S3Client({
    endPoint: env.S3_ENDPOINT!,
    region: env.S3_REGION!,
    bucket: env.S3_BUCKET!,
    accessKey: env.S3_ACCESS_KEY!,
    secretKey: env.S3_SECRET_KEY!,
  });

  return {
    async put(key, body, contentType) {
      await client.putObject(key, body, {
        metadata: { "Content-Type": contentType },
      });
    },
    async get(key) {
      const res = await client.getObject(key);
      const buf = await res.arrayBuffer();
      return Buffer.from(buf);
    },
    async presignDownload(key, filename, contentType, expirySeconds = 300) {
      const disposition = dispositionForMime(contentType);
      return client.presignedGetObject(key, {
        expirySeconds,
        responseParams: {
          "response-content-disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"`,
        },
      });
    },
    async delete(key) {
      await client.deleteObject(key);
    },
  };
}

export const storage: StorageAdapter =
  env.STORAGE_DRIVER === "s3" ? createS3Adapter() : createLocalAdapter();

/**
 * Normalize a user-provided filename for use inside the storage key. Strips
 * path separators, null bytes, and leading dots; keeps only safe characters;
 * caps length so the storage key stays reasonable.
 */
export function safeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 100);
}
