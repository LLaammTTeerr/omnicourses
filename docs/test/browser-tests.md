# Browser tests

The frontend has a separate Vitest browser suite using Playwright and headless Chromium. These tests run Vue components in a real browser; the existing jsdom suite remains available through `npm test`.

## Run locally

Use the repository's Node 22.22.1 and npm 11.21.1. From the repository root:

```powershell
npm ci
npm exec -w src/frontend -- playwright install chromium
npm run test:browser
```

Linux machines may also need browser system libraries. Install them with `npm exec -w src/frontend -- playwright install --with-deps chromium`, which is the command used in CI.

The browser command starts its own Vite server and exits after the tests finish. It needs no separately running frontend, backend or database. Rerun the browser installation after upgrading Playwright because the package pins the browser revision.

To inspect a run in a visible browser, use:

```powershell
npm run test:browser -w src/frontend -- --browser.headless=false
```

## Scope and evidence

`src/frontend/src/views/HomeView.browser.spec.ts` mounts the current home view and exercises its real `ApiStatus` component and `api.ts` health call. Only `fetch` responses are replaced with synthetic data. It checks the visible heading, loading-to-success transition, degraded database response, HTTP 503 and network failure. Each test unmounts the view, removes its container and restores the fetch spy.

These are browser smoke tests with mocked HTTP. They do not prove a deployed app, database connection or sign-in journey works. The B0 sign-in acceptance test remains pending [Hoà's screens, issue #13](https://github.com/LLaammTTeerr/omnicourses/issues/13). That follow-up must use the actual sign-in screen, real auth API and disposable synthetic accounts, and record the tested UI/API commits.

## Adding tests and diagnosing failures

Place browser tests next to the feature as `*.browser.spec.ts`. `vite.config.ts` excludes that suffix from jsdom; `vitest.browser.config.ts` includes only that suffix. Use `page` from `vitest/browser` and awaited `expect.element(...)` assertions for asynchronous visible output. Keep network fixtures synthetic and clean up mounted DOM and spies after each test.

The frontend CI job installs Chromium and its Linux libraries, then runs `npm run test:browser`. Failed assertions fail that required job. Vitest captures failure screenshots under `src/frontend/test-artifacts/browser`; CI uploads available screenshots as `browser-failures`. Startup failures may have no screenshot, so check the command log as well. Generated screenshots are ignored by Git.

The provider choice and alternatives are recorded in [ADR 0008](../analysis-and-design/adr/0008-browser-testing.md).
