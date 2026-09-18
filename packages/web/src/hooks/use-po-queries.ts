import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@/lib/local";
import {
  applyEntryUpdate,
  parsePoContent,
  syncPoFromPot,
  type PoEntry,
  type ProjectConfig,
} from "@/lib/po";

async function readTextFile(path: string): Promise<string> {
  return invoke("read_text_file", { path });
}

async function writeTextFile(path: string, content: string): Promise<void> {
  return invoke("write_text_file", { path, content });
}

async function readDir(
  path: string,
): Promise<{ name: string; isFile: boolean }[]> {
  return invoke("read_dir", { path });
}

async function exists(path: string): Promise<boolean> {
  return invoke("file_exists", { path });
}

const CONFIG_FILENAME = ".i18kit.json";

// The project is whatever directory `i18kit open` was run in. The server
// scopes all file access to it, so paths here are relative to that root.
const PROJECT_ROOT = ".";

export function useProject(): { path: string; name: string } | null {
  const { data } = useQuery({
    queryKey: ["project"],
    queryFn: () => invoke<{ name: string }>("project_info"),
    staleTime: Infinity,
  });
  return data ? { path: PROJECT_ROOT, name: data.name } : null;
}

export function usePoFileList(folder: string | null) {
  return useQuery({
    queryKey: ["po-files", folder],
    queryFn: async () => {
      if (!folder) return [];
      const entries = await readDir(folder);
      return entries
        .filter(
          (e) =>
            e.isFile && (e.name?.endsWith(".po") || e.name?.endsWith(".pot")),
        )
        .map((e) => ({
          name: e.name!,
          path: `${folder}/${e.name}`,
          isPot: e.name!.endsWith(".pot"),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!folder,
  });
}

export function usePoFile(path: string | null | undefined) {
  return useQuery({
    queryKey: ["po-file", path],
    queryFn: async () => {
      if (!path) return null;
      const content = await readTextFile(path);
      return parsePoContent(path, content);
    },
    enabled: !!path,
  });
}

export function useSaveEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      path,
      entry,
    }: {
      path: string;
      entry: Pick<PoEntry, "msgid" | "msgctxt" | "msgstr" | "fuzzy" | "flags">;
    }) => {
      const content = await readTextFile(path);
      const updated = applyEntryUpdate(content, entry);
      await writeTextFile(path, updated);
    },
    onSuccess: (_, { path }) => {
      queryClient.invalidateQueries({ queryKey: ["po-file", path] });
    },
  });
}

export function useLocalesDir(projectPath: string | null | undefined): string | null {
  const { data: config, isPending } = useProjectConfig(projectPath);
  if (!projectPath) return null;
  if (isPending) return null;
  const rel = config?.localesDir;
  if (!rel || rel === ".") return projectPath;
  return `${projectPath}/${rel}`;
}

export function useProjectConfig(folder: string | null | undefined) {
  return useQuery({
    queryKey: ["project-config", folder],
    queryFn: async (): Promise<ProjectConfig | null> => {
      if (!folder) return null;
      const configPath = `${folder}/${CONFIG_FILENAME}`;
      const fileExists = await exists(configPath);
      if (!fileExists) return null;
      const content = await readTextFile(configPath);
      const parsed = JSON.parse(content) as ProjectConfig;
      return parsed;
    },
    enabled: !!folder,
  });
}

export function useLocaleStatuses(
  folder: string | null | undefined,
  locales: string[],
) {
  return useQuery({
    queryKey: ["locale-statuses", folder, locales],
    queryFn: async () => {
      if (!folder) return [];
      return Promise.all(
        locales.map(async (locale) => {
          const path = `${folder}/${locale}.po`;
          const fileExists = await exists(path);
          return { locale, path, exists: fileExists };
        }),
      );
    },
    enabled: !!folder && locales.length > 0,
  });
}

export function useSyncLocale(
  folder: string | null | undefined,
  potPath: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locale: string) => {
      if (!folder || !potPath)
        throw new Error("No project or template selected");
      const potContent = await readTextFile(potPath);
      const poPath = `${folder}/${locale}.po`;
      const fileExists = await exists(poPath);
      const existingContent = fileExists
        ? await readTextFile(poPath)
        : undefined;
      const result = syncPoFromPot(potContent, locale, existingContent);
      await writeTextFile(poPath, result);
      return { locale, poPath, wasNew: !fileExists };
    },
    onSuccess: (_, locale) => {
      queryClient.invalidateQueries({ queryKey: ["po-files", folder] });
      queryClient.invalidateQueries({
        queryKey: ["po-file", `${folder}/${locale}.po`],
      });
      queryClient.invalidateQueries({ queryKey: ["locale-statuses", folder] });
    },
  });
}

export function useSaveProjectConfig(folder: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: ProjectConfig) => {
      if (!folder) throw new Error("No folder selected");
      const configPath = `${folder}/${CONFIG_FILENAME}`;
      await writeTextFile(configPath, JSON.stringify(config, null, 2));
      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-config", folder] });
    },
  });
}
