import { atom } from "jotai";

export const searchQueryAtom = atom("");
export const filterAtom = atom<"all" | "translated" | "untranslated" | "fuzzy">("all");
