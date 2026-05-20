const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

export interface Project {
  id: string;
  name: string;
  sourceLanguage: string;
  lastSyncedAt: string | null;
  createdAt: string;
  role: "owner" | "contributor";
}

export interface Integration {
  id: string;
  projectId: string;
  type: "github" | "gitlab" | "linear";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  installUrl?: string;
}

export interface TranslationUnit {
  id: string;
  projectId: string;
  file: string;
  locale: string;
  msgid: string;
  msgctxt: string;
  baseMsgstr: string;
  webMsgstr: string;
  fuzzy: boolean;
  status: "clean" | "edited" | "conflict";
  updatedAt: string;
}

export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export const api = {
  github: {
    repos: () => apiFetch<{ connected: boolean; repos: GitHubRepo[] }>("/github/repos"),
  },

  projects: {
    list: () => apiFetch<Project[]>("/projects"),
    get: (id: string) => apiFetch<Project>(`/projects/${id}`),
    create: (body: { name: string; sourceLanguage?: string }) =>
      apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; sourceLanguage?: string }) =>
      apiFetch<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch<{ ok: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  },

  integrations: {
    list: (projectId: string) => apiFetch<Integration[]>(`/projects/${projectId}/integrations`),
    connectGitHub: (
      projectId: string,
      body: { repoOwner: string; repoName: string; branch?: string; localesDir?: string },
    ) =>
      apiFetch<Integration>(`/projects/${projectId}/integrations/github`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    disconnect: (projectId: string, type: string) =>
      apiFetch<{ ok: boolean }>(`/projects/${projectId}/integrations/${type}`, {
        method: "DELETE",
      }),
  },

  translations: {
    list: (projectId: string, params?: { locale?: string; file?: string; status?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][],
      ).toString();
      return apiFetch<TranslationUnit[]>(
        `/projects/${projectId}/translations${qs ? `?${qs}` : ""}`,
      );
    },
    update: (projectId: string, unitId: string, body: { msgstr: string; fuzzy?: boolean }) =>
      apiFetch<TranslationUnit>(`/projects/${projectId}/translations/${unitId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },

  sync: {
    pull: (projectId: string) =>
      apiFetch<{ ok: boolean; added: number; updated: number; conflicts: number }>(
        `/projects/${projectId}/pull`,
        { method: "POST" },
      ),
    push: (projectId: string) =>
      apiFetch<{ ok: boolean; prUrl: string; prNumber: number }>(
        `/projects/${projectId}/push`,
        { method: "POST" },
      ),
  },
};
