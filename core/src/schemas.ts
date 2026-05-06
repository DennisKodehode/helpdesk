import { z } from "zod";
import { TicketStatus, TicketCategory } from "./types";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
});

export type CreateUserData = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")),
});

export type UpdateUserData = z.infer<typeof updateUserSchema>;

export const inboundEmailSchema = z.object({
  fromName: z.string().trim().min(1),
  fromEmail: z.email("Invalid email address"),
  subject: z.string().trim().default("(no subject)"),
  body: z.string().optional(),
});

export type InboundEmailData = z.infer<typeof inboundEmailSchema>;

export const ticketSchema = z.object({
  id: z.number(),
  fromName: z.string(),
  fromEmail: z.string(),
  subject: z.string(),
  status: z.nativeEnum(TicketStatus),
  category: z.nativeEnum(TicketCategory).nullable(),
  assignedToId: z.string().nullable(),
  createdAt: z.string(),
});

export type Ticket = z.infer<typeof ticketSchema>;

export const TICKET_SORT_FIELDS = [
  "subject",
  "fromName",
  "status",
  "category",
  "createdAt",
] as const;

export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

export const ticketSortSchema = z.object({
  sortBy: z.enum(TICKET_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
