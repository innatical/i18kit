import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type TranslationUnit } from "@/lib/api";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Settings, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
  });

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["translations", projectId, selectedLocale, selectedFile, statusFilter],
    queryFn: () =>
      api.translations.list(projectId, {
        locale: selectedLocale ?? undefined,
        file: selectedFile ?? undefined,
        status: statusFilter ?? undefined,
      }),
  });

  const locales = [...new Set(units.map((u) => u.locale))].sort();
  const files = [...new Set(units.map((u) => u.file))].sort();
  const conflicts = units.filter((u) => u.status === "conflict").length;
  const edited = units.filter((u) => u.status === "edited").length;

  const updateUnit = useMutation({
    mutationFn: ({ id, msgstr }: { id: string; msgstr: string }) =>
      api.translations.update(projectId, id, { msgstr }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["translations", projectId] }),
  });

  const pull = useMutation({
    mutationFn: () => api.sync.pull(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["translations", projectId] }),
  });

  const push = useMutation({
    mutationFn: () => api.sync.push(projectId),
    onSuccess: (data) => window.open(data.prUrl, "_blank"),
  });

  function startEdit(unit: TranslationUnit) {
    setEditingId(unit.id);
    setDraft(unit.webMsgstr);
  }

  function commitEdit(unit: TranslationUnit) {
    if (draft !== unit.webMsgstr) updateUnit.mutate({ id: unit.id, msgstr: draft });
    setEditingId(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center justify-between px-4 gap-4 shrink-0 bg-background/90 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Link to="/projects" className="hover:text-foreground transition-colors">
            projects
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-foreground font-medium">{project?.name ?? "…"}</span>
        </div>

        <div className="flex items-center gap-2">
          {conflicts > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-500">
              <AlertTriangle className="w-3 h-3" />
              {conflicts} conflict{conflicts > 1 ? "s" : ""}
            </span>
          )}
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId }}
            className="flex items-center justify-center w-7 h-7 border border-transparent hover:border-border transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </Link>
          <button
            onClick={() => pull.mutate()}
            disabled={pull.isPending}
            className="flex items-center gap-1.5 h-7 px-2.5 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-40 transition-colors"
          >
            <ArrowDownToLine className="w-3 h-3" />
            {pull.isPending ? "pulling…" : "pull"}
          </button>
          <button
            onClick={() => push.mutate()}
            disabled={push.isPending || edited === 0}
            className="flex items-center gap-1.5 h-7 px-2.5 bg-foreground text-background text-[11px] font-medium disabled:opacity-40 transition-opacity"
          >
            <ArrowUpFromLine className="w-3 h-3" />
            {push.isPending ? "pushing…" : `push${edited > 0 ? ` (${edited})` : ""}`}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-44 border-r border-border flex flex-col shrink-0 overflow-y-auto">
          {/* Status filter */}
          <div className="py-3 space-y-px">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest px-3 pb-2">
              status
            </p>
            {([null, "edited", "conflict"] as const).map((s) => (
              <button
                key={s ?? "all"}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "w-full text-left text-[11px] px-3 py-1.5 transition-colors flex items-center gap-2",
                  statusFilter === s
                    ? "text-foreground bg-accent/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    s === null
                      ? "bg-muted-foreground/40"
                      : s === "edited"
                        ? "bg-blue-500"
                        : "bg-amber-500",
                  )}
                />
                {s === null ? "all" : s}
              </button>
            ))}
          </div>

          {/* Locale filter */}
          {locales.length > 0 && (
            <div className="py-3 space-y-px border-t border-border">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest px-3 pb-2">
                locale
              </p>
              {[null, ...locales].map((l) => (
                <button
                  key={l ?? "all"}
                  onClick={() => setSelectedLocale(l)}
                  className={cn(
                    "w-full text-left text-[11px] px-3 py-1.5 font-mono transition-colors",
                    selectedLocale === l
                      ? "text-foreground bg-accent/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                  )}
                >
                  {l ?? "all"}
                </button>
              ))}
            </div>
          )}

          {/* File filter */}
          {files.length > 0 && (
            <div className="py-3 space-y-px border-t border-border">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest px-3 pb-2">
                file
              </p>
              {[null, ...files].map((f) => (
                <button
                  key={f ?? "all"}
                  onClick={() => setSelectedFile(f)}
                  className={cn(
                    "w-full text-left text-[11px] px-3 py-1.5 font-mono transition-colors truncate",
                    selectedFile === f
                      ? "text-foreground bg-accent/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                  )}
                  title={f ?? undefined}
                >
                  {f ? f.split("/").pop() : "all"}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Translation table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-6 space-y-px">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : units.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-1">
                <p className="text-[10px] text-muted-foreground/50">// no translations</p>
                <p className="text-[11px] text-muted-foreground">pull from github to load</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border">
                <tr>
                  <th className="text-left text-[10px] text-muted-foreground/40 uppercase tracking-widest px-3 py-2 w-6" />
                  <th className="text-left text-[10px] text-muted-foreground/40 uppercase tracking-widest px-3 py-2">
                    source
                  </th>
                  <th className="text-left text-[10px] text-muted-foreground/40 uppercase tracking-widest px-3 py-2">
                    translation
                  </th>
                  <th className="text-left text-[10px] text-muted-foreground/40 uppercase tracking-widest px-3 py-2 w-16">
                    locale
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {units.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    editing={editingId === unit.id}
                    draft={draft}
                    onDraftChange={setDraft}
                    onStartEdit={() => startEdit(unit)}
                    onCommit={() => commitEdit(unit)}
                    onCancel={() => setEditingId(null)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function UnitRow({
  unit,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  unit: TranslationUnit;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <tr
      className={cn(
        "group hover:bg-accent/20 transition-colors",
        unit.status === "conflict" && "bg-amber-500/5",
      )}
    >
      <td className="px-3 py-2.5 w-6">
        {unit.status === "conflict" && (
          <AlertTriangle className="w-3 h-3 text-amber-500" />
        )}
        {unit.status === "edited" && (
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto" />
        )}
      </td>
      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground/50 max-w-xs">
        <span className="truncate block">{unit.msgid}</span>
      </td>
      <td className="px-3 py-2.5">
        {editing ? (
          <div className="flex gap-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onCommit();
                }
                if (e.key === "Escape") onCancel();
              }}
              rows={2}
              className="flex-1 border border-border bg-background px-2 py-1.5 text-[11px] font-mono resize-none focus:outline-none focus:border-foreground/30 transition-colors"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={onCommit}
                className="h-6 px-2 text-[11px] bg-foreground text-background hover:opacity-80 transition-opacity"
              >
                save
              </button>
              <button
                onClick={onCancel}
                className="h-6 px-2 text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                esc
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onStartEdit}
            className={cn(
              "w-full text-left font-mono text-[11px] px-2 py-1 hover:bg-accent/50 transition-colors",
              !unit.webMsgstr && "text-muted-foreground/30 italic",
            )}
          >
            {unit.webMsgstr || "—"}
          </button>
        )}

        {unit.status === "conflict" && !editing && (
          <p className="text-[10px] text-muted-foreground/50 mt-1 px-2">
            base: <span className="font-mono">{unit.baseMsgstr || "—"}</span>
          </p>
        )}
      </td>
      <td className="px-3 py-2.5 text-[11px] font-mono text-muted-foreground/50">{unit.locale}</td>
    </tr>
  );
}
