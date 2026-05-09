import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { useAtomValue, useSetAtom } from "jotai";
import { savedProjectsAtom, type SavedProject } from "@/lib/atoms";
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

async function createDir(path: string): Promise<void> {
  return invoke("create_dir", { path });
}
const CONFIG_FILENAME = ".i18kit.json";

export function useProjects() {
  return useAtomValue(savedProjectsAtom);
}

export function useAddProject(onAdded?: (project: SavedProject) => void) {
  const setProjects = useSetAtom(savedProjectsAtom);

  return useMutation({
    mutationFn: async () => {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return null;
      const name = selected.split("/").pop() ?? selected;
      const project: SavedProject = {
        id: crypto.randomUUID(),
        path: selected,
        name,
      };
      return project;
    },
    onSuccess: (project) => {
      if (!project) return;
      setProjects((prev) => {
        const alreadyExists = prev.some((p) => p.path === project.path);
        if (alreadyExists) return prev;
        return [...prev, project];
      });
      onAdded?.(project);
    },
  });
}

export function useRemoveProject(onRemoved?: (id: string) => void) {
  const setProjects = useSetAtom(savedProjectsAtom);

  return (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    onRemoved?.(id);
  };
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

export function useInitializeProject(projectPath: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: ProjectConfig) => {
      if (!projectPath) throw new Error("No folder selected");

      const rel = config.localesDir;
      const localesDir =
        !rel || rel === "." ? projectPath : `${projectPath}/${rel}`;

      await createDir(localesDir);

      const potPath = `${localesDir}/i18kit.pot`;
      const now = new Date().toISOString();
      const potContent = [
        'msgid ""',
        'msgstr ""',
        `"Project-Id-Version: ${config.name} 1.0\\n"`,
        '"Report-Msgid-Bugs-To: \\n"',
        `"POT-Creation-Date: ${now}\\n"`,
        `"PO-Revision-Date: ${now}\\n"`,
        '"Last-Translator: \\n"',
        '"Language-Team: \\n"',
        `"Language: ${config.sourceLanguage}\\n"`,
        '"MIME-Version: 1.0\\n"',
        '"Content-Type: text/plain; charset=UTF-8\\n"',
        '"Content-Transfer-Encoding: 8bit\\n"',
        '"X-Generator: i18kit\\n"',
        "",
      ].join("\n");

      await writeTextFile(potPath, potContent);

      const configPath = `${projectPath}/${CONFIG_FILENAME}`;
      await writeTextFile(configPath, JSON.stringify(config, null, 2));

      return config;
    },
    onSuccess: (config) => {
      queryClient.invalidateQueries({ queryKey: ["project-config", projectPath] });
      const rel = config.localesDir;
      const localesDir =
        !rel || rel === "." ? projectPath : `${projectPath}/${rel}`;
      queryClient.invalidateQueries({ queryKey: ["po-files", localesDir] });
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
