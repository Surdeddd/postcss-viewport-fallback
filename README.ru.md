# postcss-viewport-fallback

English: [README.md](./README.md)

[![npm version](https://img.shields.io/npm/v/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![npm downloads](https://img.shields.io/npm/dm/postcss-viewport-fallback)](https://www.npmjs.com/package/postcss-viewport-fallback)
[![CI](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml/badge.svg)](https://github.com/Surdeddd/postcss-viewport-fallback/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/postcss-viewport-fallback)](https://github.com/Surdeddd/postcss-viewport-fallback/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/postcss-viewport-fallback)](https://nodejs.org)

PostCSS-плагин, который даёт `dvh`, `svh`, `lvh` и остальным пятнадцати динамическим viewport-единицам fallback, который старые браузеры действительно применяют.

```css
/* you write */
.app {
  height: 100dvh;
  min-height: calc(100dvh - var(--header));
}

/* browsers get */
.app {
  height: 100vh;
  height: 100dvh;
  min-height: calc(100vh - var(--header));
}
@supports (height: 1dvh) {
  .app {
    min-height: calc(100dvh - var(--header));
  }
}
```

Он обрабатывает обычные значения, `calc()` и родственные функции, значения с `var()`, пользовательские свойства, `@media`, `@container`, условия `@import`, `@keyframes` и `@property` — и не трогает то, о чём вы уже позаботились сами.

**[Попробуйте в песочнице](https://surdeddd.github.io/postcss-viewport-fallback/)**: вставьте свой CSS, переключите опции и прочитайте, что напишет плагин.

## Установка

```bash
npm install postcss-viewport-fallback --save-dev
```

```js
// postcss.config.js
import viewportFallback from 'postcss-viewport-fallback';

export default {
  plugins: [viewportFallback()],
};
```

Объектная форма, которую читает `postcss-load-config` (Vite, postcss-cli, postcss-loader, Next.js, Nuxt), тоже работает, как и `require()`:

```js
// postcss.config.cjs
module.exports = {
  plugins: {
    'postcss-viewport-fallback': {},
  },
};
```

Ставьте плагин **после** всего, что создаёт viewport-единицы: Tailwind, Sass, миксины, переменные.

## Содержание

- [Нужен ли он вам ещё?](#нужен-ли-он-вам-ещё)
- [Что получает fallback](#что-получает-fallback)
- [Что остаётся как есть](#что-остаётся-как-есть)
- [Стратегии](#стратегии)
- [Опции](#опции)
- [Управляющие комментарии](#управляющие-комментарии)
- [Фреймворки и инструменты](#фреймворки-и-инструменты)
- [Поддерживаемые единицы](#поддерживаемые-единицы)
- [Сравнение](#сравнение)
- [Что полезно знать о самих единицах](#что-полезно-знать-о-самих-единицах)
- [Известные ограничения](#известные-ограничения)
- [Частые вопросы](#частые-вопросы)
- [Переход с 1.x](#переход-с-1x)
- [Разработка](#разработка)

## Нужен ли он вам ещё?

Динамические viewport-единицы — [Baseline Widely Available](https://caniuse.com/viewport-unit-variants): Chrome 108+, Safari 15.4+, Firefox 101+, около 93% пользователей в мире. Для типичного потребительского приложения в США или ЕС fallback почти не нужен.

Он **нужен**, если в вашем `browserslist` есть что-то из этого:

- **Браузеры развивающихся рынков** — Opera Mini (поддержки нет и не будет), UC Browser, QQ, KaiOS
- **Smart TV и digital signage** — Tizen и webOS фиксируют версию Chromium по модельному году; телевизоры 2016–2022 годов до Chromium 108 не доживают
- **Встроенные WebView, киоски, автомобильные мультимедиа** на Chromium старше 108
- **Длинный хвост устройств и госсектор**, где в поддержке остаются старые iOS и Android

Если он вам не нужен, `browserslist: true` сводит стоимость плагина к нулю. Если нужен — это самое полное из доступных решений, см. [сравнение](#сравнение).

## Что получает fallback

### Объявления

Перед объявлением ставится двойник с классической единицей. Браузер, который не знает `dvh`, отбрасывает вторую строку и оставляет первую.

```css
/* input */
.a {
  width: calc(100dvw - 20px);
  inset: 1svh 2lvw;
}

/* output */
.a {
  width: calc(100vw - 20px);
  width: calc(100dvw - 20px);
  inset: 1vh 2vw;
  inset: 1svh 2lvw;
}
```

Это работает на любой глубине `calc()`, `min()`, `max()`, `clamp()`, с дробными числами, знаками, экспоненциальной записью и любым регистром, с `!important` и без пробелов вокруг операторов (`100dvh*2`, `height>=100dvh`).

### Значения с `var()` или `env()`

Объявление с `var()` или `env()` любой браузер принимает при разборе таблицы стилей, а ломается оно позже — когда значение подставляется. Двойник перед ним никогда не сработает: браузер без `dvh` оставит `calc(100dvh - var(--header))`, признает значение некорректным и получит `auto`. Поэтому для таких объявлений плагин записывает fallback в само правило, а исходное значение переносит в блок `@supports` сразу после него:

```css
/* input */
.page {
  min-height: calc(100dvh - var(--header));
}

/* output */
.page {
  min-height: calc(100vh - var(--header));
}
@supports (height: 1dvh) {
  .page {
    min-height: calc(100dvh - var(--header));
  }
}
```

- Объявление ниже в том же правиле, которое может пересечься с улучшаемым, — его лонгхенд, шортхенд, который его включает, логическое написание вроде `margin-block-start` — повторяется внутри блока, поэтому более поздний `margin-top` по-прежнему перебивает шортхенд `margin` выше. Объявления несвязанных свойств в блок не попадают:

  ```css
  /* input */
  .card {
    margin: calc(2dvh + var(--gap));
    margin-top: 0;
    color: red;
  }

  /* output */
  .card {
    margin: calc(2vh + var(--gap));
    margin-top: 0;
    color: red;
  }
  @supports (height: 1dvh) {
    .card {
      margin: calc(2dvh + var(--gap));
      margin-top: 0;
    }
  }
  ```

  Какие свойства пересекаются, плагин знает из таблицы, собранной по спецификациям CSS и сверенной с тем, что делает Chrome. Свойство, которого в таблице нет, считается связанным с любым другим.

- Объявления, которым нужны одни и те же единицы, делят один блок. Все восемнадцать встроенных единиц появились в каждом браузере одновременно, поэтому одна проба, `(height: 1dvh)`, отвечает за все.
- Во вложенном CSS блок вкладывается внутрь правила, сразу после объявлений, которые он улучшает, если вложенный блок ниже задаёт связанное свойство и иначе проиграл бы ему.
- Со `strategy: 'css-var'` или `preserve: false` значение переписывается на месте, и блок не нужен.

Там, где блок `@supports` поставить нельзя, — в атрибуте `style=""`, на верхнем уровне фрагмента CSS-in-JS (если не включить [`fragmentGuards`](#fragmentguards)) или ниже вложенного блока того же правила, который задаёт связанное свойство, — объявление остаётся как есть, и о нём сообщается через `result.warn()`.

### Пользовательские свойства

По умолчанию выключено, см. [`includeCustomProps`](#includecustomprops). С ними плагин поступает так же, через `@supports`, потому что пользовательское свойство валидно в любом браузере.

### `@media`, `@import` и `@custom-media`

Пониженный запрос добавляется в список. Браузер, который не понимает `(min-height: 100dvh)`, считает этот один запрос «никогда», а остальные учитывает, поэтому блок не дублируется:

```css
/* input */
@media (min-height: 100dvh) { … }
@import url("tall.css") (min-height: 100dvh);
@custom-media --tall (min-height: 100dvh);

/* output */
@media (min-height: 100vh), (min-height: 100dvh) { … }
@import url("tall.css") (min-height: 100vh), (min-height: 100dvh);
@custom-media --tall (min-height: 100vh), (min-height: 100dvh);
```

### `@container`

Списки условий в container queries пока поддерживаются не везде, поэтому `@container` получает правило-двойника перед собой:

```css
/* input */
@container card (width > 50dvw) { … }

/* output */
@container card (width > 50vw) { … }
@container card (width > 50dvw) { … }
```

### `@keyframes`

Обычные значения получают двойника внутри кадра. Значению с `var()` двойник не поможет, а `@supports` внутри `@keyframes` стоять не может, поэтому плагин понижает значение и повторяет всё правило `@keyframes` под `@supports`; там, где единицы поддерживаются, побеждает более позднее правило с тем же именем. Цепочка `customUnits` получает по такой копии на каждый шаг, от самого слабого.

```css
/* input */
@keyframes grow {
  to {
    height: calc(100dvh - var(--gap));
  }
}

/* output */
@keyframes grow {
  to {
    height: calc(100vh - var(--gap));
  }
}
@supports (height: 1dvh) {
  @keyframes grow {
    to {
      height: calc(100dvh - var(--gap));
    }
  }
}
```

### `@property`

Браузер принимает любое `initial-value`, когда разбирает правило, и отбрасывает всю регистрацию, если потом не может прочитать значение, так что двойник не поможет и здесь. Плагин понижает значение и повторяет правило под `@supports`; там, где единицы поддерживаются, побеждает более поздняя регистрация.

```css
/* input */
@property --sheet {
  syntax: '<length>';
  inherits: false;
  initial-value: 100dvh;
}

/* output */
@property --sheet {
  syntax: '<length>';
  inherits: false;
  initial-value: 100vh;
}
@supports (height: 1dvh) {
  @property --sheet {
    syntax: '<length>';
    inherits: false;
    initial-value: 100dvh;
  }
}
```

## Что остаётся как есть

- **Feature query `@supports` никогда не переписываются**, а то, что под их защитой, не получает fallback. `@supports (height: 100dvh) { … }` уже означает «только там, где единица работает»; проба одной встроенной единицы отвечает за все. Условия с `not`, `and` и `or` читаются по тому, что они гарантируют: `(height: 1dvh) or (height: 1svh)` и `not (not (height: 1dvh))` защищают блок, а `(height: 1dvh) or (display: grid)` и `not (height: 1dvh)` — нет.
- **Fallback-и, написанные вами.** Объявление не трогается, если его fallback уже действует:

  ```css
  .a { height: 100vh; height: 100dvh; }
  .b { min-height: 100vh; min-height: -webkit-fill-available; min-height: 100dvh; }
  @media (min-height: 50vh), (min-height: 50dvh) { … }
  ```

  Fallback должен занимать то же место в каскаде: между ним и современным объявлением могут стоять комментарии, пользовательские свойства, объявления несвязанных свойств и другие значения того же свойства, написанные вами. Шортхенд или лонгхенд этого свойства между ними мог бы его изменить, поэтому в таком случае плагин добавляет собственного двойника:

  ```css
  /* input */
  .c {
    margin-top: 5vh;
    margin: 0;
    margin-top: 5dvh;
  }

  /* output */
  .c {
    margin-top: 5vh;
    margin: 0;
    margin-top: 5vh;
    margin-top: 5dvh;
  }
  ```

  С [`existingFallback: 'any'`](#existingfallback) засчитывается любое более раннее значение свойства, а не только точный эквивалент в `vh`.

- **Строки, `url()`, идентификаторы** вроде `--dvh-color` или `x100dvh`, значения и прелюдии с CSS-экранированием, container style queries (`@container style(--h: 100dvh)`).
- **Дескрипторы** в `@font-face`, `@page` и подобных правилах всегда получают обычного двойника, в том числе с `css-var`, потому что `var()` там недопустим. `initial-value` в `@property` вместо этого [повторяется под `@supports`](#property).

## Стратегии

### `duplicate` (по умолчанию)

Всё, что описано выше: статические fallback-и, в бандл ничего не попадает, работает везде. Fallback `vh` на мобильных — это _наибольший_ viewport, то есть то же, чем `100vh` был всегда.

### `css-var`

Для старых браузеров, которые должны следовать за _живым_ viewport. Каждая единица превращается в `calc()` над CSS-переменной, а небольшой seed задаёт переменные:

<!-- prettier-ignore -->
```css
/* input */
.sheet { height: 100dvh; }

/* output */
:root, :host { --pvf-dvh: 1vh }
@supports (height: 1dvh) { :root, :host { --pvf-dvh: 1dvh } }
.sheet { height: calc(var(--pvf-dvh, 1vh) * 100); height: 100dvh; }
```

Сам по себе этот режим ведёт себя как `duplicate`. Его смысл — в **runtime**, который в браузерах без `dvh` выставляет `--pvf-dvh` по реальному размеру окна:

```js
import { applyViewportVars } from 'postcss-viewport-fallback/runtime';

applyViewportVars(); // does nothing in browsers that support dvh
```

У runtime нет зависимостей (ESM: 3.1 КБ raw, 1.1 КБ gzip), и написан он в синтаксисе ES5, поэтому разбирается теми браузерами, ради которых существует, даже если ваш сборщик не транспилирует `node_modules`. Он возвращает `{ update, destroy }`, ничего не делает без `window` (SSR), обновляется не чаще раза в кадр и измеряет заново, когда страница возвращается из back/forward cache.

Что он может воспроизвести, а что нет:

- `dv*` следуют за живым layout viewport — ближе к нативному поведению из JavaScript не подойти
- `sv*` / `lv*` отслеживают наименьший / наибольший размер, замеченный к этому моменту в текущей ориентации, поэтому устанавливаются только после того, как интерфейс браузера один раз свернулся или развернулся
- обновления замораживаются во время pinch-zoom: масштабирование не должно влиять на viewport-единицы
- падение высоты более чем на 30% при той же ширине и сфокусированном поле ввода считается экранной клавиатурой и игнорируется, как это делают нативные `dv*` (эвристика)

**Seed** ставится в начало каждой таблицы стилей, которой он нужен, — после `@charset` / `@import` / `@namespace` и ведущего комментария `/*! license */` — и перечисляет только те единицы, которые были переписаны. Его селектор — `:root, :host`, поэтому таблица стилей работает и внутри shadow root. С `postcss-html` каждый блок `<style>` получает собственный seed.

Чтобы подключить seed один раз — много точек входа, CSS-in-JS, библиотека компонентов, — выключите его и импортируйте готовый файл:

```js
viewportFallback({ strategy: 'css-var', seed: false });
```

```js
import 'postcss-viewport-fallback/seed.css'; // all 18 units, 0.2 KB gzip
```

> Префикс `--pvf-` зарезервирован: объявления, имя которых начинается с `--pvf-`, никогда не трансформируются, а runtime пишет только эти переменные.

Прелюдии `@media` / `@container` и дескрипторы всегда используют `duplicate`, потому что `var()` там недопустим.

## Опции

```js
viewportFallback({
  strategy: 'duplicate', // or 'css-var'
  preserve: true, // false keeps only the fallback
  includeCustomProps: false,
  logicalFallback: 'physical', // or 'logical'
  existingFallback: 'exact', // or 'any'
  fragmentGuards: false,
  seed: true,
  onlyProperties: undefined, // string | RegExp | Array<string | RegExp>
  excludeProperties: undefined,
  customUnits: undefined, // e.g. { cqh: 'vh' }
  browserslist: false, // true | query | query[]
  fastSkip: false,
  strict: false,
  debug: false, // true | 'minimal' | 'verbose'
  onTransform(meta) {},
  onComplete(stats) {},
});
```

Опции проверяются при создании плагина: неизвестное имя, неверный тип или неизвестное значение сразу приводят к исключению.

### strategy

`'duplicate'` (по умолчанию) или `'css-var'`. См. [Стратегии](#стратегии).

### preserve

Оставлять современное объявление рядом с fallback (по умолчанию `true`). С `false` остаётся только fallback — полезно, когда сборка рассчитана только на старые браузеры:

```css
/* height: 100dvh  →  */
height: 100vh;
/* @media (min-height: 100dvh)  →  */
@media (min-height: 100vh);
```

Блоки под защитой подходящего `@supports` остаются как есть: старые браузеры их всё равно не применяют.

### includeCustomProps

Давать fallback и пользовательским свойствам (по умолчанию `false`).

```css
/* input */
:root {
  --header-height: 100dvh;
  --sheet: 80svh;
}

/* output */
:root {
  --header-height: 100vh;
  --sheet: 80vh;
}
@supports (height: 1dvh) {
  :root {
    --header-height: 100dvh;
    --sheet: 80svh;
  }
}
```

Во вложенном CSS блок следует порядку исходника, как и для [значений с `var()`](#значения-с-var-или-env):

```css
/* input */
:root {
  --h: 100dvh;
  @media (orientation: landscape) {
    --h: 60dvh;
  }
}

/* output */
:root {
  --h: 100vh;
  @supports (height: 1dvh) {
    --h: 100dvh;
  }
  @media (orientation: landscape) {
    --h: 60vh;
    @supports (height: 1dvh) {
      --h: 60dvh;
    }
  }
}
```

### logicalFallback

Во что превращаются `dvi` / `svi` / `lvi` и `dvb` / `svb` / `lvb` (по умолчанию `'physical'`).

- `'physical'` — `vw` и `vh`. Это верно для горизонтальных writing modes, и это работает: браузер без `dvi` не знает и `vi`, так что fallback с `vi` был бы отброшен точно так же.
- `'logical'` — `vi` и `vb`, как их сопоставляет спецификация. Выбирайте для страниц с вертикальным writing mode.

### existingFallback

Что считать fallback-ом, который вы уже написали (по умолчанию `'exact'`).

- `'exact'` — более раннее объявление свойства ровно с пониженным значением (`height: 100vh; height: 100dvh`)
- `'any'` — любое более раннее значение свойства, которое принимают старые браузеры (`height: 500px; height: 100dvh` остаётся как есть)

В обоих случаях более раннее объявление должно занимать то же место в каскаде, см. [Что остаётся как есть](#что-остаётся-как-есть).

### fragmentGuards

Считать объявления верхнего уровня телом правила (по умолчанию `false`). Включайте для styled-components, Emotion и других шаблонов CSS-in-JS — тогда значения с `var()` и пользовательские свойства получат блок `@supports` прямо на месте:

```css
/* input: the body of a styled.div`…` */
min-height: calc(100dvh - var(--header));
color: red;

/* output */
min-height: calc(100vh - var(--header));
@supports (height: 1dvh) {
  min-height: calc(100dvh - var(--header));
}
color: red;
```

По умолчанию опция выключена, потому что так же выглядит атрибут `style=""`, разобранный без `postcss-html`, а at-правило в нём недопустимо.

### seed

Записывать seed переменных `--pvf-*` для `strategy: 'css-var'` в каждую таблицу стилей (по умолчанию `true`). С `false` вы подключаете его один раз сами, см. [Стратегии](#css-var).

### onlyProperties / excludeProperties

Ограничить плагин некоторыми свойствами или не подпускать его к некоторым. Строка сравнивается с именем свойства целиком (для пользовательских свойств — с учётом регистра), RegExp проверяет имя; обе опции принимают и массив.

```js
onlyProperties: ['height', /^(min|max)-height$/];
excludeProperties: [/^padding/, 'margin'];
```

At-правила участвуют под именами `@media`, `@container`, `@import` и `@custom-media`: `excludeProperties: ['@media']` оставляет media-запросы как есть, а `onlyProperties: ['height']` отключает at-правила целиком.

### customUnits

Добавить собственные пары «единица → fallback» или переопределить встроенную:

```js
customUnits: { cqh: 'vh', cqw: 'vw' }
```

Fallback — это имя единицы или `%`. Цепочки допустимы (`cqh → svh → vh` даёт fallback на каждый шаг). При создании плагина отклоняются два вида цепочек: циклы и цепочки, которые уходят от встроенных единиц и возвращаются к ним (`vmin: 'dvw'` дало бы `dvmin → vmin → dvw → vw`), потому что поддержку всех встроенных единиц подтверждает одна проверка `@supports`. Пользовательские единицы считаются единицами длины: блоки `@supports` проверяют их как `height: 1<единица>`, каждую своей пробой, и идут от самого слабого шага цепочки к самому сильному.

### browserslist

Перестать обрабатывать встроенные единицы там, где их поддерживают все целевые браузеры; `customUnits` продолжают работать. Нужна необязательная peer-зависимость `caniuse-api`:

```bash
npm install caniuse-api --save-dev
```

```js
browserslist: true; // the browserslist config that applies to each file
browserslist: 'last 2 versions'; // or a query
browserslist: ['chrome >= 120', 'safari >= 17'];
```

С `true` целевые браузеры определяются для каталога каждого обрабатываемого файла, поэтому у пакетов монорепозитория они могут быть разными. Если `caniuse-api` не установлен, плагин продолжает трансформировать; неверный запрос или сломанный конфиг приводят к исключению.

### fastSkip

Пропускать файл, в исходнике которого нет viewport-единиц, после одного сканирования регулярным выражением (по умолчанию `false`). Не включайте, если предыдущий плагин приносит единицы, которых нет в исходном файле, — утилиты Tailwind, `postcss-import`.

### strict

Бросать ошибку с позицией в исходнике везде, где был бы добавлен fallback или где он нужен, но поставить его некуда. Заслон для CI, когда каждая viewport-единица должна быть проверена вручную. Объявления, пропущенные фильтрами или управляющими комментариями, защищённые `@supports` или уже прикрытые вашим собственным fallback-ом, его не вызывают.

### debug

`false` (по умолчанию), `'minimal'` — итог одной строкой, `true` / `'verbose'` — строка на каждого кандидата и каждую трансформацию плюс итог. Вывод идёт через `result.warn()`, поэтому его показывают postcss-reporter и подобные инструменты.

### onTransform(meta)

Вызывается один раз для каждого объявления или at-правила, получившего fallback, с `{ prop, original, fallback, file, selector, loc }`. `selector` — селектор ближайшего объемлющего правила стилей; для at-правил `prop` равен `@media`, `@container`, `@import` или `@custom-media`.

### onComplete(stats)

Вызывается один раз на обработанный файл — один раз на документ для HTML-подобных синтаксисов:

```js
onComplete(stats) {
  stats.declarations; // fallback declarations added
  stats.atRules;      // at-rule fallbacks added
  stats.skipped;      // left alone: the fallback was already there
  stats.timeMs;       // processing time
}
```

### Язык сообщений

Ошибки и предупреждения выводятся на английском. Задайте переменную окружения `PVF_LANG=ru`, чтобы получать их на русском.

## Управляющие комментарии

Выключить плагин для следующего объявления или at-правила:

```css
.app {
  /* postcss-viewport-fallback: off */
  height: 100dvh; /* no fallback */
  width: 50dvw; /* gets one */
}
```

Или для диапазона. Он действует на всё, что идёт дальше в том же блоке, включая вложенные блоки:

```css
/* postcss-viewport-fallback: disable */
.hero {
  height: 100dvh;
}
@media (min-height: 50dvh) {
  .x {
    width: 10dvw;
  }
}
/* postcss-viewport-fallback: enable */
.app {
  height: 100dvh;
}
```

Диапазон принадлежит блоку, в котором он записан, а `enable` внутри блока отменяет `disable` снаружи. Пробелы и регистр не важны: `/*postcss-viewport-fallback:off*/` тоже работает.

Выключенное объявление остаётся таким, каким вы его написали, везде: там, где плагину приходится повторить его внутри блока `@supports`, чтобы сохранить место в каскаде, копия получает собственный комментарий `off`.

## Фреймворки и инструменты

### Tailwind CSS

Tailwind [не генерирует](https://github.com/tailwindlabs/tailwindcss/discussions/12752) fallback-и с `vh` для `h-dvh`, `min-h-dvh`, `max-h-dvh` и произвольных значений вроде `min-h-[calc(100dvh-var(--header))]`. Поставьте этот плагин после Tailwind:

```js
// postcss.config.js — Tailwind v4
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-viewport-fallback': {},
  },
};
```

```js
// Tailwind v3
export default {
  plugins: {
    tailwindcss: {},
    'postcss-viewport-fallback': {},
  },
};
```

Для точки входа Tailwind оставьте `fastSkip` выключенным: утилит нет в вашем исходном файле.

### Vite

Vite сам читает `postcss.config.js`. Конфигурация прямо в конфиге Vite тоже работает:

```js
// vite.config.js
import viewportFallback from 'postcss-viewport-fallback';

export default {
  css: { postcss: { plugins: [viewportFallback()] } },
};
```

### Next.js

Next.js ждёт имена плагинов строками, а собственный конфиг заменяет его конфиг по умолчанию:

```js
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-viewport-fallback': {},
  },
};
```

Для `strategy: 'css-var'` вызовите `applyViewportVars()` из клиентского компонента в корневом layout.

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  postcss: {
    plugins: {
      'postcss-viewport-fallback': {},
    },
  },
});
```

### Astro, SvelteKit, Vue

Все три работают через Vite: достаточно `postcss.config.js` в корне проекта, а блоки `<style>` в файлах `.astro`, `.svelte` и `.vue` тоже обрабатываются.

### webpack

```js
// postcss-loader picks up postcss.config.js; or inline:
{ loader: 'postcss-loader', options: { postcssOptions: { plugins: ['postcss-viewport-fallback'] } } }
```

### Sass, Less, Stylus

Запускайте плагин на их выводе — так PostCSS-плагины обычно и работают. Переменные `$variables` верхнего уровня в SCSS-файле, разобранном через `postcss-scss`, не мешают.

### styled-components, Emotion

Разбирайте шаблоны синтаксисом для CSS-in-JS и включите [`fragmentGuards`](#fragmentguards):

```js
import postcssJsx from 'postcss-jsx';

export default {
  syntax: postcssJsx,
  plugins: [viewportFallback({ fragmentGuards: true })],
};
```

Со `strategy: 'css-var'` во фрагменте нет места для seed: используйте `seed: false` и один раз импортируйте `postcss-viewport-fallback/seed.css`.

### HTML

```js
import postcssHtml from 'postcss-html';

export default {
  syntax: postcssHtml,
  plugins: [viewportFallback()],
};
```

Обрабатываются блоки `<style>` и атрибуты `style=""`. В атрибуте блок `@supports` стоять не может, поэтому о значении с `var()` внутри него плагин только сообщает.

## Поддерживаемые единицы

Все small (`sv*`), large (`lv*`) и dynamic (`dv*`) viewport-единицы из [CSS Values 4](https://www.w3.org/TR/css-values-4/#viewport-relative-units):

| Единицы             | Fallback                                 |
| ------------------- | ---------------------------------------- |
| dvw, svw, lvw       | vw                                       |
| dvh, svh, lvh       | vh                                       |
| dvmin, svmin, lvmin | vmin                                     |
| dvmax, svmax, lvmax | vmax                                     |
| dvi, svi, lvi       | vw (`vi` с `logicalFallback: 'logical'`) |
| dvb, svb, lvb       | vh (`vb` с `logicalFallback: 'logical'`) |

Имена единиц распознаются в любом регистре, как и в CSS.

## Сравнение

|                                                                            | **postcss-viewport-fallback** | postcss-100vh-fix |                         postcss-viewport-unit-fallback                         | LightningCSS | postcss-preset-env  |
| -------------------------------------------------------------------------- | :---------------------------: | :---------------: | :----------------------------------------------------------------------------: | :----------: | :-----------------: |
| Все 18 единиц `sv*` / `lv*` / `dv*`                                        |              ✅               | ❌ (только 100vh) |                            ⚠️ только единицы высоты                            |      ❌      |         ❌          |
| Единицы ширины и логические                                                |              ✅               |        ❌         |                                       ❌                                       |      ❌      | ⚠️ только `vi`/`vb` |
| Внутри `calc()` / `min()` / `clamp()`                                      |              ✅               |        ❌         |                                       ❌                                       |      —       |          —          |
| Значения с `var()` / `env()`, у которых fallback действительно срабатывает |              ✅               |        ❌         |                                       ❌                                       |      —       |          —          |
| Работающие fallback-и для пользовательских свойств                         |              ✅               |        ❌         |                                       ❌                                       |      —       |          —          |
| Прелюдии `@media` / `@container` / `@import`                               |              ✅               |        ❌         |                                       ❌                                       |      —       |          —          |
| Сохраняет `!important`                                                     |              ✅               |        ✅         | ❌ ([баг](https://github.com/gooodev/postcss-viewport-unit-fallback/issues/1)) |      —       |          —          |
| Живые значения в старых браузерах                                          |        ✅ (`css-var`)         |        ❌         |                                       ❌                                       |      ❌      |         ❌          |
| Автопропуск по `browserslist`                                              |              ✅               |        ❌         |                                       ❌                                       | ✅ (targets) |     ✅ (stage)      |
| Активно поддерживается                                                     |              ✅               |        ⚠️         |                                   ❌ (2023)                                    |      ✅      |         ✅          |

- **LightningCSS** не понижает viewport-единицы и [не будет](https://github.com/parcel-bundler/lightningcss/issues/534): мейнтейнер считает статическое `dvw → vw` некорректным, а настоящий polyfill — зависящим от JavaScript; именно это и даёт `strategy: 'css-var'` вместе с runtime.
- **Autoprefixer** добавляет вендорные префиксы; у единиц их нет.
- **postcss-100vh-fix** решает старую проблему iOS с `-webkit-fill-available`. Он ортогонален и не является fallback-ом для `dvh`.

## Что полезно знать о самих единицах

- **`dvh` не реагирует на экранную клавиатуру.** Включить это можно через `<meta name="viewport" content="interactive-widget=resizes-content">` (пока только Chromium).
- **`dvh` может «дёргаться».** Некоторые браузеры сглаживают обновления динамического viewport. Для sticky или анимируемых элементов `svh` часто спокойнее.
- **`svh` или `dvh`?** `svh` предполагает, что интерфейс браузера виден: контент никогда не обрезается. `dvh` следует за живым viewport: занимает всё место — и двигается.
- **Safari 15.6 на macOS** отображает `dvh` больше ожидаемого ([WebKit #242758](https://bugs.webkit.org/show_bug.cgi?id=242758)).

## Известные ограничения

- **Пониженный media-запрос ничем не ограждён.** `(max-height: 100vh)` вычисляют и современные браузеры. Для запросов `min-*` он может сработать только там, где срабатывает и оригинал; для `max-*` и сравнений `<` есть узкая полоса между динамическим и большим размером viewport, в которой срабатывает только пониженный запрос. То же относится к двойнику `@container`.
- **Разные пользовательские единицы в одном правиле получают по блоку.** Встроенные единицы делят один блок `@supports`. Значения, которым нужны _разные_ пробы, получают по блоку в порядке исходника, а объявление, которое пересекается со значениями из нескольких блоков, повторяется в каждом из них. `@keyframes` и `@property` повторяются целиком, поэтому там такие значения повышаются вместе: браузер, который знает только часть единиц, остаётся на fallback для всех.
- **Значения с CSS-экранированием пропускаются.** Значение или прелюдия с обратной косой чертой (`100d\76h`, `u\72l(…)`) остаётся нетронутым — плагин не гадает. At-правило, чьё _имя_ записано с экранированием (`@keyframe\73`), не опознаётся вовсе: PostCSS обрывает имя на обратной косой черте.
- **В атрибутах `style=""`** нет места ни для блока `@supports`, ни для css-var seed. О значении с `var()` в атрибуте плагин сообщает, а не пишет fallback, который не может работать. Seed для атрибута уходит в первый блок `<style>` документа, и плагин не проверяет, что этот блок действует там же, где атрибут (атрибут `media`, shadow root): если нет, [подключите seed сами](#seed).
- **Другие плагины.** Когда другой плагин пайплайна обходит узлы — `postcss-nesting`, `postcss-logical`, `postcss-preset-env`, конвертер `px` в `rem`, — этот плагин делает свою работу после того, как все они закончили, где бы он ни стоял в конфиге. Поэтому он пишет то же, что написал бы для таблицы стилей, которую эти плагины оставляют, и порядок этих двух ничего не меняет: тесты прогоняют оба порядка с настоящими `postcss-logical` и `postcss-nesting`. Fallback-и такие плагины не видят. Плагины, которые в конце работают со всей таблицей стилей (Autoprefixer, минификаторы), идут в порядке конфига: ставьте минификатор после этого плагина, иначе написанное им останется несжатым.

## Частые вопросы

**Как добавить fallback для `100dvh`?**
Установите плагин и добавьте его в конфиг PostCSS. `height: 100dvh` превратится в `height: 100vh; height: 100dvh`: старые браузеры используют первую строку, новые — вторую.

**Добавляет ли Tailwind CSS fallback с `vh` для `h-dvh` или `min-h-dvh`?**
Нет. Поставьте этот плагин после Tailwind, и каждая утилита с `dvh` / `svh` / `lvh`, включая произвольные значения, получит fallback.

**Почему мой собственный fallback не работает для `calc(100dvh - var(--header))`?**
Из-за `var()`. При разборе браузер не может понять, что значение некорректно, поэтому оставляет объявление, отбрасывает ваш fallback и лишь потом получает `auto`. Fallback должен быть значением в самом правиле, а современное значение — в `@supports`; именно так плагин и пишет.

**Нужен ли polyfill на JavaScript?**
Для статического fallback — нет. Если старые браузеры должны следовать за живым viewport, как это делает `dvh`, используйте `strategy: 'css-var'` с runtime на 1.1 КБ.

**Хороший ли fallback `100vh` для `100dvh`?**
Это самое близкое статическое значение. На мобильных `100vh` — это viewport со скрытым интерфейсом браузера, поэтому контент может оказаться под адресной строкой; так старые браузеры вели себя всегда.

**В каких браузерах нет `dvh`, `svh` и `lvh`?**
Chrome и Edge до 108, Safari до 15.4, Firefox до 101, Samsung Internet до 21, Opera Mini, а также WebView и телевизоры на этих движках.

**Работает ли он с Lightning CSS, postcss-preset-env или Autoprefixer?**
Да. Ни один из них не понижает viewport-единицы. Запускайте плагин после всего, что создаёт единицы, и перед минификатором. Рядом с `postcss-preset-env` порядок не важен: плагин дожидается плагинов, обходящих узлы, и понижает то, что они оставили.

**Меняет ли он то, что отображают современные браузеры?**
Нет. В тестах плагина есть рандомизированная проверка: для каждого селектора и свойства браузер, поддерживающий единицы, получает ровно то значение, которое вы написали.

## Переход с 1.x

2.0 меняет вывод там, где 1.x создавал fallback-и, которые не могли сработать. Коротко: если вы зависите от старого вывода — зафиксируйте 1.x, иначе обновляйтесь и один раз просмотрите diff собранного CSS.

- **`@supports` больше не переписывается.** Версии 1.x добавляли двойника с `vh` каждому блоку `@supports (… dvh)`, из-за чего блок открывался всем и ломались написанные вручную лесенки. Объявления под защитой подходящего `@supports` тоже больше не получают двойника.
- **Значения с `var()` / `env()` и пользовательские свойства** получают fallback в правиле, а оригинал — в блоке `@supports`, вместо двойника, который никогда не применялся. С `initial-value` в `@property` так же: регистрация повторяется под `@supports`.
- **`@media` получает более длинный список запросов вместо второго блока.** У `@container` остаётся правило-двойник. Условия `@import` и `@custom-media` теперь обрабатываются.
- **Одна проба `@supports (height: 1dvh)`** отвечает за все встроенные единицы. Цепочка `customUnits`, которая уходит от встроенных единиц и возвращается к ним, отклоняется.
- **Логические единицы понижаются до `vw` / `vh`**, а не до `vi` / `vb`. Для прежнего соответствия задайте `logicalFallback: 'logical'`.
- **Существующий fallback распознаётся по позиции**, а не по одному лишь присутствию среди соседей.
- **Seed стратегии css-var** использует селектор `:root, :host`, стоит после `@import` / `@charset`, содержит один блок улучшения на все встроенные единицы, не обёрнут в управляющие комментарии, а с `postcss-html` попадает в каждый блок `<style>`, которому он нужен.
- **`replace` удалён:** используйте `preserve: false`. Неизвестные имена опций и некорректные значения приводят к исключению.
- **`selector` в `onTransform`** — селектор ближайшего объемлющего правила.
- **`require('postcss-viewport-fallback')` возвращает функцию плагина**; `.default` по-прежнему работает.
- **`browserslist: true`** определяется для каждого файла и оставляет `customUnits` активными.
- **Другие плагины, обходящие узлы, больше не видят fallback-и.** Когда такие плагины есть в пайплайне, плагин работает после них. Минификатор должен стоять после него.

## Разработка

```bash
npm test               # vitest suite
npm run test:coverage  # suite + v8 coverage report (thresholds: 100%)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format:check   # prettier
npm run build          # tsup → dist (esm + cjs + d.ts/d.cts + seed.css)
npm run check:package  # publint + arethetypeswrong + smoke test + consumer type fixtures
npm run bench          # quick benchmark on 20k generated rules
```

CI запускает всё это на Node 20, 22 и 24 для каждого pull request. О том, как устроены тесты, — в [CONTRIBUTING.ru.md](./CONTRIBUTING.ru.md), о том, что может появиться дальше, — в [ROADMAP.ru.md](./ROADMAP.ru.md).

Релизы автоматизированы через [semantic-release](https://github.com/semantic-release/semantic-release): push в `main` с [Conventional Commits](https://www.conventionalcommits.org) запускает CI и, если пора выпускать релиз, повышает версию, обновляет `CHANGELOG.md`, создаёт тег и GitHub release и публикует пакет в npm с provenance.

## Лицензия

MIT License © 2025 Maksim Kravtsov
