# postcss-viewport-fallback

English: [README.md](./README.md)

[![npm version](https://img.shields.io/npm/v/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![npm downloads](https://img.shields.io/npm/dm/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![CI](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml/badge.svg)](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/postcss-viewport-fallback)](https://github.com/Surdeddd/postcss-viewport-fallback/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/postcss-viewport-fallback)](https://nodejs.org)

Универсальный fallback-слой для современных viewport-единиц CSS — всех 18 штук:

- `dvw`, `dvh`, `dvi`, `dvb`, `dvmin`, `dvmax` (dynamic)
- `svw`, `svh`, `svi`, `svb`, `svmin`, `svmax` (small)
- `lvw`, `lvh`, `lvi`, `lvb`, `lvmin`, `lvmax` (large)

Две стратегии, один плагин:

- **`duplicate`** (по умолчанию, без runtime) — вставляет перед исходным объявлением классический двойник с `vh`/`vw`/...; старые браузеры используют двойник, современные — настоящую единицу
- **`css-var`** — переписывает единицы в `calc(var(--pvf-dvh, 1vh) * N)` с автоматически добавляемым `@supports`-seed и, по желанию, подключает runtime на ~1 КБ (gzip), который даёт старым браузерам *по-настоящему динамические* значения `dv*` (`sv*`/`lv*` приближаются)

Работает внутри `calc()`, в параметрах `@media`/`@supports`/`@container`, во вложенном CSS, в выводе Tailwind, в Vue/Svelte SFC.

---

## Возможности

### Основная трансформация

- Все **18** viewport-единиц — dynamic, small и large × `w/h/i/b/min/max`
- Две [стратегии](#strategy): `duplicate`-двойники без runtime или динамический `css-var` + runtime
- Работает внутри `calc()`, `min()`, `max()`, `clamp()` и вложенных функций любой глубины
- Дробные, отрицательные и знаковые значения, экспоненциальная запись, регистронезависимые единицы
- Безопасный разбор через `postcss-value-parser` — строки, `url()` и идентификаторы не затрагиваются
- Полная настраиваемость: `preserve`, `onlyProperties`, `excludeProperties`, `customUnits`, `includeCustomProps`
- Производительность: автопропуск по `browserslist`, `fastSkip` (сканирование файла целиком), дедупликация, статистика, безопасная при конкурентных вызовах

### Поддержка at-правил

Генерация fallback внутри:

- `@media`
- `@supports`
- `@container` (включая вложенные container queries)

#### Пример at-правила

```css
@media (min-height: 100dvh) { ... }
/* becomes */
@media (min-height: 100vh) { ... }
@media (min-height: 100dvh) { ... }
```

## Пример

### Вход

```css
.app {
  height: 100dvh;
  width: calc(100dvw - 20px);
}
```

### Выход

```css
.app {
  height: 100vh;
  height: 100dvh;
  width: calc(100vw - 20px);
  width: calc(100dvw - 20px);
}
```

---

## Нужно ли это в 2026 году?

Dynamic viewport units — [Baseline Widely Available](https://caniuse.com/viewport-unit-variants) (~93% поддержки в мире: Chrome 108+, Safari 15.4+, Firefox 101+). Для типичного потребительского приложения в США/ЕС fallback практически не нужен.

Он **всё ещё нужен**, если в вашем `browserslist` есть что-то из этого:

- **Браузеры развивающихся рынков** — Opera Mini (поддержки нет и не будет), UC Browser, QQ, KaiOS
- **Smart TV и digital signage** — Tizen и webOS фиксируют версию Chromium по модельному году; телевизоры 2016–2022 годов до Chromium 108 не доживают
- **Встроенные WebView, киоски, автомобильные мультимедиа** на Chromium старше 108
- **Длинный хвост устройств и госсектор**, где в поддержке остаются старые iOS и Android

Честно говоря: *если плагин вам не нужен, `browserslist: true` сводит его стоимость ровно к нулю. Если нужен — это самое полное из доступных решений.* См. [сравнение](#сравнение) ниже.

---

## Опции

```js
viewportFallback({
  strategy: 'duplicate',   // or 'css-var' (dynamic legacy values, pairs with the runtime)
  preserve: true,          // false removes original dvh, keeps only vh fallback
  includeCustomProps: false,
  onlyProperties: undefined,   // string | RegExp | Array<string | RegExp>
  excludeProperties: undefined,
  debug: false,            // or 'minimal' | 'verbose'
  strict: false,
  customUnits: undefined,  // e.g. { cqh: 'vh', cqw: 'vw' }
  browserslist: false,     // true | browserslist query — auto-skip if all targets support dvh
  fastSkip: false,         // skip files without viewport units via one regex scan
  onTransform(meta) {
    console.log(meta);
  },
  onComplete(stats) {
    console.log(stats); // { declarations, atRules, skipped, timeMs }
  },
});
```

### Подробно об опциях

#### strategy

Как создаются fallback-и для объявлений (по умолчанию `'duplicate'`).

**`'duplicate'`** — классический подход без runtime. Вставляет статический двойник перед исходным объявлением:

```css
/* height: 100dvh  →  */
height: 100vh;
height: 100dvh;
```

Старые браузеры оставляют последнее значение, которое поняли (`100vh`); современные используют `100dvh`. Ничего не нужно поставлять в бандле, работает везде. Лучший выбор по умолчанию для большинства проектов.

**`'css-var'`** — динамический fallback для старых браузеров. Переписывает каждую единицу в `calc()` над CSS-переменной и добавляет `:root`-seed, который через `@supports` переключается на настоящую единицу:

```css
/* input */
.sheet { height: 100dvh; }

/* output */
:root { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root { --pvf-dvh: 1dvh } }
.sheet { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }
```

Сам по себе этот режим ведёт себя как `duplicate` (откатывается к `1vh`). Его сила — в паре с **runtime** (ниже): он выставляет `--pvf-dvh` по *реальному* viewport в браузерах без `dvh`, так что `100dvh` следует за живым viewport, а не за статическим приближением `vh`, которое не учитывает элементы интерфейса мобильного браузера.

> Префикс пользовательских свойств `--pvf-` зарезервирован плагином: объявления, имя которых начинается с `--pvf-`, никогда не трансформируются, а runtime пишет только эти переменные. Не определяйте собственные свойства `--pvf-*`.

Параметры at-правил (`@media (min-height: 100dvh)`) всегда используют стратегию `duplicate`, потому что `var()`/`calc()` недопустимы в контексте feature query.

#### Runtime (для `strategy: 'css-var'`)

Модуль без зависимостей (ESM: 2.9 КБ raw / 1.0 КБ gzip). Импортируйте его один раз в точке входа приложения:

```js
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';

applyViewportVars(); // no-op in browsers that support dvh
```

В браузерах **с** нативной поддержкой `dv*` он определяет `CSS.supports('height','1dvh')` и ничего не делает (с ними уже справляется `@supports`-seed). В браузерах **без** неё он измеряет layout viewport (`innerWidth`/`innerHeight`), записывает во все переменные `--pvf-*` 1% от живого размера и учитывает вертикальные writing modes для `vi`/`vb`. Возвращает `{ update, destroy }` для ручного управления и очистки в SPA. Безопасен для SSR (без `window` ничего не делает).

**Точность — честные ограничения.** Нативные значения `sv*`/`lv*` невозможно в точности воспроизвести из JavaScript, поэтому runtime их приближает:

- `dv*` следуют за живым layout viewport — это максимально близко к нативному поведению, что доступно из JS
- `sv*`/`lv*` отслеживают наименьший/наибольший размер, *замеченный к текущему моменту в текущей ориентации* (экстремумы сбрасываются при повороте), поэтому к нативным значениям они приходят, только когда интерфейс браузера действительно один раз свернулся/развернулся
- обновления **замораживаются во время pinch-zoom** (`visualViewport.scale !== 1`), так как масштабирование не должно влиять на viewport-единицы
- падение высоты более чем на 30% при той же ширине и сфокусированном поле ввода считается **экранной клавиатурой** и игнорируется, что соответствует нативной семантике `dv*` (эвристика — окно, размер которого пользователь намеренно изменил, при сфокусированном поле может быть определено неверно)

Точки входа для фреймворков:

```js
// Vite / plain
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';
applyViewportVars();

// Next.js — app/layout.tsx (client component) or a <Script> tag
'use client';
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';
applyViewportVars();
```

> Если все ваши целевые браузеры поддерживают `dvh` (или вас устраивает статическое приближение `vh`), оставайтесь на стратегии `duplicate` по умолчанию и вообще не подключайте runtime.

#### preserve

Сохранять исходное современное объявление рядом с fallback (по умолчанию `true`).

Значение `false` оставляет только fallback — полезно, если целевые браузеры только старые:

```js
// Input:  height: 100dvh;
// Output: height: 100vh;   (original removed)
preserve: false
```

Применяется и к at-правилам: `@media (min-height: 100dvh)` заменяется блоком с `vh`-fallback.

> **Примечание:** `replace: true` по-прежнему работает как устаревший (deprecated) псевдоним для `preserve: false`.

#### includeCustomProps

Трансформировать пользовательские свойства, например:

```css
--header-height: 100dvh;
```

#### onlyProperties

Применять трансформацию только к выбранным свойствам. Принимает строку, RegExp или массив из них:

```js
onlyProperties: ['height', /^(min|max)-height$/]
onlyProperties: 'height'
```

#### excludeProperties

Пропускать трансформацию для выбранных свойств. Формат тот же, что у `onlyProperties`:

```js
excludeProperties: [/^padding/, 'margin']
```

> At-правила участвуют в фильтрах свойств под именами `@media`, `@supports`, `@container`. Например, `excludeProperties: ['@media']` пропускает параметры media query, а `onlyProperties: ['height']` полностью отключает трансформацию at-правил (в allowlist нет `@media`).

#### browserslist

Автоматически пропускать весь плагин, если все целевые браузеры (определяются из вашего конфига browserslist) поддерживают dynamic viewport units. Требует `caniuse-api` как необязательную зависимость:

```bash
npm install caniuse-api --save-dev
```

```js
browserslist: true                  // resolve targets from project browserslist config
browserslist: 'last 2 versions'     // or pass a query directly
browserslist: ['chrome >= 120', 'safari >= 17']
```

Если `caniuse-api` не установлен, плагин молча продолжает трансформировать как обычно. Однако **неверный запрос или сломанный конфиг browserslist приводит к ошибке при инициализации плагина** — неправильная конфигурация никогда не игнорируется молча.

#### fastSkip

Пропускать целиком файлы без viewport-единиц с помощью одного regex-сканирования исходника вместо обхода каждого объявления (по умолчанию `false`):

```js
fastSkip: true
```

> **Предупреждение:** не включайте, если предыдущий плагин в том же PostCSS-пайплайне *генерирует* viewport-единицы, которых нет в исходном файле, — например, Tailwind создаёт утилиты `h-dvh` из `@tailwind utilities`. Сканирование видит только исходный текст.

#### debug

Управляет выводом логов:

- `false` — без вывода (по умолчанию)
- `true` или `'verbose'` — предупреждения по каждой трансформации + итог с таймингом
- `'minimal'` — только итог (например, `"3 declarations, 1 at-rules transformed (0.42ms)"`)

Вывод идёт через PostCSS `result.warn()`, поэтому он интегрируется с postcss-reporter и другими инструментами экосистемы PostCSS.

#### strict

Бросает ошибку с указанием позиции при обнаружении dynamic viewport units. Полезно в CI, чтобы гарантировать, что все viewport-единицы были пересмотрены вручную.

Strict срабатывает ровно там, где иначе произошла бы трансформация: объявления и at-правила, пропущенные через `excludeProperties`/`onlyProperties`, пользовательские свойства без `includeCustomProps` и идентификаторы, лишь содержащие единицу как подстроку (например, `var(--dvh-color)`), его не вызывают.

#### customUnits

Добавляет собственные соответствия «единица → fallback» поверх встроенных:

```js
customUnits: { cqh: 'vh', cqw: 'vw' }
```

Пользовательские единицы объединяются со встроенными. Встроенные соответствия тоже можно переопределять. Цепочки допустимы (`cqh → svh → vh` даёт прогрессивные fallback-и); циклы в соответствиях (например, `{ dvh: 'svh', svh: 'dvh' }`) отклоняются при инициализации плагина.

#### onTransform(meta)

Callback, вызываемый для каждой трансформации (и объявлений, и at-правил).

#### onComplete(stats)

Callback, вызываемый после обработки, со статистикой:

```js
onComplete(stats) {
  console.log(stats.declarations); // fallback declarations added
  console.log(stats.atRules);      // at-rule fallbacks added
  console.log(stats.skipped);      // dedup skips
  console.log(stats.timeMs);       // processing time in ms
}
```

---

## Управляющие комментарии

Отключить трансформацию для конкретного объявления можно комментарием перед ним:

```css
.app {
  /* postcss-viewport-fallback: off */
  height: 100dvh; /* will NOT get a fallback */
  width: 50dvw;   /* will get a fallback */
}
```

Или отключить целый диапазон через `disable` / `enable` (действует на все последующие соседние узлы и каскадируется во вложенные блоки):

```css
/* postcss-viewport-fallback: disable */
.hero { height: 100dvh; }                          /* skipped */
@media (min-height: 50dvh) { .x { width: 10dvw; } } /* skipped, including contents */
/* postcss-viewport-fallback: enable */
.app { height: 100dvh; }                           /* gets a fallback */
```

---

## Поддерживаемые единицы

Все small (`sv*`), large (`lv*`) и dynamic (`dv*`) viewport-единицы из [CSS Values 4](https://www.w3.org/TR/css-values-4/#viewport-relative-units):

| Современные единицы | Fallback |
| ------------------- | -------- |
| dvw, svw, lvw       | vw       |
| dvh, svh, lvh       | vh       |
| dvi, svi, lvi       | vi       |
| dvb, svb, lvb       | vb       |
| dvmin, svmin, lvmin | vmin     |
| dvmax, svmax, lvmax | vmax     |

Сопоставление регистронезависимо (`100DVH` → `100vh`), как требует спецификация CSS.

> **Честное замечание о fallback-ах `vi`/`vb`:** логические viewport-единицы (`vi`, `vb`) появились в браузерах примерно одновременно с динамическими вариантами (Chromium 108, Safari 15.4) — браузер без `dvi`, скорее всего, не знает и `vi`. Практическая ценность плагина — в fallback-ах `vh`/`vw`/`vmin`/`vmax`; соответствия для `vi`/`vb` добавлены для полноты.

---

## Сравнение

| | **postcss-viewport-fallback** | postcss-100vh-fix | postcss-viewport-unit-fallback | LightningCSS | postcss-preset-env |
| --- | :---: | :---: | :---: | :---: | :---: |
| Все 18 единиц `sv*`/`lv*`/`dv*` | ✅ | ❌ (только 100vh) | ⚠️ только единицы высоты | ❌ | ❌ |
| `dvw`/ширина и логические единицы | ✅ | ❌ | ❌ | ❌ | ⚠️ только `vi`/`vb` |
| Внутри `calc()`/`min()`/`clamp()` | ✅ | ❌ | ❌ | — | — |
| `@media`/`@supports`/`@container` | ✅ | ❌ | ❌ | — | — |
| Сохраняет `!important` | ✅ | ✅ | ❌ ([баг](https://github.com/gooodev/postcss-viewport-unit-fallback/issues/1)) | — | — |
| Динамический runtime-fallback | ✅ (`css-var`) | ❌ | ❌ | ❌ | ❌ |
| Автопропуск по `browserslist` | ✅ | ❌ | ❌ | ✅ (targets) | ✅ (stage) |
| Активно поддерживается | ✅ | ⚠️ | ❌ (2023) | ✅ | ✅ |

- **LightningCSS** не понижает viewport-единицы и [не будет](https://github.com/parcel-bundler/lightningcss/issues/534) — позиция мейнтейнера в том, что `dvw → vw` не является корректным статическим понижением, а для настоящего polyfill нужен JavaScript (именно его и дают `strategy: 'css-var'` + runtime).
- **Autoprefixer** добавляет только вендорные префиксы; у единиц префиксов нет, поэтому он их никогда не трогает.
- **postcss-100vh-fix** решает старую проблему iOS с `-webkit-fill-available` (только высота, ломается в `calc()`); он ортогонален и не является fallback-ом для `dvh`.

---

## Подводные камни, о которых стоит знать

Раз плагин претендует на роль *главного* инструмента для viewport-единиц, честно скажем и об их острых углах. Fallback-плагин их не исправит, но знать о них нужно:

- **`dvh` не реагирует на экранную клавиатуру.** По умолчанию dynamic viewport игнорирует виртуальную клавиатуру. Включить это поведение можно через `<meta name="viewport" content="interactive-widget=resizes-content">` (пока только Chromium).
- **`dvh` может «дёргаться».** Некоторые браузеры сглаживают (debounce) обновления dynamic viewport вместо отслеживания на 60 fps. Для sticky/анимируемых элементов `svh` (smallest viewport) часто спокойнее, чем `dvh`.
- **`svh` против `dvh`:** `svh` предполагает, что интерфейс браузера *виден* (безопасно, ничего не обрезается); `dvh` следует за живым viewport (использует всё доступное место, но смещается). Выбирайте `svh` для гарантированно видимого контента, `dvh` — для full-bleed.
- **Safari 15.6 (macOS)** имеет известный баг: `dvh` отображается больше ожидаемого ([WebKit #242758](https://bugs.webkit.org/show_bug.cgi?id=242758)).

---

## Установка

```bash
npm install postcss-viewport-fallback --save-dev
```

---

## Использование (конфиг PostCSS)

```js
import viewportFallback from 'postcss-viewport-fallback';

export default {
  plugins: [viewportFallback()],
};
```

---

## Использование с фреймворками

### Tailwind CSS

Tailwind [отказался](https://github.com/tailwindlabs/tailwindcss/discussions/12752) генерировать `vh`-fallback-и для своих `dvh`-утилит — этот плагин и есть ответ. **Порядок важен:** ставьте `viewportFallback` *после* Tailwind, чтобы он трансформировал сгенерированный вывод `h-dvh` / `min-h-dvh` / `max-h-dvh`:

```js
// postcss.config.js — Tailwind v3
export default {
  plugins: {
    tailwindcss: {},
    'postcss-viewport-fallback': {},
  },
};
```

```js
// Tailwind v4 (@tailwindcss/postcss)
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-viewport-fallback': {},
  },
};
```

Поскольку Tailwind генерирует утилиты *в процессе* сборки (в вашем исходнике их нет), для точки входа Tailwind оставьте `fastSkip` выключенным — сканирование исходника их не увидит.

### Vue / Nuxt

Работает с блоками `<style>` в файлах `.vue` без дополнительной настройки — `vue-loader` и Vite нативно обрабатывают PostCSS.

### Svelte / SvelteKit

Работает с блоками `<style>` в файлах `.svelte`. Vite и svelte-preprocess применяют PostCSS автоматически.

### styled-components / Emotion (CSS-in-JS)

Для CSS-in-JS на шаблонных литералах настройте `postcss-jsx` как syntax-плагин:

```js
import postcssJsx from 'postcss-jsx';

export default {
  plugins: [viewportFallback()],
  syntax: postcssJsx,
};
```

### Инлайн-стили в HTML

Для тегов `<style>` в файлах `.html` используйте `postcss-html`:

```js
import postcssHtml from 'postcss-html';

export default {
  plugins: [viewportFallback()],
  syntax: postcssHtml,
};
```

---

## Разработка

```bash
npm test               # vitest suite
npm run test:coverage  # suite + v8 coverage report
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # tsup → dist (esm + cjs + d.ts/d.cts)
npm run check:package  # publint + arethetypeswrong (package exports health)
npm run bench          # quick perf benchmark on 20k generated rules
```

CI запускает lint, typecheck, тесты (Node 20/22/24), сборку и проверки пакета при каждом push/PR. Покрытие считается в job на Node 22.

### Релизы

Полностью автоматизированы через [semantic-release](https://github.com/semantic-release/semantic-release): каждый push в `main` с [Conventional Commits](https://www.conventionalcommits.org) (`fix:` → patch, `feat:` → minor, `BREAKING CHANGE` → major) запускает CI и, если пора выпускать релиз, повышает версию, обновляет `CHANGELOG.md`, создаёт тег и GitHub release и публикует пакет в npm с provenance — без ручных шагов.

---

## Лицензия

MIT License © 2025 Maksim Kravtsov
