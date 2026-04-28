import { useSession } from "../lib/auth-client";

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Welcome, {session?.user.name}
      </h1>
    </main>
  );
}
