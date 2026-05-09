import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { usePoFile, useSaveEntry } from "@/hooks/use-po-queries";
import { useAtomValue } from "jotai";
import { savedProjectsAtom } from "@/lib/atoms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function EntryEditor() {
  const { projectId } = useParams({ from: "/$projectId" });
  const { file, entry: selectedEntryId } = useSearch({ from: "/$projectId" });
  const navigate = useNavigate({ from: "/$projectId" });
  const projects = useAtomValue(savedProjectsAtom);
  const project = projects.find((p) => p.id === projectId);

  const filePath = file && project ? `${project.path}/${file}` : null;
  const { data: poFile } = usePoFile(filePath);
  const saveEntry = useSaveEntry();

  const entry = poFile?.entries.find((e) => e.id === selectedEntryId) ?? null;

  const [translation, setTranslation] = useState("");
  const [fuzzy, setFuzzy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (entry) {
      setTranslation(entry.msgstr[0] ?? "");
      setFuzzy(entry.fuzzy);
      setIsDirty(false);
    }
  }, [entry?.id, filePath]);

  const handleSave = () => {
    if (!filePath || !entry) return;
    saveEntry.mutate({
      path: filePath,
      entry: {
        ...entry,
        msgstr: [translation],
        fuzzy,
        flags: fuzzy
          ? [...entry.flags.filter((f) => f !== "fuzzy"), "fuzzy"]
          : entry.flags.filter((f) => f !== "fuzzy"),
      },
    });
    setIsDirty(false);
    if (fuzzy !== entry.fuzzy) return;
    // Auto-advance to next untranslated entry
    const entries = poFile?.entries ?? [];
    const idx = entries.findIndex((e) => e.id === entry.id);
    const next = entries.slice(idx + 1).find((e) => !e.translated);
    if (next) {
      navigate({ search: (prev) => ({ ...prev, entry: next.id }) });
    }
  };

  if (!entry) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-700 text-xs">
        Select an entry to edit
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          Editing
        </span>
        {entry.references.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span className="text-[10px] text-zinc-700 truncate">
              {entry.references.join(" ")}
            </span>
          </>
        )}
        {entry.msgctxt && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span className="text-[10px] text-zinc-600">
              ctx: {entry.msgctxt}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Label className="cursor-pointer text-zinc-400">
            <Checkbox
              checked={fuzzy}
              onCheckedChange={(checked) => {
                setFuzzy(!!checked);
                setIsDirty(true);
              }}
            />
            Fuzzy
          </Label>
          <Button
            size="sm"
            disabled={!isDirty || saveEntry.isPending}
            onClick={handleSave}
            className="h-6 text-xs px-3"
          >
            {saveEntry.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-white/5 flex-1 min-h-0 overflow-hidden">
        {/* Source */}
        <div className="p-3 flex flex-col gap-1 overflow-y-auto">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
            Source
          </span>
          <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
            {entry.msgid}
          </p>
          {entry.extractedComment && (
            <p className="text-[10px] text-zinc-600 mt-1">
              {entry.extractedComment}
            </p>
          )}
        </div>

        {/* Translation */}
        <div className="p-3 flex flex-col gap-1 min-h-0">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
            Translation
          </span>
          <textarea
            value={translation}
            onChange={(e) => {
              setTranslation(e.target.value);
              setIsDirty(true);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="Enter translation…"
            className={cn(
              "flex-1 min-h-20 w-full bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-zinc-200 resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-zinc-700",
              fuzzy && "border-yellow-400/30",
            )}
          />
        </div>
      </div>
    </div>
  );
}
