import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Project } from "@/lib/api";
import { useState } from "react";
import { formatDistanceToNow } from "@/lib/utils";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/projects/")({
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.list(),
  });

  const createProject = useMutation({
    mutationFn: () => api.projects.create({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCreating(false);
      setName("");
    },
  });

  return (
    <div className="max-w-3xl mx-auto w-full px-6 py-10 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground/50 mb-0.5">// workspace</p>
          <h1 className="text-sm font-medium">projects</h1>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 h-7 px-3 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          new project
        </button>
      </div>

      {creating && (
        <div className="border border-border bg-card">
          <div className="flex border-b border-border">
            <div className="h-8 px-3 flex items-center text-[11px] font-medium border-r border-border">
              new project
            </div>
            <div className="flex-1" />
            <button
              onClick={() => { setCreating(false); setName(""); }}
              className="h-8 px-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              esc
            </button>
          </div>
          <div className="p-4 space-y-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createProject.mutate();
                if (e.key === "Escape") { setCreating(false); setName(""); }
              }}
              placeholder="project-name"
              className="w-full h-7 border border-border bg-transparent px-3 text-[11px] font-mono focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/30"
            />
            <div className="flex gap-2">
              <button
                onClick={() => createProject.mutate()}
                disabled={!name.trim() || createProject.isPending}
                className="h-7 px-3 bg-foreground text-background text-[11px] font-medium disabled:opacity-40 transition-opacity"
              >
                {createProject.isPending ? "creating…" : "create"}
              </button>
              <button
                onClick={() => { setCreating(false); setName(""); }}
                className="h-7 px-3 border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <p className="text-[10px] text-muted-foreground/50 mb-1">// no projects yet</p>
          <p className="text-[11px] text-muted-foreground">create one to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="group block border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
    >
      <div className="flex items-start justify-between mb-2.5">
        <p className="text-xs font-medium leading-none">{project.name}</p>
        <span className="text-[10px] font-mono text-muted-foreground/60 border border-border px-1.5 py-0.5 leading-none">
          {project.role}
        </span>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground/50 mb-3">
        src: {project.sourceLanguage}
      </p>
      <p className="text-[10px] text-muted-foreground/50">
        {project.lastSyncedAt
          ? `// synced ${formatDistanceToNow(new Date(project.lastSyncedAt))}`
          : "// never synced"}
      </p>
    </Link>
  );
}
