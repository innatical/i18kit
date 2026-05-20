import {
  createFileRoute,
  useSearch,
  useParams,
  Link,
} from "@tanstack/react-router";
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
import { SetupWizard } from "@/components/setup-wizard";
import { Settings } from "lucide-react";
import { useAtomValue } from "jotai";
import { savedProjectsAtom } from "@/lib/atoms";
import { useProjectConfig } from "@/hooks/use-po-queries";

export const Route = createFileRoute("/desktop/$projectId")({
  validateSearch: (search: Record<string, unknown>) => ({
    file: typeof search.file === "string" ? search.file : undefined,
    entry: typeof search.entry === "string" ? search.entry : undefined,
  }),
  component: ProjectEditor,
});

function ProjectEditor() {
  const { projectId } = useParams({ from: "/desktop/$projectId" });
  const { file } = useSearch({ from: "/desktop/$projectId" });
  const projects = useAtomValue(savedProjectsAtom);
  const project = projects.find((p) => p.id === projectId);

  const { data: config, isPending: configLoading } = useProjectConfig(
    project?.path,
  );

  const isPot = file?.endsWith(".pot") ?? false;

  let content: React.ReactNode;

  if (!configLoading && config === null && project) {
    content = (
      <SetupWizard projectPath={project.path} projectName={project.name} />
    );
  } else if (isPot) {
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
        <div data-tauri-drag-region className="h-7 w-full shrink-0" />
        <FileSidebar />
        <div className="mt-auto p-2 border-t border-white/5">
          <Link
            to="/desktop/settings"
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
