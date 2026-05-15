import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import Sidebar from "./components/Sidebar";
import MobileTopbar from "./components/MobileTopbar";
import { useSession } from "./lib/auth-client";
import { Role } from "@helpdesk/core";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import TicketsPage from "./pages/TicketsPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import UsersPage from "./pages/UsersPage";

function ProtectedLayout() {
  const { data: session, isPending } = useSession();
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (isPending) return null;
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

  if (isPending) return null;

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
        <Route element={<AdminLayout />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
