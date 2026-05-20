import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Integration, type GitHubRepo } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useState, useMemo } from "react";
import { GitBranch, Trash2, ExternalLink, Search, Link2 } from "lucide-react";

export const Route = createFileRoute("/projects/$projectId/settings")({
  component: ProjectSettings,
});

function ProjectSettings() {
  const { projectId } = Route.useParams();
  const router = useRouter();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations", projectId],
    queryFn: () => api.integrations.list(projectId),
  });

  const deleteProject = useMutation({
    mutationFn: () => api.projects.delete(projectId),
    onSuccess: () => router.navigate({ to: "/projects" }),
  });

  const githubIntegration = integrations.find((i) => i.type === "github");

  return (
    <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground transition-colors">
          projects
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <Link
          to="/projects/$projectId"
          params={{ projectId }}
          className="hover:text-foreground transition-colors"
        >
          {project?.name ?? "…"}
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-foreground">settings</span>
      </div>

      {/* GitHub integration */}
      <section className="space-y-3">
        <div>
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-0.5">
            // integration
          </p>
          <h2 className="text-xs font-medium">github</h2>
        </div>
        {githubIntegration ? (
          <GitHubIntegrationCard integration={githubIntegration} projectId={projectId} />
        ) : (
          <ConnectGitHubForm projectId={projectId} />
        )}
      </section>

      {/* Danger zone */}
      {project?.role === "owner" && (
        <section className="space-y-3">
          <div>
            <p className="text-[10px] text-destructive/50 uppercase tracking-widest mb-0.5">
              // danger
            </p>
            <h2 className="text-xs font-medium text-destructive">danger zone</h2>
          </div>
          <div className="border border-destructive/20 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium">delete project</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                permanently deletes all translations and settings
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                  deleteProject.mutate();
                }
              }}
              disabled={deleteProject.isPending}
              className="flex items-center gap-1.5 h-7 px-3 border border-destructive/40 text-destructive text-[11px] font-medium hover:bg-destructive/10 disabled:opacity-40 transition-colors shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              {deleteProject.isPending ? "deleting…" : "delete"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function GitHubIntegrationCard({
  integration,
  projectId,
}: {
  integration: Integration;
  projectId: string;
}) {
  const qc = useQueryClient();
  const meta = integration.metadata as {
    repoOwner: string;
    repoName: string;
    branch: string;
    localesDir: string;
    installationId?: number;
  };

  const disconnect = useMutation({
    mutationFn: () => api.integrations.disconnect(projectId, "github"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", projectId] }),
  });

  return (
    <div className="border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-xs font-mono font-medium">
            {meta.repoOwner}/{meta.repoName}
          </span>
        </div>
        {meta.installationId ? (
          <span className="text-[10px] font-mono text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5">
            connected
          </span>
        ) : (
          <a
            href={integration.installUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 hover:bg-amber-500/20 transition-colors"
          >
            install app <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-1">branch</p>
          <p className="text-[11px] font-mono">{meta.branch}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-1">locales dir</p>
          <p className="text-[11px] font-mono">{meta.localesDir}</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-3">
        <button
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
          className="text-[11px] text-muted-foreground/60 hover:text-destructive transition-colors"
        >
          {disconnect.isPending ? "disconnecting…" : "disconnect"}
        </button>
      </div>
    </div>
  );
}

function ConnectGitHubForm({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [search, setSearch] = useState("");
  const [localesDir, setLocalesDir] = useState(".");
  const [linkError, setLinkError] = useState<string | null>(null);

  const { data: githubData, isLoading: reposLoading } = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => api.github.repos(),
    retry: false,
  });

  const connect = useMutation({
    mutationFn: () =>
      api.integrations.connectGitHub(projectId, {
        repoOwner: selectedRepo!.owner,
        repoName: selectedRepo!.name,
        branch: selectedRepo!.defaultBranch,
        localesDir,
      }),
    onSuccess: (data) => {
      if (data.installUrl) {
        window.location.href = data.installUrl;
      } else {
        qc.invalidateQueries({ queryKey: ["integrations", projectId] });
      }
    },
  });

  const filteredRepos = useMemo(() => {
    if (!githubData?.repos) return [];
    const q = search.toLowerCase();
    return githubData.repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [githubData?.repos, search]);

  async function linkGitHub() {
    setLinkError(null);
    const result = await authClient.linkSocial({
      provider: "github",
      callbackURL: window.location.href,
    });
    if (result.error) setLinkError(result.error.message ?? "Failed to connect GitHub");
  }

  if (reposLoading) {
    return (
      <div className="border border-border bg-card p-4">
        <div className="h-7 w-32 bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!githubData?.connected) {
    return (
      <div className="border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="text-xs font-medium">connect github repository</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          link your github account to browse and connect repositories
        </p>
        {linkError && (
          <p className="text-[11px] text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2">
            {linkError}
          </p>
        )}
        <button
          onClick={linkGitHub}
          className="flex items-center gap-1.5 h-7 px-3 bg-foreground text-background text-[11px] font-medium transition-opacity hover:opacity-80"
        >
          <Link2 className="w-3 h-3" />
          connect github account
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <GitBranch className="w-3.5 h-3.5 text-muted-foreground/50" />
        <span className="text-xs font-medium">connect github repository</span>
      </div>

      {!selectedRepo ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search repositories…"
              className="w-full h-7 border border-border bg-transparent pl-8 pr-3 text-[11px] font-mono focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/30"
            />
          </div>
          <div className="max-h-52 overflow-y-auto border border-border divide-y divide-border/50">
            {filteredRepos.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-muted-foreground/60 text-center">
                {search ? "// no matches" : "// no repositories found"}
              </p>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.fullName}
                  onClick={() => setSelectedRepo(repo)}
                  className="w-full text-left px-3 py-2 text-[11px] hover:bg-accent/40 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-mono truncate">{repo.fullName}</span>
                  {repo.private && (
                    <span className="shrink-0 text-muted-foreground/50 border border-border px-1.5 py-0.5 text-[10px]">
                      private
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono">{selectedRepo.fullName}</span>
              {selectedRepo.private && (
                <span className="text-muted-foreground/50 border border-border px-1.5 py-0.5 text-[10px]">
                  private
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedRepo(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              change
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">branch</p>
              <p className="h-7 flex items-center px-3 border border-border bg-muted/10 text-[11px] font-mono text-muted-foreground">
                {selectedRepo.defaultBranch}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                locales dir
              </label>
              <input
                value={localesDir}
                onChange={(e) => setLocalesDir(e.target.value)}
                placeholder="locales"
                className="w-full h-7 border border-border bg-transparent px-3 text-[11px] font-mono focus:outline-none focus:border-foreground/30 transition-colors placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          {connect.error && (
            <p className="text-[11px] text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2">
              {connect.error.message}
            </p>
          )}

          <button
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            className="flex items-center gap-1.5 h-7 px-3 bg-foreground text-background text-[11px] font-medium disabled:opacity-40 transition-opacity"
          >
            <GitBranch className="w-3 h-3" />
            {connect.isPending ? "connecting…" : "connect"}
          </button>
        </div>
      )}
    </div>
  );
}
