import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useProviders,
  useSettings,
  useSaveSettings,
  useSaveApiKey,
  useDeleteApiKey,
  type ProviderInfo,
} from "@/hooks/use-translate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/desktop/settings")({
  component: SettingsPage,
});

function ProviderCard({
  provider,
  isDefault,
  onSetDefault,
}: {
  provider: ProviderInfo;
  isDefault: boolean;
  onSetDefault: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveKey = useSaveApiKey();
  const deleteKey = useDeleteApiKey();

  const handleSave = () => {
    if (!keyInput.trim()) return;
    setSaveError(null);
    saveKey.mutate(
      { provider: provider.id, key: keyInput.trim() },
      {
        onSuccess: () => {
          setKeyInput("");
          setEditing(false);
        },
        onError: (err) => {
          setSaveError(String(err));
          console.error("save_api_key failed:", err);
        },
      },
    );
  };

  const handleDelete = () => {
    deleteKey.mutate(provider.id);
  };

  return (
    <div className="flex flex-col gap-3 p-4 border border-white/8 bg-white/2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-zinc-200">
            {provider.label}
          </span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 font-medium",
              provider.hasKey
                ? "text-green-400 bg-green-400/10"
                : "text-zinc-600 bg-zinc-800",
            )}
          >
            {provider.hasKey ? "Configured" : "Not configured"}
          </span>
        </div>
        <button
          onClick={onSetDefault}
          className={cn(
            "flex items-center gap-1 text-[11px] transition-colors",
            isDefault ? "text-primary" : "text-zinc-600 hover:text-zinc-400",
          )}
        >
          {isDefault && <Check size={10} />}
          {isDefault ? "Default" : "Set as default"}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Paste API key…"
              className="flex-1 h-7 text-xs bg-white/5 border-white/10"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!keyInput.trim() || saveKey.isPending}
              className="h-7 text-xs px-3"
            >
              {saveKey.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setKeyInput("");
                setEditing(false);
                setSaveError(null);
              }}
              className="h-7 text-xs px-2"
            >
              Cancel
            </Button>
          </div>
          {saveError && <p className="text-[11px] text-red-400">{saveError}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="h-7 text-xs"
          >
            {provider.hasKey ? "Update key" : "Add key"}
          </Button>
          {provider.hasKey && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleteKey.isPending}
              className="h-7 text-xs text-zinc-600 hover:text-red-400"
            >
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const { data: providers = [] } = useProviders();
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();

  const defaultProvider = settings?.defaultProvider ?? null;

  const setDefault = (id: string) => {
    saveSettings.mutate({
      defaultProvider: id === defaultProvider ? null : id,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div data-tauri-drag-region className="h-7 w-full shrink-0" />
      <div className="max-w-xl mx-auto px-6 py-8 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <ArrowLeft size={12} />
            Back
          </Link>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold text-zinc-100">Settings</h1>
          <p className="text-xs text-zinc-600">
            API keys are stored in your system keychain — never written to disk
            as plain text.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wider text-zinc-600 font-medium">
            Translation Providers
          </h2>
          {providers.length === 0 ? (
            <div className="text-xs text-zinc-700 py-4">Loading…</div>
          ) : (
            <div className="flex flex-col gap-2">
              {providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  isDefault={p.id === defaultProvider}
                  onSetDefault={() => setDefault(p.id)}
                />
              ))}
            </div>
          )}
          {!defaultProvider && providers.some((p) => p.hasKey) && (
            <p className="text-[11px] text-yellow-500/70">
              Set a default provider to enable the Generate button in the
              editor.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
