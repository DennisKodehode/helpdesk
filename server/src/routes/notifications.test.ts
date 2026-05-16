import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import { generateId } from "better-auth";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { NotificationType, TicketStatus } from "@helpdesk/core";

describe("notifications API", () => {
  let recipientId: string;
  let actorId: string;
  let recipientCookie: string;
  let otherUserCookie: string;
  let otherUserId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();

    recipientId = generateId();
    await prisma.user.create({
      data: { id: recipientId, name: "Notif Recipient", email: "notif-recipient@example.com", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    await prisma.account.create({
      data: { id: generateId(), accountId: recipientId, providerId: "credential", userId: recipientId, password: hashedPassword, createdAt: now, updatedAt: now },
    });
    const signInRes = await request(app).post("/api/auth/sign-in/email").send({ email: "notif-recipient@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    recipientCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    actorId = generateId();
    await prisma.user.create({
      data: { id: actorId, name: "Notif Actor", email: "notif-actor@example.com", emailVerified: true, role: "admin", createdAt: now, updatedAt: now },
    });

    otherUserId = generateId();
    await prisma.user.create({
      data: { id: otherUserId, name: "Other User", email: "notif-other@example.com", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    await prisma.account.create({
      data: { id: generateId(), accountId: otherUserId, providerId: "credential", userId: otherUserId, password: hashedPassword, createdAt: now, updatedAt: now },
    });
    const otherSignIn = await request(app).post("/api/auth/sign-in/email").send({ email: "notif-other@example.com", password: "Testpassword1!" });
    const otherCookies = otherSignIn.headers["set-cookie"] as string[] | string;
    otherUserCookie = Array.isArray(otherCookies) ? otherCookies.join("; ") : otherCookies;

    const ticket = await prisma.ticket.create({
      data: { fromName: "Customer", fromEmail: "customer-notif@example.com", subject: "Notif test ticket", body: "Body", status: TicketStatus.open },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { OR: [{ userId: recipientId }, { userId: otherUserId }] } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.session.deleteMany({ where: { userId: { in: [recipientId, otherUserId] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [recipientId, otherUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [recipientId, actorId, otherUserId] } } });
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { OR: [{ userId: recipientId }, { userId: otherUserId }] } });
  });

  describe("GET /api/notifications", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
    });

    it("returns empty list and zero unreadCount when user has no notifications", async () => {
      const res = await request(app).get("/api/notifications").set("Cookie", recipientCookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.unreadCount).toBe(0);
    });

    it("returns notifications for the authenticated user in createdAt desc order", async () => {
      const older = new Date(Date.now() - 5000);
      const newer = new Date();
      await prisma.notification.create({
        data: { userId: recipientId, type: NotificationType.customer_reply, ticketId, createdAt: older },
      });
      await prisma.notification.create({
        data: { userId: recipientId, type: NotificationType.ticket_assigned, ticketId, actorId, createdAt: newer },
      });

      const res = await request(app).get("/api/notifications").set("Cookie", recipientCookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].type).toBe(NotificationType.ticket_assigned);
      expect(res.body.data[0].actorName).toBe("Notif Actor");
      expect(res.body.data[0].ticketSubject).toBe("Notif test ticket");
      expect(res.body.data[1].type).toBe(NotificationType.customer_reply);
      expect(res.body.data[1].actorName).toBeNull();
    });

    it("counts only unread notifications in unreadCount", async () => {
      await prisma.notification.create({
        data: { userId: recipientId, type: NotificationType.customer_reply, ticketId, readAt: new Date() },
      });
      await prisma.notification.create({
        data: { userId: recipientId, type: NotificationType.customer_reply, ticketId },
      });
      await prisma.notification.create({
        data: { userId: recipientId, type: NotificationType.customer_reply, ticketId },
      });

      const res = await request(app).get("/api/notifications").set("Cookie", recipientCookie);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.unreadCount).toBe(2);
    });

    it("does not return notifications belonging to other users", async () => {
      await prisma.notification.create({
        data: { userId: otherUserId, type: NotificationType.customer_reply, ticketId },
      });
      const res = await request(app).get("/api/notifications").set("Cookie", recipientCookie);
      expect(res.body.data).toEqual([]);
      expect(res.body.unreadCount).toBe(0);
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).patch("/api/notifications/some-id/read");
      expect(res.status).toBe(401);
    });

    it("marks an unread notification as read", async () => {
      const n = await prisma.notification.create({
        data: { userId: recipientId, type: NotificationType.customer_reply, ticketId },
      });
      const res = await request(app).patch(`/api/notifications/${n.id}/read`).set("Cookie", recipientCookie);
      expect(res.status).toBe(204);
      const refreshed = await prisma.notification.findUnique({ where: { id: n.id } });
      expect(refreshed!.readAt).not.toBeNull();
    });

    it("is idempotent — re-marking an already-read notification still returns 204", async () => {
      const n = await prisma.notification.create({
        data: { userId: recipientId, type: NotificationType.customer_reply, ticketId, readAt: new Date() },
      });
      const res = await request(app).patch(`/api/notifications/${n.id}/read`).set("Cookie", recipientCookie);
      expect(res.status).toBe(204);
    });

    it("returns 404 when notification does not exist", async () => {
      const res = await request(app).patch("/api/notifications/non-existent-id/read").set("Cookie", recipientCookie);
      expect(res.status).toBe(404);
    });

    it("returns 404 when the notification belongs to a different user", async () => {
      const n = await prisma.notification.create({
        data: { userId: otherUserId, type: NotificationType.customer_reply, ticketId },
      });
      const res = await request(app).patch(`/api/notifications/${n.id}/read`).set("Cookie", recipientCookie);
      expect(res.status).toBe(404);

      const refreshed = await prisma.notification.findUnique({ where: { id: n.id } });
      expect(refreshed!.readAt).toBeNull();
    });
  });

  describe("POST /api/notifications/mark-all-read", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).post("/api/notifications/mark-all-read");
      expect(res.status).toBe(401);
    });

    it("marks all unread notifications for the current user as read", async () => {
      await prisma.notification.create({ data: { userId: recipientId, type: NotificationType.customer_reply, ticketId } });
      await prisma.notification.create({ data: { userId: recipientId, type: NotificationType.ticket_assigned, ticketId, actorId } });
      await prisma.notification.create({ data: { userId: recipientId, type: NotificationType.customer_reply, ticketId, readAt: new Date() } });

      const res = await request(app).post("/api/notifications/mark-all-read").set("Cookie", recipientCookie);
      expect(res.status).toBe(200);
      expect(res.body.markedCount).toBe(2);

      const remainingUnread = await prisma.notification.count({ where: { userId: recipientId, readAt: null } });
      expect(remainingUnread).toBe(0);
    });

    it("does not affect other users' notifications", async () => {
      await prisma.notification.create({ data: { userId: otherUserId, type: NotificationType.customer_reply, ticketId } });
      const res = await request(app).post("/api/notifications/mark-all-read").set("Cookie", recipientCookie);
      expect(res.status).toBe(200);
      expect(res.body.markedCount).toBe(0);

      const otherUnread = await prisma.notification.count({ where: { userId: otherUserId, readAt: null } });
      expect(otherUnread).toBe(1);
    });
  });
});
