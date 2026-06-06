import { randomUUID } from "node:crypto";
import { ATTACHMENT_MIME_ALLOWLIST } from "@helpdesk/core";
import { Router } from "express";
import { env } from "../lib/env";
import { handleMulterError, upload } from "../lib/multipart";
import { prisma } from "../lib/prisma";
import {
  contentDispositionFilename,
  dispositionForMime,
  safeFilename,
  storage,
} from "../lib/storage";
import { requireAuth } from "../middleware/auth-middleware";

/**
 * Authorization seam for attachment reads. Today every authenticated agent can
 * view every ticket (and therefore every attachment), so this is always true —
 * it exists so that if per-agent ticket scoping is ever introduced, attachments
 * inherit it from a single place rather than each route growing its own check.
 */
function canViewTicket(_userId: string, _ticketId: number | null): boolean {
  return true;
}

/**
 * POST /api/replies/:id/attachments
 * Multipart form with field name "files" (up to 5 files, 10 MB each).
 * Persists Attachment rows and writes blobs to the configured storage adapter.
 */
export const uploadRouter = Router({ mergeParams: true });

uploadRouter.post(
  "/",
  requireAuth,
  (req, res, next) => {
    upload.array("files", 5)(req, res, (err) => {
      if (handleMulterError(err, res)) return;
      if (err) return next(err);
      next();
    });
  },
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid reply ID" });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No files attached" });
      return;
    }

    for (const f of files) {
      if (!ATTACHMENT_MIME_ALLOWLIST.includes(f.mimetype)) {
        res.status(400).json({ error: `Unsupported file type: ${f.mimetype}` });
        return;
      }
    }

    const reply = await prisma.reply.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
    if (!reply) {
      res.status(404).json({ error: "Reply not found" });
      return;
    }
    // Only the reply's author may attach files to it. This also excludes customer
    // replies (authorId is null), which agents should never upload to.
    if (reply.authorId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const created = [];
    for (const file of files) {
      const safeName = safeFilename(file.originalname);
      const storageKey = `attachments/${id}/${randomUUID()}-${safeName}`;
      await storage.put(storageKey, file.buffer, file.mimetype);
      const row = await prisma.attachment.create({
        data: {
          replyId: id,
          filename: file.originalname,
          contentType: file.mimetype,
          size: file.size,
          storageKey,
        },
        select: {
          id: true,
          filename: true,
          contentType: true,
          size: true,
          createdAt: true,
        },
      });
      created.push(row);
    }

    res.status(201).json(created);
  },
);

/**
 * GET /api/attachments/:id
 * Returns { url } the client can fetch. In dev (local driver) this points
 * back at /api/attachments/:id/file. In prod (s3 driver) this is a presigned
 * GET URL on the bucket with a 5-minute expiry.
 */
export const attachmentsRouter = Router();

attachmentsRouter.get("/:id", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      contentType: true,
      storageKey: true,
      ticketId: true,
      reply: { select: { ticketId: true } },
    },
  });
  if (!attachment) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  // Polymorphic XOR parent: exactly one of ticketId / reply is set.
  const ticketId = attachment.ticketId ?? attachment.reply?.ticketId ?? null;
  if (!canViewTicket(req.user!.id, ticketId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (env.STORAGE_DRIVER === "local") {
    res.json({ url: `/api/attachments/${attachment.id}/file` });
    return;
  }

  const url = await storage.presignDownload(
    attachment.storageKey,
    attachment.filename,
    attachment.contentType,
  );
  res.json({ url });
});

attachmentsRouter.get("/:id/file", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      contentType: true,
      filename: true,
      storageKey: true,
      ticketId: true,
      reply: { select: { ticketId: true } },
    },
  });
  if (!attachment) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  // Polymorphic XOR parent: exactly one of ticketId / reply is set.
  const ticketId = attachment.ticketId ?? attachment.reply?.ticketId ?? null;
  if (!canViewTicket(req.user!.id, ticketId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const buf = await storage.get(attachment.storageKey);
  const disposition = dispositionForMime(attachment.contentType);
  res.setHeader("Content-Type", attachment.contentType);
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${contentDispositionFilename(attachment.filename)}"`,
  );
  res.send(buf);
});
