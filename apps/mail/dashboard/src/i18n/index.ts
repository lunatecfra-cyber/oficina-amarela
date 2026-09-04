import { ref } from "vue";
import ptBR from "./locales/pt-BR";
import en from "./locales/en";

export type Locale = "pt-BR" | "en";

const messages: Record<Locale, any> = {
  "pt-BR": ptBR,
  en: en,
};

const savedLocale = (typeof localStorage !== "undefined" ? localStorage.getItem("locale") : null) as Locale | null;
const currentLocale = ref<Locale>(savedLocale === "en" ? "en" : "pt-BR");

export function setLocale(locale: Locale) {
  currentLocale.value = locale;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("locale", locale);
  }
}

export function getLocale(): Locale {
  return currentLocale.value;
}

export function $t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split(".");
  let val: any = messages[currentLocale.value];
  
  for (const part of parts) {
    if (val && typeof val === "object" && part in val) {
      val = val[part];
    } else {
      val = undefined;
      break;
    }
  }

  // Fallback to pt-BR or en
  if (val === undefined) {
    let fallback: any = messages["pt-BR"];
    for (const part of parts) {
      if (fallback && typeof fallback === "object" && part in fallback) {
        fallback = fallback[part];
      } else {
        fallback = undefined;
        break;
      }
    }
    val = fallback ?? key;
  }

  if (typeof val === "string" && params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replace(new RegExp(`{${k}}`, "g"), String(v));
    }
  }

  return typeof val === "string" ? val : key;
}

export function useI18n() {
  return {
    locale: currentLocale,
    setLocale,
    t: $t,
  };
}

export default {
  install(app: any) {
    app.config.globalProperties.$t = $t;
    app.provide("i18n", {
      locale: currentLocale,
      setLocale,
      t: $t,
    });
  },
};
