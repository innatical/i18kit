import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { isTauri } from "@/lib/tauri";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (isTauri()) throw redirect({ to: "/desktop" });
    const { data } = await authClient.getSession();
    throw redirect({ to: data?.session ? "/projects" : "/login" });
  },
  component: () => null,
});
