import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "https://api.i18kit.com",
  basePath: "/auth",
  plugins: [passkeyClient()],
});

export const { useSession, signOut } = authClient;
