import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  usePoFile,
  usePoFileList,
  useAddProject,
  useLocalesDir,
} from "@/hooks/use-po-queries";
import { useAtomValue } from "jotai";
import { savedProjectsAtom } from "@/lib/atoms";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, FileText, BookTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectSwitcher } from "@/components/project-switcher";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="h-0.5 w-full bg-sidebar-border overflow-hidden">
      <div
        className={cn(
          "h-full transition-all",
          pct === 100 ? "bg-green-500" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function FileItem({ path, name }: { path: string; name: string }) {
  const { file } = useSearch({ from: "/$projectId" });
  const navigate = useNavigate({ from: "/$projectId" });
  const { data: poFile } = usePoFile(path);
  const isActive = file === name;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() =>
          navigate({
            search: (prev) => ({ ...prev, file: name, entry: undefined }),
          })
        }
        className="flex-col items-start gap-1 h-auto py-2"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 truncate">
            <FileText size={12} className="shrink-0" />
            {name}
          </span>
          {poFile && (
            <span className="text-[10px] tabular-nums shrink-0 text-sidebar-foreground/50">
              {poFile.stats.translated}/{poFile.stats.total}
            </span>
          )}
        </div>
        {poFile && (
          <ProgressBar
            value={poFile.stats.translated}
            max={poFile.stats.total}
          />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function PotFileItem({ path, name }: { path: string; name: string }) {
  const { file } = useSearch({ from: "/$projectId" });
  const navigate = useNavigate({ from: "/$projectId" });
  const { data: poFile } = usePoFile(path);
  const isActive = file === name;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() =>
          navigate({
            search: (prev) => ({ ...prev, file: name, entry: undefined }),
          })
        }
        className="flex-col items-start gap-1 h-auto py-2"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 truncate text-amber-400/80">
            <BookTemplate size={12} className="shrink-0" />
            {name}
          </span>
          {poFile && (
            <span className="text-[10px] tabular-nums shrink-0 text-sidebar-foreground/50">
              {poFile.stats.total} strings
            </span>
          )}
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function FileSidebar() {
  const { projectId } = useParams({ from: "/$projectId" });
  const projects = useAtomValue(savedProjectsAtom);
  const project = projects.find((p) => p.id === projectId);
  const localesDir = useLocalesDir(project?.path);
  const { data: files, isLoading } = usePoFileList(localesDir);
  const addProject = useAddProject();

  const potFiles = files?.filter((f) => f.isPot) ?? [];
  const poFiles = files?.filter((f) => !f.isPot) ?? [];

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="pb-2 pt-4 px-2">
          <img
            src="/i18kit/full/dark.svg"
            className="h-6 w-auto hidden dark:block"
          />
          <img
            src="/i18kit/full/light.svg"
            className="h-6 w-auto dark:hidden"
          />
        </div>

        <ProjectSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {isLoading && (
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 6 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <Skeleton className="h-8 w-full" />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {!project && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-sidebar-foreground/40">
            <FolderOpen size={32} />
            <p className="text-xs text-center">Open a folder with .po files</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addProject.mutate()}
            >
              Add Project
            </Button>
          </div>
        )}

        {potFiles.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Template</SidebarGroupLabel>
            <SidebarMenu>
              {potFiles.map((f) => (
                <PotFileItem key={f.path} path={f.path} name={f.name} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {poFiles.length > 0 && (
          <SidebarGroup>
            {potFiles.length > 0 && (
              <SidebarGroupLabel>Translations</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {poFiles.map((f) => (
                <FileItem key={f.path} path={f.path} name={f.name} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
    </>
  );
}
