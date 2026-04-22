
## Problem

We recieve alot of support emails daily, currently our agents manually have to read, classify and respond to each ticket - wich is slow and feels impersonal for the user(students) because of canned responses.

## Solution

Build a ticket management system that uses AI to automatically classify, respond to, and route support tickets - delivering faster, more personalized responses to students while freeing up agents for complex issues.

## Features

- Recieve support emails and create tickets
- Ticket list with filtering and sorting
- Ticket detail view
- Ai-powered ticket classification
- Ai-suggested replies (agent must review and approve before sending)
- Auto-generate human-friendly responses using a knowledge base
- Ai summaries
- User management (admin only)
- Dashboard to view and manage all tickets

## Ticket Statuses

- **Open** — ticket has been received and is awaiting resolution
- **Resolved** — agent marks the ticket as resolved; student is notified. If the student replies within 48 hours, the ticket automatically reopens
- **Closed** — ticket is locked after 48 hours with no student reply, or an admin force-closes it. Closed tickets cannot be reopened by a reply

Transition rules:
- Agents can move tickets from Open → Resolved
- Closed is reached automatically after the grace period, or by an Admin manually
- Tickets cannot skip directly from Open → Closed

## Ticket Categories

- General Question
- Technical Question
- Refund Request

Categories are assigned automatically by AI on ticket creation. Agents can manually override the category if the classification is incorrect.

## User Roles & Onboarding

- **Admin** — seeded at deployment; can create and manage agents, and force-close tickets
- **Agent** — created by an admin; can view, manage, and resolve tickets

