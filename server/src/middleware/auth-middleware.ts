import { hasAdminAccess, isGlobalAdmin } from "@helpdesk/core";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { auth, type Session } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: Session["user"];
      session?: Session["session"];
      // Raw request body captured by express.json's `verify` hook, used for
      // webhook signature verification (see inbound-email route).
      rawBody?: string;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = session.user;
  req.session = session.session;
  next();
};

// Admin-console access: both `admin` and `globalAdmin` pass. Use hasAdminAccess
// (not a raw `=== "admin"`) so the global admin isn't locked out of every
// admin-gated route.
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!hasAdminAccess(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

// Global-admin only. Most admin-management rules are target-dependent and live
// inline in users.ts, but this is here for any wholly global-admin-only route.
export const requireGlobalAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!isGlobalAdmin(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

export const requireAdminChain: RequestHandler[] = [requireAuth, requireAdmin];

export const requireGlobalAdminChain: RequestHandler[] = [
  requireAuth,
  requireGlobalAdmin,
];
