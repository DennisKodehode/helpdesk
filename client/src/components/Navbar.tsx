import { Link, useNavigate } from "react-router";
import { signOut, useSession } from "../lib/auth-client";

export default function Navbar() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const role = (session?.user as Record<string, unknown>)?.role;

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <span className="text-sm font-semibold text-gray-900">Helpdesk</span>
      <div className="flex items-center gap-4">
        {!isPending && role === "admin" && (
          <Link
            to="/users"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Users
          </Link>
        )}
        <span className="text-sm text-gray-600">{session?.user.name}</span>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
