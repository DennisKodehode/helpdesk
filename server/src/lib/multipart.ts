import { MAX_ATTACHMENT_SIZE_BYTES } from "@helpdesk/core";
import type { Response } from "express";
import multer from "multer";

/**
 * Shared multer config for attachment uploads. Mount this on any route that
 * accepts attachments. multer is a no-op when the request's Content-Type
 * isn't multipart/form-data, so always-mounting it on a route that ALSO
 * accepts JSON (like POST /api/tickets/:id/replies) is safe.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
    files: 5,
  },
});

/**
 * Translate a multer error into a clean JSON response. Returns true if the
 * error was handled and a response was sent, false otherwise.
 */
export function handleMulterError(err: unknown, res: Response): boolean {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large (max 10 MB per file)" });
      return true;
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "Too many files (max 5 per request)" });
      return true;
    }
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}
