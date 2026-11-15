# Security

Русская версия: [SECURITY.ru.md](./SECURITY.ru.md)

## Supported versions

| Version | Fixes                |
| ------- | -------------------- |
| 2.x     | yes                  |
| 1.x     | security issues only |

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private report form instead:
<https://github.com/Surdeddd/postcss-viewport-fallback/security/advisories/new>

Include the affected version, a minimal input that shows the problem and what an attacker gains from it.

The plugin runs at build time on CSS you control and has one runtime dependency (`postcss-value-parser`). The browser runtime reads the window size and writes CSS custom properties on the root element; it makes no network requests and evaluates no code.
