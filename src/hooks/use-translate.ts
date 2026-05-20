import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface ProviderInfo {
  id: string;
  label: string;
  hasKey: boolean;
}

export interface AppSettings {
  defaultProvider: string | null;
}

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => invoke<ProviderInfo[]>("list_providers"),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: () => invoke<AppSettings>("get_settings"),
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: AppSettings) =>
      invoke("save_settings", { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });
}

export function useSaveApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      invoke("save_api_key", { provider, key }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => invoke("delete_api_key", { provider }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useTranslate() {
  return useMutation({
    mutationFn: ({
      provider,
      text,
      sourceLang,
      targetLang,
    }: {
      provider: string;
      text: string;
      sourceLang: string;
      targetLang: string;
    }) =>
      invoke<string>("translate_text", { provider, text, sourceLang, targetLang }),
  });
}
