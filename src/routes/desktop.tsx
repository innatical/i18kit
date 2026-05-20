import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isTauri } from "@/lib/tauri";

export const Route = createFileRoute("/desktop")({
  beforeLoad: () => {
    if (!isTauri()) {
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />,
});
