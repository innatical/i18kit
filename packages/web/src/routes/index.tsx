import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileSidebar } from "@/components/file-sidebar";
import { TranslationTable } from "@/components/translation-table";
import { EntryEditor } from "@/components/entry-editor";
import { PotViewer } from "@/components/pot-viewer";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { file?: string; entry?: string } => ({
    file: typeof search.file === "string" ? search.file : undefined,
    entry: typeof search.entry === "string" ? search.entry : undefined,
  }),
  component: ProjectEditor,
});

function ProjectEditor() {
  const { file } = useSearch({ from: "/" });

  const isPot = file?.endsWith(".pot") ?? false;

  let content: React.ReactNode;

  if (isPot) {
    content = <PotViewer />;
  } else {
    content = (
      <ResizablePanelGroup
        orientation="vertical"
        className="flex-col flex-1 min-h-0"
      >
        <ResizablePanel defaultSize={65} minSize={20} maxSize={80}>
          <TranslationTable />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={35} minSize={20} maxSize={80}>
          <EntryEditor />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <SidebarProvider className="h-screen overflow-hidden">
      <Sidebar collapsible="none" className="border-r border-sidebar-border">
        <FileSidebar />
        <div className="mt-auto p-2 border-t border-white/5">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <Settings size={12} />
            Settings
          </Link>
        </div>
      </Sidebar>
      <SidebarInset className="flex flex-col overflow-hidden h-screen">
        {content}
      </SidebarInset>
    </SidebarProvider>
  );
}
