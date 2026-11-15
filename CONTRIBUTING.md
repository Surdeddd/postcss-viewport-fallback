# Contributing

Русская версия: [CONTRIBUTING.ru.md](./CONTRIBUTING.ru.md)

Thanks for taking the time. Bug reports with a small CSS sample are as welcome as code.

## Reporting a bug

A report is easy to act on when it has:

- the CSS that goes in and the CSS that comes out (a few lines are enough)
- the plugin options and the other PostCSS plugins in the pipeline, in order
- the versions of `postcss-viewport-fallback`, `postcss` and Node
- what you expected instead, and in which browser the result is wrong

## Setting up

```bash
git clone https://github.com/Surdeddd/postcss-viewport-fallback.git
cd postcss-viewport-fallback
npm ci
npm test
```

Node 20 or newer.

## Making a change

1. Write a test that fails for the reason you are about to fix. Tests live in `test/`, one topic per file; `test/helpers/run.ts` runs the plugin on a string.
2. Make it pass with the smallest change that does.
3. Run the whole gate:

```bash
npm run lint
npm run typecheck
npm run test:coverage   # coverage thresholds are 100%
npm run build
npm run check:package   # publint, arethetypeswrong, smoke test, type fixtures
```

A few things specific to this project:

- **The cascade oracle** (`test/cascade-oracle.test.ts`) generates random CSS and checks, for several browser models, that every `selector | property` ends up with the value the author meant. If it fails, the message contains the input and the output; reduce it to a small test before fixing.
- **The table of properties** (`src/core/properties.data.ts`) is generated, do not edit it. `npm run properties` builds it from `@webref/css` and from `scripts/data/chrome-shorthands.json`, a record of what Chrome sets through every shorthand and alias it knows (`scripts/data/capture-shorthands.js` produces that record in the browser console). To refresh the table, update `@webref/css`, run the script and commit the result; a test fails while the committed table is out of date. The oracle keeps its own, hand-written model of shorthands on purpose: the two have to agree.
- **The playground** lives in `playground/`. `npm run playground` builds it into `playground/dist`: the plugin bundled for the browser, and the page's own stylesheet run through the plugin. It is published to GitHub Pages when `main` changes; its logic without a DOM is covered in `test/playground.test.ts`.
- **Other plugins are tested for real.** PostCSS calls a plugin that listens to single properties after the plugins that listen to every declaration, so plugins that share a walk change each other's nodes whatever their order in the config. That is why this plugin works after the walk when another plugin visits nodes (`src/plugin/index.ts`). `test/real-plugins.test.ts` runs it before and after `postcss-logical` and `postcss-nesting`, and `test/other-plugins.test.ts` states what is promised about other plugins; both orders have to give the same CSS.
- **Behaviour of browsers is checked in a browser.** When a change relies on how CSS is parsed or cascaded, verify it in a real engine first. A unit that does not exist (`1qq`) is a handy stand-in for "a browser without `dvh`".
- **The runtime** (`src/runtime.ts`) is shipped untranspiled to old browsers: ES5 syntax only. ESLint enforces it.
- **Messages** come from the catalog in `src/core/messages.ts`, in English and Russian.
- **Documentation** is kept in pairs: `README.md` + `README.ru.md`, `ROADMAP.md` + `ROADMAP.ru.md`.
- `CHANGELOG.md` is written by semantic-release. Do not edit it by hand.

## Commits

[Conventional Commits](https://www.conventionalcommits.org), in English: `fix: …`, `feat: …`, `docs: …`, `test: …`, `chore: …`. A breaking change carries a `BREAKING CHANGE:` footer. Releases are cut automatically from these messages when `main` is updated.
