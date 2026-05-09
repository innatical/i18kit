import { ChevronsUpDown, FolderOpen, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAddProject, useRemoveProject } from "@/hooks/use-po-queries";
import { useAtomValue } from "jotai";
import { savedProjectsAtom } from "@/lib/atoms";
import { useNavigate, useParams } from "@tanstack/react-router";

export function ProjectSwitcher() {
  const { isMobile } = useSidebar();
  const projects = useAtomValue(savedProjectsAtom);
  const { projectId } = useParams({ from: "/$projectId" });
  const navigate = useNavigate();

  const activeProject = projects.find((p) => p.id === projectId) ?? null;

  const removeProject = useRemoveProject((removedId) => {
    if (removedId === projectId) {
      const next = projects.find((p) => p.id !== removedId);
      if (next) {
        navigate({ to: "/$projectId", params: { projectId: next.id }, search: { file: undefined, entry: undefined } });
      } else {
        navigate({ to: "/" });
      }
    }
  });

  const addProject = useAddProject((project) => {
    navigate({ to: "/$projectId", params: { projectId: project.id }, search: { file: undefined, entry: undefined } });
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
                  <FolderOpen className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {activeProject?.name ?? "No project"}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/50">
                    {activeProject?.path ?? "Open a folder to start"}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Projects
              </DropdownMenuLabel>
              {projects.map((project, index) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() =>
                    navigate({
                      to: "/$projectId",
                      params: { projectId: project.id },
                      search: {
                        entry: undefined,
                        file: undefined,
                      },
                    })
                  }
                  className="gap-2 p-2 group/item"
                >
                  <div className="flex size-6 items-center justify-center border">
                    <FolderOpen className="size-3.5 shrink-0" />
                  </div>
                  <span className="flex-1 truncate">{project.name}</span>
                  {index < 9 && (
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProject(project.id);
                    }}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:text-destructive transition-all"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </DropdownMenuItem>
              ))}
              {projects.length === 0 && (
                <DropdownMenuItem
                  disabled
                  className="text-xs text-muted-foreground"
                >
                  No projects yet
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => addProject.mutate()}
            >
              <div className="flex size-6 items-center justify-center border bg-transparent">
                <Plus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">
                Add project
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
