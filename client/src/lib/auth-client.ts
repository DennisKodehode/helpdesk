import { createAuthClient } from "better-auth/react";

const baseURL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : undefined);

export const authClient = createAuthClient({ baseURL });

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
