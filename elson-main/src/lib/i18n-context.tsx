"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, t as translate, isRTL } from "./i18n";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  rtl: boolean;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
  rtl: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("dialect-locale") as Locale | null;
    if (saved && ["en", "fr", "ar"].includes(saved)) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("dialect-locale", l);
  };

  const tFn = (key: string) => translate(locale, key);
  const rtl = isRTL(locale);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: tFn, rtl }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
