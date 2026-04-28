import { useNavigate } from "react-router";
import { signOut } from "../lib/auth-client";

interface Props {
  name: string;
}

export default function Navbar({ name }: Props) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <span className="text-sm font-semibold text-gray-900">Helpdesk</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{name}</span>
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
