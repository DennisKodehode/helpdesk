import { Role } from "@helpdesk/core";
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import MobileTopbar from "./components/MobileTopbar";
import Sidebar from "./components/Sidebar";
import { Skeleton } from "./components/ui/skeleton";
import { useSession } from "./lib/auth-client";
import { useUnauthorizedRedirect } from "./lib/auth-redirect";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import LoginPage from "./pages/LoginPage";

// The two unauthenticated entry points stay eager (above) so the cold-load path
// has no extra round-trip. Every authenticated page is code-split: the initial
// bundle no longer pulls the dashboard, ticket detail, tables, etc. Declared at
// module top level (never inside a component) so their state survives re-renders.
const HomePage = lazy(() => import("./pages/HomePage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const TicketDetailPage = lazy(() => import("./pages/TicketDetailPage"));
const MyTicketsPage = lazy(() => import("./pages/MyTicketsPage"));
const MyStatsPage = lazy(() => import("./pages/MyStatsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SlaPoliciesPage = lazy(() => import("./pages/SlaPoliciesPage"));
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
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger — body doesn't read it
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Only block on the very first load (no cached session yet). If we already
  // have a session, keep rendering even while a background revalidation is in
  // flight — otherwise the whole layout would unmount/remount on every
  // navigation, which reads as a page flicker.
  if (isPending && !session) return null;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <MobileTopbar onMenuClick={() => setMobileNavOpen(true)} />
      <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <div className="pt-14 md:pt-0 md:pl-64">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

function AdminLayout() {
  const { data: session, isPending } = useSession();

  // Same reasoning as ProtectedLayout: don't unmount on background revalidation.
  if (isPending && !session) return null;

  const role = (session?.user as Record<string, unknown>)?.role;
  if (role !== Role.admin) return <Navigate to="/" replace />;

  return <Outlet />;
}

export default function App() {
  useUnauthorizedRedirect();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/my-tickets" element={<MyTicketsPage />} />
        <Route path="/my-stats" element={<MyStatsPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/users" element={<UsersPage />} />
          <Route path="/sla-policies" element={<SlaPoliciesPage />} />
          <Route path="/activity" element={<ActivityPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
