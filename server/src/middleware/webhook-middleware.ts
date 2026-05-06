import { type RequestHandler } from "express";

export const requireWebhookSecret: RequestHandler = (req, res, next) => {
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
