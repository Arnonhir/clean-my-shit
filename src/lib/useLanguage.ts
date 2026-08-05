"use client";

import { useCallback, useEffect, useState } from "react";
import { translate, type Lang, type TranslationKey } from "./i18n";

const STORAGE_KEY = "clean-my-shit-lang";

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "he") setLangState(saved);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang]
  );

  return { lang, setLang, t, dir: lang === "he" ? "rtl" : "ltr" } as const;
}
