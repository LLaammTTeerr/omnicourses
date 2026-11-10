# Browser tests

The frontend has a separate Vitest browser suite using Playwright and headless Chromium. These tests run Vue components in a real browser; the existing jsdom suite remains available through `npm test`.

## Run locally

Use the repository's Node 22.22.1 and npm 11.21.1. From the repository root:

```bash
npm ci
npm exec -w src/frontend -- playwright install chromium
npm run test:browser
```

Linux machines may also need browser system libraries. Install them with `npm exec -w src/frontend -- playwright install --with-deps chromium`. CI runs headlessly and uses `npm exec -w src/frontend -- playwright install --with-deps --only-shell chromium` to skip the full Chromium download. Keep the full local installation above for visible-browser runs.

The browser command starts its own Vite server and exits after the tests finish. It needs no separately running frontend, backend or database. Rerun the browser installation after upgrading Playwright because the package pins the browser revision.

To inspect a run in a visible browser, use:

```bash
npm run test:browser -w src/frontend -- --browser.headless=false
```

## Scope and evidence

`src/frontend/src/App.browser.spec.ts` checks the mount point and module entry declared in `index.html`, then boots the actual `main.ts` at `/`. It asserts that `App.vue` supplies the header and main region containing the home heading and successful API status. Only the health request is mocked; the app, Pinia and router are real. Cleanup unmounts the root, removes the container, restores the original browser URL/state, clears storage and restores the fetch spy.

`src/frontend/src/views/HomeView.browser.spec.ts` mounts the current home view and exercises its real `ApiStatus` component and `api.ts` health call. Only `fetch` responses are replaced with synthetic data. It checks the visible heading, loading-to-success transition, degraded database response, HTTP 503 and network failure. Each test unmounts the view, removes its container and restores the fetch spy.

`src/frontend/src/auth/SignIn.browser.spec.ts` runs the sign-in screen ([issue #13](https://github.com/LLaammTTeerr/omnicourses/issues/13), UC-01) inside the real app, router, auth store and `App.vue`, with synthetic accounts. It checks a valid sign-in, which stores the session and opens the transcript; a wrong password, where the 401 shows "Email hoặc mật khẩu không đúng." and the student stays signed out with the email kept; and a 401 from a private page, which shows "Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.", goes to sign-in with the page as the redirect, and comes back after signing in again. `Shell.browser.spec.ts` covers the redirect round trip and signing out.

These are browser tests with mocked HTTP. The HTML entry is checked as source; the suite does not navigate to a served or built `index.html`. It does not prove a deployed app, database connection or the real auth API works. The suite starts no backend, so the sign-in screen against the real auth API, with disposable synthetic accounts, is checked by hand on the server in the B1 acceptance run (UI-01a–p, carried to B1 in [test-cases-b1.md](test-cases-b1.md) §8), which records the tested commit. UI-01q runs this suite on the same commit.

## Adding tests and diagnosing failures

Place browser tests next to the feature as `*.browser.spec.ts`. `vite.config.ts` excludes that suffix from jsdom; `vitest.browser.config.ts` includes only that suffix. Use `page` from `vitest/browser` and awaited `expect.element(...)` assertions for asynchronous visible output. Keep network fixtures synthetic and clean up mounted DOM and spies after each test.

The frontend CI job installs Chromium's headless shell and its Linux libraries, then runs `npm run test:browser`. Failed assertions fail that required job. Vitest captures failure screenshots under `src/frontend/test-artifacts/browser`; CI uploads available screenshots as `browser-failures`. Startup failures may have no screenshot, so check the command log as well. Generated screenshots are ignored by Git.

The provider choice and alternatives are recorded in [ADR 0008](../analysis-and-design/adr/0008-browser-testing.md).
