import { po } from "gettext-parser";

export interface PoEntry {
  id: string;
  msgid: string;
  msgidPlural?: string;
  msgstr: string[];
  msgctxt: string;
  translatorComment: string;
  extractedComment: string;
  references: string[];
  flags: string[];
  fuzzy: boolean;
  translated: boolean;
}

export interface PoFile {
  path: string;
  language: string;
  headers: Record<string, string>;
  charset: string;
  entries: PoEntry[];
  stats: {
    total: number;
    translated: number;
    fuzzy: number;
    untranslated: number;
  };
}

export interface ProjectConfig {
  name: string;
  sourceLanguage: string;
  locales: string[];
  localesDir: string;
  createdAt: string;
}

/**
 * Creates or merges a .po file from a .pot template.
 * If existingPoContent is provided, only adds entries missing from the .po —
 * existing translations are never touched.
 */
export function syncPoFromPot(
  potContent: string,
  locale: string,
  existingPoContent?: string,
): string {
  const pot = po.parse(potContent);

  if (existingPoContent) {
    const existing = po.parse(existingPoContent);

    for (const [ctxt, strings] of Object.entries(pot.translations)) {
      for (const [msgid, translation] of Object.entries(strings)) {
        const alreadyExists = existing.translations[ctxt]?.[msgid];
        if (!alreadyExists) {
          if (!existing.translations[ctxt]) existing.translations[ctxt] = {};
          existing.translations[ctxt][msgid] = {
            ...translation,
            msgstr: [""],
            comments: {
              ...translation.comments,
              flag: (translation.comments?.flag ?? "")
                .split(",")
                .map((f) => f.trim())
                .filter((f) => f !== "fuzzy")
                .join(", "),
            },
          };
        }
      }
    }

    return po.compile(existing).toString();
  }

  // Fresh file — clear all translations
  for (const ctxt of Object.values(pot.translations)) {
    for (const translation of Object.values(ctxt)) {
      translation.msgstr = [""];
      if (translation.comments?.flag) {
        translation.comments.flag = translation.comments.flag
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f !== "fuzzy")
          .join(", ");
      }
    }
  }

  pot.headers = {
    ...pot.headers,
    Language: locale,
    "Content-Type": pot.headers?.["Content-Type"] ?? "text/plain; charset=UTF-8",
    "Content-Transfer-Encoding": pot.headers?.["Content-Transfer-Encoding"] ?? "8bit",
  };

  return po.compile(pot).toString();
}

export function parsePoContent(path: string, content: string): PoFile {
  const parsed = po.parse(content);
  const filename = path.split("/").pop() ?? path.split("\\").pop() ?? "";
  const language = filename.replace(/\.(po|pot)$/, "");

  const entries: PoEntry[] = [];

  for (const [ctxt, strings] of Object.entries(parsed.translations)) {
    for (const [msgid, translation] of Object.entries(strings)) {
      if (msgid === "" && ctxt === "") continue;

      const flagStr = translation.comments?.flag ?? "";
      const flags = flagStr
        ? flagStr
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean)
        : [];
      const fuzzy = flags.includes("fuzzy");
      const msgstr = translation.msgstr ?? [""];
      const translated = msgstr.some((s) => s.trim().length > 0) && !fuzzy;

      entries.push({
        id: `${ctxt}\x00${msgid}`,
        msgid,
        msgidPlural: translation.msgid_plural,
        msgstr,
        msgctxt: ctxt,
        translatorComment: translation.comments?.translator ?? "",
        extractedComment: translation.comments?.extracted ?? "",
        references: (translation.comments?.reference ?? "")
          .split("\n")
          .filter(Boolean),
        flags,
        fuzzy,
        translated,
      });
    }
  }

  const total = entries.length;
  const fuzzyCount = entries.filter((e) => e.fuzzy).length;
  const translatedCount = entries.filter((e) => e.translated).length;

  return {
    path,
    language,
    headers: parsed.headers ?? {},
    charset: parsed.charset ?? "utf-8",
    entries,
    stats: {
      total,
      translated: translatedCount,
      fuzzy: fuzzyCount,
      untranslated: total - translatedCount - fuzzyCount,
    },
  };
}

export function applyEntryUpdate(
  content: string,
  entry: Pick<PoEntry, "msgid" | "msgctxt" | "msgstr" | "fuzzy" | "flags">,
): string {
  const parsed = po.parse(content);
  const ctxt = entry.msgctxt;

  if (parsed.translations[ctxt]?.[entry.msgid]) {
    const t = parsed.translations[ctxt][entry.msgid];
    t.msgstr = entry.msgstr;

    const flags = (t.comments?.flag ?? "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => f !== "fuzzy");

    if (entry.fuzzy) flags.unshift("fuzzy");

    if (!t.comments) t.comments = {};
    t.comments.flag = flags.join(", ");
  }

  return po.compile(parsed).toString();
}
