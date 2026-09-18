// Local mode: the app is served by `i18kit open` and talks to it over /api.
// The CLI opens `/#code=<one-time code>`; we swap the code for a session token
// (kept in sessionStorage, sent as a bearer token) and strip it from the URL.

const TOKEN_KEY = "i18kit-session";

let token: string | null = sessionStorage.getItem(TOKEN_KEY);

export function isLocal(): boolean {
  return token !== null;
}

export async function initLocal(): Promise<void> {
  const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
  if (!code) return;

  history.replaceState(null, "", window.location.pathname + window.location.search);

  try {
    const res = await fetch("/api/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { token: string };
    token = body.token;
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Not served by the CLI (e.g. the hosted app); stay in web mode.
  }
}

export async function invoke<T = unknown>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`/api/${command}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: JSON.stringify(args),
  });

  if (res.status === 401) {
    throw new Error("Session expired. Run `i18kit open` again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}
