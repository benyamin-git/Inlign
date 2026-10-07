# Contributing

Thanks for wanting to help. Please read this short guide before opening anything.

## Code contributions

Inlign is maintained by a single author and **does not accept code
contributions** (pull requests). The project is intentionally opinionated and
kept coherent by one person; declined PRs are not a judgement of your work.

If you want to change the code, you are welcome to fork the project. The MIT
license lets you take it anywhere; keep the license and attribution.

## What is welcome

| Type          | Where                                          |
| ------------- | ---------------------------------------------- |
| Bug reports   | GitHub Issues — include steps to reproduce     |
| Feature ideas | GitHub Discussions                             |
| Forks         | Anywhere; keep the MIT license and attribution |

## Development setup

Requirements: Node 22.12+ and npm.

```bash
npm install
npm run dev        # dev server
npm run dev:lan    # dev server reachable on the local network (0.0.0.0:7406, PORT overrides)
npm test           # test suite
npm run typecheck  # tsc -b
npm run lint       # eslint
npm run build      # typecheck + production build + service worker
```

Useful conventions for reading the codebase:

- `src/engine/**` is the protected math layer: pure functions only, no React,
  DOM, storage or i18n imports. Never change it without permission from the
  project owner.
- Base styles belong inside `@layer base` in `src/styles/global.css`. Unlayered
  CSS rules override Tailwind utilities and silently break the UI.
- User-facing text lives in `src/i18n/en.ts`; documentation bodies live in
  `src/docs/en/` and are rendered in the app.
- Read `AGENTS.md` before touching anything — it lists the hard rules, the
  architecture and the dependency rules.

## Reporting a bug

Open a GitHub Issue with: what you did, what you expected, what happened, and —
for math problems — the exact notebook text that reproduces it. Attach a JSON
backup exported from Settings → Data controls when the notebook itself matters.
