import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { isTauri } from "@/lib/tauri";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fingerprint, KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (isTauri()) throw redirect({ to: "/desktop" });
    const { data } = await authClient.getSession();
    if (data?.session) throw redirect({ to: "/projects" });
  },
  component: LoginPage,
});

type Tab = "signin" | "register";

function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative w-full max-w-xs">
        {/* Wordmark */}
        <div className="mb-8">
          <p className="text-xs text-muted-foreground mb-1">// i18kit</p>
          <h1 className="text-sm font-medium text-foreground">Translation platform</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex border border-border mb-0">
          <TabButton active={tab === "signin"} onClick={() => setTab("signin")}>
            Sign in
          </TabButton>
          <TabButton active={tab === "register"} onClick={() => setTab("register")}>
            Register
          </TabButton>
        </div>

        {/* Panel */}
        <div className="border border-t-0 border-border p-5 bg-card">
          {tab === "signin" ? (
            <SignInPanel onSuccess={() => router.navigate({ to: "/projects" })} />
          ) : (
            <RegisterPanel onSuccess={() => router.navigate({ to: "/projects" })} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-8 text-xs font-medium transition-colors border-b-0 ${
        active
          ? "bg-card text-foreground border-b border-card -mb-px z-10"
          : "bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SignInPanel({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasskey() {
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.passkey();
    if (error) {
      setError(error.message ?? "Passkey sign-in failed.");
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Use a saved passkey to authenticate.
      </p>

      <Button
        onClick={handlePasskey}
        disabled={loading}
        className="w-full gap-2"
        size="lg"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Fingerprint className="size-3.5" />
        )}
        {loading ? "Waiting for passkey…" : "Sign in with passkey"}
      </Button>

      {error && (
        <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

function RegisterPanel({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "passkey">("form");
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((f) => ({ ...f, [key]: e.target.value }));
        setError(null);
      },
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signUpError } = await authClient.signUp.email({
      name: form.name,
      email: form.email,
      password: crypto.randomUUID(),
    });

    if (signUpError) {
      setError(signUpError.message ?? "Registration failed.");
      setLoading(false);
      return;
    }

    setStep("passkey");

    const { error: passkeyError } = await authClient.passkey.addPasskey({
      name: `${form.name}'s passkey`,
    });

    if (passkeyError) {
      setError(passkeyError.message ?? "Failed to register passkey.");
      setLoading(false);
      setStep("form");
      return;
    }

    onSuccess();
  }

  if (step === "passkey") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin shrink-0" />
          Registering your passkey…
        </div>
        <p className="text-xs text-muted-foreground">
          Follow your browser or device prompt to save a passkey for future sign-ins.
        </p>
        {error && (
          <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input {...field("name")} placeholder="Ada Lovelace" autoComplete="name" />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Email</label>
        <Input
          {...field("email")}
          type="email"
          placeholder="ada@example.com"
          autoComplete="email"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full gap-2" size="lg">
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <KeyRound className="size-3.5" />
        )}
        {loading ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-xs text-muted-foreground">
        You'll be prompted to save a passkey after account creation.
      </p>
    </form>
  );
}
