import { rm } from "node:fs/promises";
import path from "node:path";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), ".attachments");

describe("attachments routes", () => {
  let authCookie: string;
  let testUserId: string;
  let ticketId: number;
  let replyId: number;

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
    // Clean up any test artifacts that landed on disk
    await rm(ATTACHMENTS_DIR, { recursive: true, force: true });
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
