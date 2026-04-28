import { Navigate, Outlet, Route, Routes } from "react-router";
import Navbar from "./components/Navbar";
import { useSession } from "./lib/auth-client";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

function ProtectedLayout() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar name={session.user.name} />
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
