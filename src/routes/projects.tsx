import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient, signOut, useSession } from "@/lib/auth-client";
import { isTauri } from "@/lib/tauri";
import { Link, useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/projects")({
  beforeLoad: async () => {
    if (isTauri()) throw redirect({ to: "/desktop" });
    const { data } = await authClient.getSession();
    if (!data?.session) throw redirect({ to: "/login" });
  },
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const { data: session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/login" });
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <header className="h-10 border-b border-border flex items-center justify-between px-4 shrink-0 relative z-10 bg-background/90 backdrop-blur-sm">
        <Link to="/projects" className="text-xs font-medium">
          <span className="text-muted-foreground/50">// </span>i18kit
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-muted-foreground/60 truncate max-w-48">
            {session?.user.email}
          </span>
          <button
            onClick={handleSignOut}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            sign out
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
