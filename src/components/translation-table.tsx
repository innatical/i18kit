import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { usePoFile } from "@/hooks/use-po-queries";
import { useAtom, useAtomValue } from "jotai";
import { savedProjectsAtom, searchQueryAtom, filterAtom } from "@/lib/atoms";
import { Input } from "@/components/ui/input";
import { type PoEntry } from "@/lib/po";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type Filter = "all" | "translated" | "untranslated" | "fuzzy";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "untranslated", label: "Untranslated" },
  { value: "fuzzy", label: "Fuzzy" },
  { value: "translated", label: "Translated" },
];

function StatusDot({ entry }: { entry: PoEntry }) {
  if (entry.fuzzy) return <span className="size-1.5 bg-yellow-400 shrink-0" />;
  if (entry.translated)
    return <span className="size-1.5 bg-green-500 shrink-0" />;
  return <span className="size-1.5 bg-zinc-600 shrink-0" />;
}

function EntryRow({
  entry,
  isSelected,
  onClick,
}: {
  entry: PoEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-white/5 transition-colors hover:bg-white/5 min-w-0",
        isSelected && "bg-white/10 hover:bg-white/10",
      )}
    >
      <StatusDot entry={entry} />
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-xs",
          !entry.translated && !entry.fuzzy ? "text-zinc-500" : "text-zinc-200",
        )}
      >
        {entry.msgid || <em className="text-zinc-600">empty</em>}
      </span>
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-xs",
          entry.fuzzy
            ? "text-yellow-400/70"
            : entry.translated
              ? "text-zinc-400"
              : "text-zinc-700",
        )}
      >
        {entry.msgstr[0] || <em className="text-zinc-700">not translated</em>}
      </span>
    </button>
  );
}

export function TranslationTable() {
  const { projectId } = useParams({ from: "/$projectId" });
  const { file, entry: selectedEntryId } = useSearch({ from: "/$projectId" });
  const navigate = useNavigate({ from: "/$projectId" });
  const projects = useAtomValue(savedProjectsAtom);
  const project = projects.find((p) => p.id === projectId);
  const [q, setQ] = useAtom(searchQueryAtom);
  const [filter, setFilter] = useAtom(filterAtom);

  const filePath = file && project ? `${project.path}/${file}` : null;
  const { data: poFile, isLoading } = usePoFile(filePath);

  const entries = poFile?.entries ?? [];

  const filtered = entries.filter((e) => {
    if (filter === "translated" && !e.translated) return false;
    if (filter === "untranslated" && (e.translated || e.fuzzy)) return false;
    if (filter === "fuzzy" && !e.fuzzy) return false;
    if (q) {
      const lower = q.toLowerCase();
      return (
        e.msgid.toLowerCase().includes(lower) ||
        e.msgstr.some((s) => s.toLowerCase().includes(lower))
      );
    }
    return true;
  });

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600">
        <p className="text-sm">Select a file to start translating</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 shrink-0">
        <div className="relative flex-1 max-w-sm">
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

        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-2.5 py-1 text-[11px] transition-colors",
                filter === f.value
                  ? "bg-white/15 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] text-zinc-600 tabular-nums">
          {filtered.length} / {entries.length}
        </span>
      </div>

      {/* Stats bar */}
      {poFile && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-b border-white/5 shrink-0 bg-black/20">
          <span className="text-[10px] text-green-500">
            ✓ {poFile.stats.translated} translated
          </span>
          <span className="text-[10px] text-yellow-400">
            ~ {poFile.stats.fuzzy} fuzzy
          </span>
          <span className="text-[10px] text-zinc-600">
            ○ {poFile.stats.untranslated} untranslated
          </span>
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-white/10 shrink-0">
        <span className="size-1.5 shrink-0" />
        <span className="flex-1 min-w-0 text-[10px] uppercase tracking-wider text-zinc-600">
          Source
        </span>
        <span className="flex-1 min-w-0 text-[10px] uppercase tracking-wider text-zinc-600">
          Translation
        </span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-xs">
            Loading…
          </div>
        )}
        {filtered.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            isSelected={selectedEntryId === e.id}
            onClick={() =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  entry: selectedEntryId === e.id ? undefined : e.id,
                }),
              })
            }
          />
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-xs">
            No entries match
          </div>
        )}
      </div>
    </div>
  );
}
