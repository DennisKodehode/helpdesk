import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { storage } from "../lib/storage";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), ".attachments");

describe("attachments routes", () => {
  let authCookie: string;
  let testUserId: string;
  let otherUserId: string;
  let ticketId: number;
  let replyId: number;
  let othersReplyId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const id = generateId();
    const now = new Date();

    await prisma.user.create({
      data: {
        id,
        name: "Attachments Agent",
        email: "test-attachments@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
    testUserId = id;

    // A second agent, used to prove an agent can't attach to someone else's reply.
    const otherId = generateId();
    await prisma.user.create({
      data: {
        id: otherId,
        name: "Other Agent",
        email: "test-attachments-other@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    otherUserId = otherId;

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-attachments@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    authCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.account.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.user.delete({ where: { id: otherUserId } });
    // Clean up any test artifacts that landed on disk. On Windows the OS can
    // briefly hold a lock on a just-written file (AV/indexer) after its handle
    // is closed, making an immediate recursive rmdir throw EBUSY. Node's
    // built-in retry backoff (which covers EBUSY/EPERM/ENOTEMPTY) absorbs it.
    await rm(ATTACHMENTS_DIR, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });

  beforeEach(async () => {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Attach Test",
        fromEmail: "attach@example.com",
        subject: "Attach subject",
        body: "",
      },
    });
    ticketId = ticket.id;
    const reply = await prisma.reply.create({
      data: {
        ticketId,
        authorId: testUserId,
        senderType: "agent",
        body: "Reply body",
      },
    });
    replyId = reply.id;
    const othersReply = await prisma.reply.create({
      data: {
        ticketId,
        authorId: otherUserId,
        senderType: "agent",
        body: "Another agent's reply",
      },
    });
    othersReplyId = othersReply.id;
  });

  afterEach(async () => {
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  describe("POST /api/replies/:id/attachments", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .attach("files", Buffer.from("hello"), {
          filename: "hello.txt",
          contentType: "text/plain",
        });
      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid reply ID", async () => {
      const res = await request(app)
        .post("/api/replies/abc/attachments")
        .set("Cookie", authCookie)
        .attach("files", Buffer.from("hello"), {
          filename: "hello.txt",
          contentType: "text/plain",
        });
      expect(res.status).toBe(400);
    });

    it("returns 400 when no files are attached", async () => {
      const res = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no files/i);
    });

    it("returns 404 when the reply does not exist", async () => {
      const res = await request(app)
        .post("/api/replies/999999999/attachments")
        .set("Cookie", authCookie)
        .attach("files", Buffer.from("hello"), {
          filename: "hello.txt",
          contentType: "text/plain",
        });
      expect(res.status).toBe(404);
    });

    it("returns 403 when uploading to another agent's reply", async () => {
      const res = await request(app)
        .post(`/api/replies/${othersReplyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", Buffer.from("hello"), {
          filename: "hello.txt",
          contentType: "text/plain",
        });
      expect(res.status).toBe(403);
    });

    it("returns 400 when MIME is not in the allowlist", async () => {
      const res = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", Buffer.from("<svg/>"), {
          filename: "evil.svg",
          contentType: "image/svg+xml",
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/unsupported/i);
    });

    it("returns 413 when a single file exceeds 10 MB", async () => {
      const oversize = Buffer.alloc(11 * 1024 * 1024, 1);
      const res = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", oversize, {
          filename: "big.png",
          contentType: "image/png",
        });
      expect(res.status).toBe(413);
    });

    it("returns 400 when more than 5 files are attached", async () => {
      const req = request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie);
      for (let i = 0; i < 6; i++) {
        req.attach("files", Buffer.from(`file ${i}`), {
          filename: `f${i}.txt`,
          contentType: "text/plain",
        });
      }
      const res = await req;
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too many/i);
    });

    it("returns 201 and persists rows + file on disk for a valid upload", async () => {
      const body = Buffer.from("hello world", "utf8");
      const res = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", body, {
          filename: "greeting.txt",
          contentType: "text/plain",
        });

      expect(res.status).toBe(201);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      const persisted = res.body[0];
      expect(persisted.filename).toBe("greeting.txt");
      expect(persisted.contentType).toBe("text/plain");
      expect(persisted.size).toBe(body.length);

      const rowFromDb = await prisma.attachment.findUnique({
        where: { id: persisted.id },
        select: { storageKey: true, replyId: true },
      });
      expect(rowFromDb).not.toBeNull();
      expect(rowFromDb!.replyId).toBe(replyId);
      expect(rowFromDb!.storageKey).toMatch(/^attachments\/\d+\//);
    });

    it("accepts multiple files in a single request", async () => {
      const res = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", Buffer.from("a"), {
          filename: "a.txt",
          contentType: "text/plain",
        })
        .attach("files", Buffer.from("bb"), {
          filename: "b.txt",
          contentType: "text/plain",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(2);
    });
  });

  describe("GET /api/attachments/:id", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get(`/api/attachments/some-id`);
      expect(res.status).toBe(401);
    });

    it("returns 404 when the attachment does not exist", async () => {
      const res = await request(app)
        .get("/api/attachments/nonexistent")
        .set("Cookie", authCookie);
      expect(res.status).toBe(404);
    });

    it("returns a same-origin URL for the local driver", async () => {
      const upload = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", Buffer.from("x"), {
          filename: "x.txt",
          contentType: "text/plain",
        });
      const attachmentId = upload.body[0].id;

      const res = await request(app)
        .get(`/api/attachments/${attachmentId}`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(200);
      expect(res.body.url).toBe(`/api/attachments/${attachmentId}/file`);
    });
  });

  describe("GET /api/attachments/:id/file", () => {
    it("streams the bytes with the right Content-Type and Content-Disposition", async () => {
      const body = Buffer.from("file contents here", "utf8");
      const upload = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", body, {
          filename: "doc.txt",
          contentType: "text/plain",
        });
      const attachmentId = upload.body[0].id;

      const res = await request(app)
        .get(`/api/attachments/${attachmentId}/file`)
        .set("Cookie", authCookie)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => callback(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/^text\/plain/);
      // text/plain is NOT inline-previewable → attachment disposition
      expect(res.headers["content-disposition"]).toMatch(
        /^attachment; filename="doc\.txt"/,
      );
      expect((res.body as Buffer).toString("utf8")).toBe("file contents here");
    });

    it("uses Content-Disposition: inline for image/* MIMEs", async () => {
      const upload = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
          filename: "shot.png",
          contentType: "image/png",
        });
      const attachmentId = upload.body[0].id;

      const res = await request(app)
        .get(`/api/attachments/${attachmentId}/file`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toMatch(/^inline; filename="shot\.png"/);
    });

    it("uses Content-Disposition: inline for application/pdf", async () => {
      const upload = await request(app)
        .post(`/api/replies/${replyId}/attachments`)
        .set("Cookie", authCookie)
        .attach("files", Buffer.from("%PDF-1.4"), {
          filename: "doc.pdf",
          contentType: "application/pdf",
        });
      const attachmentId = upload.body[0].id;

      const res = await request(app)
        .get(`/api/attachments/${attachmentId}/file`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toMatch(/^inline; filename="doc\.pdf"/);
    });

    it("sanitizes CR/LF and quotes in the Content-Disposition filename", async () => {
      // Control chars can't be carried cleanly through multipart, so insert a
      // row with a hostile filename directly and exercise the file route.
      const storageKey = `attachments/${replyId}/${randomUUID()}-evil.txt`;
      await storage.put(storageKey, Buffer.from("data"), "text/plain");
      const row = await prisma.attachment.create({
        data: {
          replyId,
          filename: 'bad"name\r\nX-Injected: pwned.txt',
          contentType: "text/plain",
          size: 4,
          storageKey,
        },
        select: { id: true },
      });

      const res = await request(app)
        .get(`/api/attachments/${row.id}/file`)
        .set("Cookie", authCookie);
      expect(res.status).toBe(200);
      const cd = res.headers["content-disposition"] as string;
      expect(cd).not.toMatch(/[\r\n]/);
      expect(cd).toContain('filename="bad_name__X-Injected: pwned.txt"');
      // The injected CRLF must not have become a real response header.
      expect(res.headers["x-injected"]).toBeUndefined();
    });

    it("returns 401 without auth", async () => {
      const res = await request(app).get("/api/attachments/any/file");
      expect(res.status).toBe(401);
    });

    it("returns 404 when the attachment does not exist", async () => {
      const res = await request(app)
        .get("/api/attachments/nonexistent/file")
        .set("Cookie", authCookie);
      expect(res.status).toBe(404);
    });
  });
});
