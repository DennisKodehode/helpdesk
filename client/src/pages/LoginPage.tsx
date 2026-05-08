import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { signIn, useSession } from "../lib/auth-client";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isPending && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(data: { email: string; password: string }) {
    setServerError(null);
    const { error } = await signIn.email(data);
    if (error) {
      setServerError(error.message ?? "Invalid credentials");
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoginForm onSubmit={onSubmit} serverError={serverError} />
    </div>
  );
}
