import { type RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type Session } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: Session["user"];
      session?: Session["session"];
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

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

export const requireAdminChain: RequestHandler[] = [requireAuth, requireAdmin];
