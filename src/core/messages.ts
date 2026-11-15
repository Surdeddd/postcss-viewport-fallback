const CATALOG = {
  strict: {
    en: '[viewport-fallback] Dynamic viewport unit found: {subject}',
    ru: '[viewport-fallback] Найдена динамическая viewport-единица: {subject}',
  },
  checking: {
    en: 'checking: {subject}',
    ru: 'проверка: {subject}',
  },
  summary: {
    en: '[viewport-fallback] {declarations} declarations, {atRules} at-rules transformed{skipped} ({timeMs}ms)',
    ru: '[viewport-fallback] деклараций: {declarations}, at-правил: {atRules}{skipped} ({timeMs} мс)',
  },
  summarySkipped: {
    en: ', {count} skipped (dedup)',
    ru: ', пропущено (дедуп): {count}',
  },
  unitCycle: {
    en: '[postcss-viewport-fallback] customUnits mapping cycle: {path}',
    ru: '[postcss-viewport-fallback] цикл в customUnits: {path}',
  },
  unitLoopsBack: {
    en: '[postcss-viewport-fallback] customUnits: the fallback chain of "{unit}" returns to the built-in viewport units ({path}); one @supports test stands for all of them, so a chain may pass through them only once',
    ru: '[postcss-viewport-fallback] customUnits: цепочка fallback-ов для "{unit}" возвращается к встроенным viewport-единицам ({path}); их поддержку подтверждает одна проверка @supports, поэтому цепочка может пройти через них только один раз',
  },
  invalidUnitKey: {
    en: '[postcss-viewport-fallback] invalid customUnits key {key} — unit names must be non-empty and alphabetic (e.g. "cqh")',
    ru: '[postcss-viewport-fallback] некорректный ключ customUnits {key} — имя единицы должно быть непустым и состоять из латинских букв (например, "cqh")',
  },
  invalidUnitFallback: {
    en: '[postcss-viewport-fallback] invalid customUnits fallback for "{unit}": {value} — expected a CSS unit like "vh"',
    ru: '[postcss-viewport-fallback] некорректный fallback в customUnits для "{unit}": {value} — нужна CSS-единица, например "vh"',
  },
  invalidBrowserslist: {
    en: '[postcss-viewport-fallback] invalid browserslist configuration: {reason}',
    ru: '[postcss-viewport-fallback] некорректная конфигурация browserslist: {reason}',
  },
  invalidOptions: {
    en: '[postcss-viewport-fallback] invalid options: expected an object, received {received}',
    ru: '[postcss-viewport-fallback] некорректные опции: нужен объект, получено {received}',
  },
  invalidOption: {
    en: '[postcss-viewport-fallback] invalid option "{name}": expected {expected}, received {received}',
    ru: '[postcss-viewport-fallback] некорректная опция "{name}": нужно {expected}, получено {received}',
  },
  expectBoolean: {
    en: 'a boolean',
    ru: 'логическое значение',
  },
  expectFunction: {
    en: 'a function',
    ru: 'функция',
  },
  expectStrategy: {
    en: '"duplicate" or "css-var"',
    ru: '"duplicate" или "css-var"',
  },
  expectDebug: {
    en: 'a boolean, "minimal" or "verbose"',
    ru: 'логическое значение, "minimal" или "verbose"',
  },
  expectFilter: {
    en: 'a string, a RegExp or an array of them',
    ru: 'строка, RegExp или массив из них',
  },
  expectBrowserslist: {
    en: 'a boolean, a query string or an array of query strings',
    ru: 'логическое значение, строка-запрос или массив строк-запросов',
  },
  expectLogicalFallback: {
    en: '"physical" or "logical"',
    ru: '"physical" или "logical"',
  },
  expectExistingFallback: {
    en: '"exact" or "any"',
    ru: '"exact" или "any"',
  },
  unknownOption: {
    en: '[postcss-viewport-fallback] unknown option "{name}"',
    ru: '[postcss-viewport-fallback] неизвестная опция "{name}"',
  },
  removedOption: {
    en: '[postcss-viewport-fallback] option "{name}" was removed in 2.0: use {instead}',
    ru: '[postcss-viewport-fallback] опция "{name}" удалена в 2.0: используйте {instead}',
  },
  expectUnits: {
    en: 'an object mapping unit names to fallback units',
    ru: 'объект вида «единица → fallback-единица»',
  },
  noGuardPossible: {
    en: '[postcss-viewport-fallback] cannot add a fallback for "{prop}" here: legacy browsers never drop a custom property or a value with var()/env(), so the fallback needs an @supports guard, and that requires a style rule around the declaration (not @keyframes) with no earlier nested block that could override it',
    ru: '[postcss-viewport-fallback] не удалось добавить fallback для "{prop}": старые браузеры не отбрасывают custom property и значения с var()/env(), поэтому нужен блок @supports, а для него требуется правило стилей вокруг объявления (не @keyframes) без вложенного блока выше, который мог бы его перебить',
  },
  noSeedHost: {
    en: '[postcss-viewport-fallback] css-var: no stylesheet to hold the --pvf-* seed (only inline styles or declaration fragments were processed); modern browsers keep the static fallback unit wherever the original declaration is not preserved',
    ru: '[postcss-viewport-fallback] css-var: некуда вставить seed переменных --pvf-* (обработаны только inline-стили или фрагменты деклараций); современные браузеры останутся на статичной fallback-единице там, где исходная декларация не сохранена',
  },
} as const;

export type MessageKey = keyof typeof CATALOG;

function language(): 'en' | 'ru' {
  return /^ru(?:[-_.]|$)/i.test(process.env.PVF_LANG ?? '') ? 'ru' : 'en';
}

/** Message in the language selected by `PVF_LANG` (English unless it starts with `ru`). */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return CATALOG[key][language()].replace(/\{(\w+)\}/g, (_placeholder, name: string) =>
    String(params[name])
  );
}
