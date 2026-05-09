import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { savedProjectsAtom } from "@/lib/atoms";
import { getDefaultStore } from "jotai";
import { useAddProject } from "@/hooks/use-po-queries";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const projects = getDefaultStore().get(savedProjectsAtom);
    if (projects.length > 0) {
      throw redirect({
        to: "/$projectId",
        params: { projectId: projects[0].id },
        search: {
          file: undefined,
          entry: undefined,
        },
      });
    }
  },
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const addProject = useAddProject((project) => {
    navigate({
      to: "/$projectId",
      params: { projectId: project.id },
      search: { file: undefined, entry: undefined },
    });
  });

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-7" />
      <FolderOpen className="size-8 text-zinc-700" />
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-300">No projects yet</p>
        <p className="text-xs text-zinc-600 mt-1">
          Open a folder containing .po files to get started
        </p>
      </div>
      <Button
        onClick={() => addProject.mutate()}
        disabled={addProject.isPending}
        size="lg"
      >
        <FolderOpen className="size-3.5" />
        {addProject.isPending ? "Opening…" : "Open folder"}
      </Button>
    </div>
  );
}
