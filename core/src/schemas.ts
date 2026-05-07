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

export const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export type Agent = z.infer<typeof agentSchema>;

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
  status: z.enum(TicketStatus),
  category: z.enum(TicketCategory).nullable(),
  assignedToId: z.string().nullable(),
  createdAt: z.string(),
});

export type Ticket = z.infer<typeof ticketSchema>;

export const ticketDetailSchema = z.object({
  id: z.number(),
  fromName: z.string(),
  fromEmail: z.string(),
  subject: z.string(),
  body: z.string(),
  status: z.enum(TicketStatus),
  category: z.enum(TicketCategory).nullable(),
  assignedToId: z.string().nullable(),
  assignedTo: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TicketDetail = z.infer<typeof ticketDetailSchema>;

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
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const paginatedTicketsSchema = z.object({
  data: z.array(ticketSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type PaginatedTickets = z.infer<typeof paginatedTicketsSchema>;

export const updateTicketSchema = z.object({
  assignedToId: z.string().nullable().optional(),
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).nullable().optional(),
});

export type UpdateTicketData = z.infer<typeof updateTicketSchema>;
