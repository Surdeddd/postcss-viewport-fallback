import type { StringKey } from './i18n';
import type { Settings } from './state';

export interface Example {
  id: string;
  title: StringKey;
  css: string;
  settings?: Partial<Settings>;
}

export const EXAMPLES: readonly Example[] = [
  {
    id: 'overview',
    title: 'exOverview',
    css: `.app {
  height: 100dvh;
  min-height: calc(100dvh - var(--header));
}

@media (min-height: 50svh) {
  .bar {
    padding-block: 2lvh;
  }
}
`,
  },
  {
    id: 'var',
    title: 'exVar',
    css: `.card {
  margin: calc(2dvh + var(--gap));
  margin-top: 0;
  color: #191919;
}

.page {
  min-height: calc(100dvh - var(--header));
  min-height: calc(100dvh - env(safe-area-inset-bottom));
}
`,
  },
  {
    id: 'custom',
    title: 'exCustom',
    settings: { includeCustomProps: true },
    css: `:root {
  --header: 8svh;
  --sheet: 80dvh;
}

.sheet {
  height: var(--sheet);
  top: var(--header);
}
`,
  },
  {
    id: 'queries',
    title: 'exQueries',
    css: `@media (min-height: 100dvh) {
  .hero {
    display: grid;
  }
}

@container card (width > 50dvw) {
  .title {
    font-size: 2rem;
  }
}
`,
  },
  {
    id: 'keyframes',
    title: 'exKeyframes',
    css: `@keyframes grow {
  from {
    height: 10svh;
  }
  to {
    height: calc(100dvh - var(--gap));
  }
}
`,
  },
  {
    id: 'nesting',
    title: 'exNesting',
    css: `.sheet {
  height: calc(100dvh - var(--bar));

  &:hover {
    color: #e96a26;
  }

  @media (orientation: landscape) {
    height: 100svh;
  }
}
`,
  },
  {
    id: 'css-var',
    title: 'exCssVar',
    settings: { strategy: 'css-var' },
    css: `.sheet {
  height: 100dvh;
}

.bar {
  top: calc(100svh - 3rem);
}
`,
  },
  {
    id: 'own',
    title: 'exOwn',
    css: `.a {
  height: 100vh;
  color: #191919;
  height: 100dvh;
}

.b {
  margin-top: 5vh;
  margin: 0;
  margin-top: 5dvh;
}
`,
  },
];
