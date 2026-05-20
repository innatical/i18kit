import { useParams, useSearch } from "@tanstack/react-router";
import {
  usePoFile,
  usePoFileList,
  useProjectConfig,
  useSaveProjectConfig,
  useLocaleStatuses,
  useSyncLocale,
} from "@/hooks/use-po-queries";
import { useAtom, useAtomValue } from "jotai";
import { savedProjectsAtom, searchQueryAtom } from "@/lib/atoms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type PoEntry } from "@/lib/po";
import {
  BookTemplate,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

function SourceRow({ entry }: { entry: PoEntry }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2.5 border-b border-white/5">
      <span className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {entry.msgid || <em className="text-zinc-600">empty</em>}
      </span>
      {entry.extractedComment && (
        <span className="text-[10px] text-zinc-600">
          {entry.extractedComment}
        </span>
      )}
      {entry.references.length > 0 && (
        <span className="text-[10px] text-zinc-700">
          {entry.references.join(" ")}
        </span>
      )}
    </div>
  );
}

function LocaleRow({
  locale,
  exists,
  onSync,
  isSyncing,
}: {
  locale: string;
  exists: boolean;
  onSync: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 group">
      {exists ? (
        <CheckCircle2 size={13} className="text-green-500 shrink-0" />
      ) : (
        <Circle size={13} className="text-zinc-600 shrink-0" />
      )}
      <span className="flex-1 text-xs text-zinc-300 font-mono">{locale}</span>
      <button
        onClick={onSync}
        disabled={isSyncing}
        title={exists ? "Sync new strings from template" : "Generate .po file"}
        className={cn(
          "flex items-center gap-1 text-[10px] px-2 py-0.5 transition-colors disabled:opacity-50",
          exists
            ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 opacity-0 group-hover:opacity-100"
            : "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10",
        )}
      >
        {isSyncing ? (
          <Loader2 size={10} className="animate-spin" />
        ) : exists ? (
          <RefreshCw size={10} />
        ) : (
          <Plus size={10} />
        )}
        {exists ? "Sync" : "Generate"}
      </button>
    </div>
  );
}

export function PotViewer() {
  const { projectId } = useParams({ from: "/desktop/$projectId" });
  const { file } = useSearch({ from: "/desktop/$projectId" });
  const projects = useAtomValue(savedProjectsAtom);
  const project = projects.find((p) => p.id === projectId);
  const [q, setQ] = useAtom(searchQueryAtom);
  const [newLocale, setNewLocale] = useState("");
  const [syncingLocale, setSyncingLocale] = useState<string | null>(null);

  const { data: config } = useProjectConfig(project?.path);
  const saveConfig = useSaveProjectConfig(project?.path);
  const rel = config?.localesDir;
  const localesDir = project
    ? !rel || rel === "."
      ? project.path
      : `${project.path}/${rel}`
    : null;
  const filePath = file && localesDir ? `${localesDir}/${file}` : null;
  const { data: poFile, isLoading } = usePoFile(filePath);
  const locales = config?.locales ?? [];
  const { data: localeStatuses } = useLocaleStatuses(localesDir, locales);
  const syncLocale = useSyncLocale(localesDir, filePath);
  const { data: allFiles } = usePoFileList(localesDir);
  const untrackedLocales = (allFiles ?? [])
    .filter((f) => !f.isPot)
    .map((f) => f.name.replace(/\.po$/, ""))
    .filter((locale) => !locales.includes(locale));

  const entries = poFile?.entries ?? [];
  const filtered = q
    ? entries.filter((e) => e.msgid.toLowerCase().includes(q.toLowerCase()))
    : entries;

  const handleTrackLocale = (locale: string) => {
    const base = config ?? {
      name: project?.name ?? "",
      sourceLanguage: "en",
      locales: [],
      localesDir: rel ?? ".",
      createdAt: new Date().toISOString(),
    };
    saveConfig.mutate({ ...base, locales: [...locales, locale] });
  };

  const handleAddLocale = () => {
    const trimmed = newLocale.trim().toLowerCase();
    if (!trimmed || locales.includes(trimmed)) return;
    const base = config ?? {
      name: project?.name ?? "",
      sourceLanguage: "en",
      locales: [],
      localesDir: rel ?? ".",
      createdAt: new Date().toISOString(),
    };
    saveConfig.mutate({ ...base, locales: [...locales, trimmed] });
    setNewLocale("");
  };

  const handleSync = async (locale: string) => {
    setSyncingLocale(locale);
    try {
      await syncLocale.mutateAsync(locale);
    } finally {
      setSyncingLocale(null);
    }
  };

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600">
        <p className="text-sm">Select a file to view</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Source strings */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-white/5">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 shrink-0">
          <BookTemplate size={12} className="text-amber-400/70 shrink-0" />
          <span className="text-[11px] text-amber-400/70 font-medium">
            Template — read only
          </span>
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search strings…"
              className="pl-7 h-7 text-xs bg-white/5 border-white/10"
            />
          </div>
          <span className="text-[11px] text-zinc-600 tabular-nums">
            {filtered.length} / {entries.length}
          </span>
        </div>

        <div className="flex items-center px-4 py-1.5 border-b border-white/10 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            Source string
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-20 text-zinc-600 text-xs">
              Loading…
            </div>
          )}
          {filtered.map((e) => (
            <SourceRow key={e.id} entry={e} />
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="flex items-center justify-center h-20 text-zinc-600 text-xs">
              No entries match
            </div>
          )}
        </div>
      </div>

      {/* Locale management */}
      <div className="flex flex-col w-56 shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
          <span className="text-[11px] font-medium text-zinc-400">Locales</span>
          <span className="ml-auto text-[10px] text-zinc-600 tabular-nums">
            {locales.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {locales.length === 0 && (
            <div className="flex items-center justify-center h-16 px-3 text-center">
              <p className="text-[11px] text-zinc-600">
                Add locales to generate .po files
              </p>
            </div>
          )}
          {(
            localeStatuses ??
            locales.map((l) => ({ locale: l, exists: false, path: "" }))
          ).map((s) => (
            <LocaleRow
              key={s.locale}
              locale={s.locale}
              exists={s.exists}
              onSync={() => handleSync(s.locale)}
              isSyncing={syncingLocale === s.locale}
            />
          ))}
        </div>

        {/* Untracked .po files */}
        {untrackedLocales.length > 0 && (
          <div className="border-t border-white/10 shrink-0">
            <div className="px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                Existing files
              </span>
            </div>
            {untrackedLocales.map((locale) => (
              <div
                key={locale}
                className="flex items-center gap-2 px-3 py-2 border-b border-white/5"
              >
                <span className="flex-1 text-xs text-zinc-500 font-mono">
                  {locale}.po
                </span>
                <button
                  onClick={() => handleTrackLocale(locale)}
                  disabled={saveConfig.isPending}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <Plus size={10} />
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add locale */}
        <div className="flex items-center gap-1.5 p-2 border-t border-white/10 shrink-0">
          <Input
            value={newLocale}
            onChange={(e) => setNewLocale(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddLocale()}
            placeholder="e.g. fr, de, ja"
            className="h-7 text-xs bg-white/5 border-white/10 font-mono"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={!newLocale.trim() || saveConfig.isPending}
            onClick={handleAddLocale}
            className="h-7 w-7 p-0 shrink-0"
          >
            <Plus size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
