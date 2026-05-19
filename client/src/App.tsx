import { Role } from "@helpdesk/core";
import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import MobileTopbar from "./components/MobileTopbar";
import Sidebar from "./components/Sidebar";
import { useSession } from "./lib/auth-client";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MyStatsPage from "./pages/MyStatsPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import SlaPoliciesPage from "./pages/SlaPoliciesPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import TicketsPage from "./pages/TicketsPage";
import UsersPage from "./pages/UsersPage";

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
      <div className="pt-14 md:pt-0 md:pl-60 xl:pl-64 2xl:pl-72">
        <Outlet />
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
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/my-tickets" element={<MyTicketsPage />} />
        <Route path="/my-stats" element={<MyStatsPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/users" element={<UsersPage />} />
          <Route path="/sla-policies" element={<SlaPoliciesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
