import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface SavedProject {
  id: string;
  path: string;
  name: string;
}

export const savedProjectsAtom = atomWithStorage<SavedProject[]>(
  "saved-projects",
  [],
);

export const searchQueryAtom = atom("");
export const filterAtom = atom<"all" | "translated" | "untranslated" | "fuzzy">("all");
