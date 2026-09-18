import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  usePoFile,
  useSaveEntry,
  useLocalesDir,
  useProjectConfig,
  useProject,
} from "@/hooks/use-po-queries";
import { useProviders, useSettings, useTranslate } from "@/hooks/use-translate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function EntryEditor() {
  const { file, entry: selectedEntryId } = useSearch({
    from: "/",
  });
  const navigate = useNavigate({ from: "/" });
  const project = useProject();
  const localesDir = useLocalesDir(project?.path);

  const filePath = file && localesDir ? `${localesDir}/${file}` : null;
  const { data: poFile } = usePoFile(filePath);
  const saveEntry = useSaveEntry();

  const { data: config } = useProjectConfig(project?.path);
  const { data: providers = [] } = useProviders();
  const { data: settings } = useSettings();
  const translate = useTranslate();

  const entry = poFile?.entries.find((e) => e.id === selectedEntryId) ?? null;

  const [translation, setTranslation] = useState("");
  const [fuzzy, setFuzzy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setTranslation(entry.msgstr[0] ?? "");
      setFuzzy(entry.fuzzy);
      setIsDirty(false);
      setTranslateError(null);
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
    const entries = poFile?.entries ?? [];
    const idx = entries.findIndex((e) => e.id === entry.id);
    const next = entries.slice(idx + 1).find((e) => !e.translated);
    if (next) {
      navigate({ search: (prev) => ({ ...prev, entry: next.id }) });
    }
  };

  const handleGenerate = (providerId: string) => {
    if (!entry?.msgid || !config) return;
    const targetLang = file?.replace(/\.po$/, "") ?? "";
    setTranslateError(null);
    translate.mutate(
      {
        provider: providerId,
        text: entry.msgid,
        sourceLang: config.sourceLanguage,
        targetLang,
      },
      {
        onSuccess: (result) => {
          setTranslation(result);
          setFuzzy(true);
          setIsDirty(true);
        },
        onError: (err) => {
          setTranslateError(String(err));
        },
      },
    );
  };

  const configuredProviders = providers.filter((p) => p.hasKey);
  const defaultProviderId = settings?.defaultProvider ?? null;
  const defaultProvider = configuredProviders.find(
    (p) => p.id === defaultProviderId,
  );
  const otherProviders = configuredProviders.filter(
    (p) => p.id !== defaultProviderId,
  );

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
          {/* Generate button */}
          {configuredProviders.length > 0 && (
            <div className="flex items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleGenerate(defaultProviderId ?? configuredProviders[0].id)
                }
                disabled={translate.isPending}
                className="h-6 text-xs px-2.5"
              >
                {translate.isPending
                  ? "Generating…"
                  : `Generate${defaultProvider ? ` · ${defaultProvider.label}` : ""}`}
              </Button>
              {configuredProviders.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={translate.isPending}
                    className="h-6 w-6 inline-flex items-center justify-center border border-white/10 text-zinc-400 hover:bg-white/5 transition-colors disabled:opacity-50 rounded-l-none"
                  >
                    <ChevronDown size={10} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end">
                    {otherProviders.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => handleGenerate(p.id)}
                      >
                        Generate with {p.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

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

      {translateError && (
        <div className="px-4 py-1.5 text-[11px] text-red-400 bg-red-400/5 border-b border-red-400/10 shrink-0">
          {translateError}
        </div>
      )}

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
