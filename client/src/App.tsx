import { Navigate, Outlet, Route, Routes } from "react-router";
import Navbar from "./components/Navbar";
import { useSession } from "./lib/auth-client";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";

function ProtectedLayout() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Outlet />
    </div>
  );
}

function AdminLayout() {
  const { data: session } = useSession();
  const role = (session?.user as Record<string, unknown>)?.role;

  if (role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route element={<AdminLayout />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
