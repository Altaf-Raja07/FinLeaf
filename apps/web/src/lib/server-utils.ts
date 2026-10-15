import "server-only";
import { translate } from "@/lib/i18n";
import { requestLocale } from "@/lib/locale";

/**
 * The request-scoped translator.
 *
 * Every server component gets its `t()` through this, so the active locale is
 * read once per request rather than per component. Usage:
 *
 *   const { locale, t } = await translator();
 *   t("dashboard.greeting", { name })
 */
export async function translator() {
  const locale = await requestLocale();
  return {
    locale,
    t: (key: string, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
  };
}

export type Translator = Awaited<ReturnType<typeof translator>>;
