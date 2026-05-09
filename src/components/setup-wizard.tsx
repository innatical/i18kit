import { useState } from "react";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInitializeProject } from "@/hooks/use-po-queries";
import type { ProjectConfig } from "@/lib/po";

type Props = {
  projectPath: string;
  projectName: string;
};

export function SetupWizard({ projectPath, projectName }: Props) {
  const [name, setName] = useState(projectName);
  const [localesDir, setLocalesDir] = useState("locales");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [localesInput, setLocalesInput] = useState("");

  const saveConfig = useInitializeProject(projectPath);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const locales = localesInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const config: ProjectConfig = {
      name: name.trim() || projectName,
      sourceLanguage: sourceLanguage.trim() || "en",
      locales,
      localesDir: localesDir.trim() || "locales",
      createdAt: new Date().toISOString(),
    };

    saveConfig.mutate(config);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <FileQuestion className="size-7 text-zinc-600" />
        <div>
          <p className="text-sm font-medium text-zinc-300">
            No .i18kit.json found
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Configure this project to get started
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs flex flex-col gap-3"
      >
        <Field label="Project name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={projectName}
            className="h-8 text-xs bg-white/5 border-white/10"
          />
        </Field>

        <Field label="Locales directory" hint="relative path">
          <Input
            value={localesDir}
            onChange={(e) => setLocalesDir(e.target.value)}
            placeholder="locales"
            className="h-8 text-xs bg-white/5 border-white/10 font-mono"
          />
        </Field>

        <Field label="Source language">
          <Input
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            placeholder="en"
            className="h-8 text-xs bg-white/5 border-white/10 font-mono"
          />
        </Field>

        <Field label="Locales" hint="comma-separated">
          <Input
            value={localesInput}
            onChange={(e) => setLocalesInput(e.target.value)}
            placeholder="es, fr, de"
            className="h-8 text-xs bg-white/5 border-white/10 font-mono"
          />
        </Field>

        <Button
          type="submit"
          size="sm"
          disabled={saveConfig.isPending}
          className="mt-1 w-full"
        >
          {saveConfig.isPending ? "Saving…" : "Save configuration"}
        </Button>

        {saveConfig.isError && (
          <p className="text-xs text-red-400 text-center">
            {saveConfig.error?.message ?? "Something went wrong"}
          </p>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
