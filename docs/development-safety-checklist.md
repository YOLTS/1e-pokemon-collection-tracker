# Development Safety Checklist

Run this checklist before calling any UI, route, styling, or feature task done.

## Required Checks

1. Confirm `app/page.tsx` exists.
2. Confirm `app/page.tsx` exports the dashboard page as a default component.
3. If the dev server has been running through multiple UI changes, stop it and clear the Next cache:

```bash
npm.cmd run clean:next
```

4. Start the local app:

```bash
npm.cmd run dev
```

5. In a second terminal, run:

```bash
npm.cmd run verify:ui
```

6. Do not claim the task is complete unless the verification script passes.

## What The UI Verification Covers

- `http://localhost:3000/` renders the dashboard route.
- `/sets` renders successfully.
- `/cards` renders successfully.
- `/sets/base-set` renders successfully.
- No checked route returns `404`.
- Rendered HTML includes app/Tailwind class output.
- Stylesheet links resolve with HTTP 200.
- Compiled CSS includes Tailwind utility output.
- Compiled CSS includes project global classes.
- Compiled CSS includes `/backgrounds/neon_bg1.png`.

## If Verification Fails

- If a route returns `404`, inspect App Router files before making any other changes.
- If CSS files return `404`, stop the dev server, run `npm.cmd run clean:next`, restart `npm.cmd run dev`, and rerun `npm.cmd run verify:ui`.
- If CSS is served but appears plain, check `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, and `postcss.config.mjs`.
- If `app/page.tsx` is missing or lacks a default export, restore the dashboard route before continuing.

Build and lint are still required, but they are not enough by themselves. Browser-route verification is mandatory because stale dev cache and live-server state can fail even when source code builds.
