import { Role } from "@helpdesk/core";
import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import DesktopShell from "./components/DesktopShell";
import MobileShell from "./components/mobile/MobileShell";
import TabletShell from "./components/tablet/TabletShell";
import { Skeleton } from "./components/ui/skeleton";
import { useSession } from "./lib/auth-client";
import { useUnauthorizedRedirect } from "./lib/auth-redirect";
import { useLayoutTier } from "./lib/useBreakpoint";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// The unauthenticated entry points stay eager (above) so the cold-load path
// has no extra round-trip. Every authenticated page is code-split: the initial
// bundle no longer pulls the dashboard, ticket detail, tables, etc. Declared at
// module top level (never inside a component) so their state survives re-renders.
const HomePage = lazy(() => import("./pages/HomePage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const TicketDetailPage = lazy(() => import("./pages/TicketDetailPage"));
const MyTicketsPage = lazy(() => import("./pages/MyTicketsPage"));
const MyStatsPage = lazy(() => import("./pages/MyStatsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const WorkflowPage = lazy(() => import("./pages/WorkflowPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));

// Shown only while a route's JS chunk is fetching; the sidebar shell stays
// mounted around it, and each page renders its own data skeletons afterward.
function RouteFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-11 pb-10 sm:px-6 md:px-8 lg:px-12 xl:px-14">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  );
}

function ProtectedLayout() {
  const { data: session, isPending } = useSession();
  const tier = useLayoutTier();

  // Only block on the very first load (no cached session yet). If we already
  // have a session, keep rendering even while a background revalidation is in
  // flight — otherwise the whole layout would unmount/remount on every
  // navigation, which reads as a page flicker.
  if (isPending && !session) return null;
  if (!session) return <Navigate to="/login" replace />;

  // One shell at a time, chosen in JS — see lib/useBreakpoint. The Suspense +
  // Outlet are identical across shells so route chunks load once and the page
  // mounts once per tier.
  const content = (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );

  if (tier === "mobile") return <MobileShell>{content}</MobileShell>;
  if (tier === "tablet") return <TabletShell>{content}</TabletShell>;
  return <DesktopShell>{content}</DesktopShell>;
}

function AdminLayout() {
  const { data: session, isPending } = useSession();
  const tier = useLayoutTier();

  // Same reasoning as ProtectedLayout: don't unmount on background revalidation.
  if (isPending && !session) return null;

  // The phone build is agent-only — admin tooling (Agents/Workflow/Activity)
  // is not part of the mobile experience, so redirect rather than merely hide.
  if (tier === "mobile") return <Navigate to="/" replace />;

  const role = (session?.user as Record<string, unknown>)?.role;
  if (role !== Role.admin) return <Navigate to="/" replace />;

  return <Outlet />;
}

export default function App() {
  useUnauthorizedRedirect();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/my-tickets" element={<MyTicketsPage />} />
        <Route path="/my-stats" element={<MyStatsPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/users" element={<UsersPage />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          {/* The SLA targets screen was folded into Workflow; keep the old
              path working for bookmarks/links. */}
          <Route path="/sla-policies" element={<Navigate to="/workflow" replace />} />
          <Route path="/activity" element={<ActivityPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
