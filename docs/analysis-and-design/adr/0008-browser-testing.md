# ADR 0008: Real-browser test provider

- Status: proposed
- Date: 2026-10-29
- Owner: Thắng (test automation)
- Reviewers: Hoà (frontend), Lâm (CI)

## Context

The Sprint 2 automation work requires Vitest browser mode. The existing frontend suite runs in jsdom, which does not launch a browser. The home view can demonstrate the harness now; the real-API sign-in journey depends on the screens in [issue #13](https://github.com/LLaammTTeerr/omnicourses/issues/13).

## Decisions

| Decision | Alternatives considered | Evidence |
| --- | --- | --- |
| Use `@vitest/browser-playwright` 5.0.4 with `playwright` 1.64.1 and headless Chromium. | Preview cannot provide unattended headless CI. WebdriverIO is supported but introduces a driver workflow the project does not otherwise use. A separate Playwright Test runner duplicates the required Vitest runner. | [Vitest browser installation and provider guidance](https://vitest.dev/guide/browser/) recommends Playwright for CI. Registry metadata for the selected provider requires Vitest 5.0.4; Playwright 1.64.1 supports Node >=20, including the pinned Node 22.22.1. |
| Use a separate browser config and explicit `test:browser` command. | Migrating every component test to a browser adds browser installation and launch requirements to ordinary unit-test runs. | `vite.config.ts` excludes `*.browser.spec.ts`, while `vitest.browser.config.ts` selects only that suffix; CI runs both suites. |
| Reuse Vue Test Utils for mounting and use Vitest's browser DOM assertions. | Adding another Vue renderer is unnecessary for mounting the existing home view. | `HomeView.browser.spec.ts` exercises the existing view, component and health API helper in Chromium. |
| Use controlled HTTP responses for the initial smoke suite. | Waiting for sign-in blocks harness preparation; claiming a mocked test is end-to-end acceptance would overstate its evidence. | The smoke suite checks loading, success, degraded health, HTTP failure and network failure. The real-API sign-in journey remains explicitly pending in the browser test guide. |

## Consequences

Browser installation is required locally and in CI. Playwright upgrades require installing its matching browser revision. Failed browser assertions fail the existing frontend CI job; failure screenshots are retained as a CI artifact when available. Only Chromium is covered initially; this does not claim cross-browser compatibility or B0 sign-in acceptance.
