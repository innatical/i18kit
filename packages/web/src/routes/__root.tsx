import useTheme from "@/hooks/use-theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isLocal } from "@/lib/local";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 30, retry: false },
  },
});

// The UI only works when served by `i18kit open`, which hands the page a
// one-time code. Without a session there is nothing to talk to.
const NotConnected = () => (
  <div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
    <p className="text-sm font-medium text-zinc-300">Not connected</p>
    <p className="text-xs text-zinc-600">
      Run <code>i18kit open</code> in your project to start a session.
    </p>
  </div>
);

const RootLayout = () => {
  useTheme();
  if (!isLocal()) return <NotConnected />;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export const Route = createRootRoute({ component: RootLayout });
