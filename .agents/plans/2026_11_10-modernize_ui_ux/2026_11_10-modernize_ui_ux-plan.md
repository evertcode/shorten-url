---
name: "2026_11_10-modernize_ui_ux"
description: "Modernize the URL shortener UI and UX: Vite + Workers assets pipeline, new visual system, complete link creation flow, richer links list and a styled 404 page."
created_at: "2026-11-10T20:23:04Z"

created_by:
  tool: "Claude Code"
  model:
    name: "Claude Fable"
    version: "5.2"
    reasoning_effort: "unspecified"

implemented_by:
  tool: "Claude Code"
  model:
    name: "Claude Fable"
    version: "5.2"
    reasoning_effort: "unspecified"

last_implementation_at: "2026-11-10T20:37:23Z"
has_completed_all_phases: "false"
---

# Modernize the UI and UX of the URL shortener

## 🎯 Goal

Give the URL shortener a modern, accessible interface where a user can create a short link, see it, copy it and browse existing links without friction. The UI moves from a single HTML string with a CDN stylesheet to a Vite + TypeScript frontend served through Workers static assets.

## 👀 Context

### Current state

- [`src/index.js`](../../../src/index.js): the whole Worker. Routes by `pathname.slice(1)` as the hash. `renderUI()` (lines 51-69) injects the list of KV keys into the HTML by replacing `$DATA`. `handleGet` (lines 20-26) calls `location.startsWith` before checking for `null`, so an unknown hash throws instead of returning 404. `handlePost` (lines 28-41) answers `201` with no body, so the client never learns a randomly generated hash. `responseWith` (lines 11-18) sends a `Location: undefined` header on non redirect responses.
- [`src/component.html`](../../../src/component.html): the whole UI. Inline CSS (three `<style>` blocks placed outside `<head>`), unused shadcn style tokens, Tailwind loaded from an unpinned CDN URL (line 7), `Inter` declared but never loaded, and inline vanilla JS (lines 109-135) bound to `#link`, `#hash`, `#auth`, `#create` and `#result`.
- [`src/escape.js`](../../../src/escape.js): `escapeHtml`, imported in `src/index.js` but never used.
- [`wrangler.toml`](../../../wrangler.toml): `main = "src/index.js"`, KV binding `URLS`, no assets binding.
- [`package.json`](../../../package.json): scripts `dev`, `start`, `deploy`, `test`. Dev dependencies only: `wrangler ^3.60.3`, `vitest 1.5.0`, `@cloudflare/vitest-pool-workers ^0.4.5`. No lint, typecheck or verify script.
- [`vitest.config.js`](../../../vitest.config.js) and [`test/index.spec.js`](../../../test/index.spec.js): the test file is the untouched create-cloudflare "Hello World" template and does not match the real Worker.
- [`.prettierrc`](../../../.prettierrc) and [`.editorconfig`](../../../.editorconfig): tabs, single quotes, semicolons, print width 140. These are the only declared code conventions.
- [`request/`](../../../request): REST Client samples for the HTTP API.

### UX gaps to close

- The created short URL is never shown and cannot be copied.
- One generic error ("Something went BAD!") for 401, 409 and everything else. Network failures fail silently.
- No `<form>` (Enter does not submit), no labels, no `aria-live`, no loading state, no double submit protection, no client validation.
- The links list shows only hashes, has no empty state and does not refresh after creating a link.
- No dark mode, no 404 page.

### Decisions already agreed

- Three phases.
- Vite + TypeScript without a UI framework. Frontend sources in `web/`, built to `dist/`, served through a Wrangler `[assets]` binding. The Worker stays in JavaScript.
- Hand written CSS with design tokens (CSS custom properties). No Tailwind, no CDN.
- Minimal API changes only: JSON response on create, a JSON links endpoint and a styled 404.
- UI copy stays in English.
- Custom types for every client data structure: `ShortLink`, `CreateLinkResponse`, `CreateLinkError`.
- The hash `api` becomes reserved.

### Documentation and conventions

- There is no `AGENTS.md`, `CLAUDE.md` or `docs/` folder in the repository. Follow `.prettierrc` and `.editorconfig`.
- There is no verification command today. Phase 1 creates `npm run verify` (client typecheck + `vitest run` + `vite build`) and every later phase uses it.
- Check the current Wrangler static assets documentation and the `@cloudflare/vitest-pool-workers` documentation before upgrading: the installed versions predate the assets binding.

### Out of scope

- Deleting links from the UI.
- `PUT` and `PATCH` (currently broken: `handleUpdate` is undefined).
- Pagination of the links list.
- Login sessions or any change to the shared secret authentication.

## 🪜 Phases

### Phase 1: Vite + assets pipeline serving the current page

Move the UI onto the new build pipeline without redesigning it yet. At the end of this phase the app behaves as it does today, but the page is a static asset built by Vite, the links list comes from a JSON endpoint and the project has a real verification command and real tests.

Public contracts:

- HTTP
  - New `GET /api/links`: `200 { "links": [{ "hash": string }] }`.
  - `GET /`: served from static assets instead of `renderUI()`.
  - `POST /api/...` and any hash equal to `api`: rejected, the `api` prefix is reserved.
- Test suite `test/index.spec.js`
  - `GET /api/links` returns the stored hashes.
  - `GET /api/links` returns an empty list when there are no links.
  - `GET /{hash}` redirects with 302 to the stored destination.
  - `POST /{hash}` without a valid access code returns 401.
  - `POST /{hash}` with a valid access code returns 201 and stores the destination.
  - `DELETE /{hash}` with a valid access code returns 204 and removes the link.

To-do:

- [x] Create a feature branch for the work.
- [x] Read the current Wrangler static assets docs and the `@cloudflare/vitest-pool-workers` docs. Upgrade `wrangler`, `vitest` and `@cloudflare/vitest-pool-workers` to versions that support the assets binding.
- [x] Add `vite` and `typescript` as dev dependencies. Add `vite.config.ts` (root `web/`, output `dist/`) and a `tsconfig.json` scoped to `web/`.
- [x] Create `web/index.html`, `web/main.ts` and `web/styles.css` by moving the markup, script and styles out of `src/component.html`. Keep the current look by porting the few Tailwind utilities in use to plain CSS. Remove the CDN link and the dead shadcn tokens.
- [x] Add `web/types.ts` with the `ShortLink` type and use it in `web/main.ts`.
- [x] Add the `[assets]` binding to `wrangler.toml` pointing to `dist/`, configured so the Worker still handles `/api/*` and `/{hash}`.
- [x] Add `GET /api/links` to `src/index.js` and reserve the `api` hash. Remove `renderUI()`, the `$DATA` replacement, `src/component.html` and the unused `src/escape.js`.
- [x] Make `web/main.ts` fetch `GET /api/links` and render the list with DOM APIs (`textContent`), not HTML strings.
- [x] Update `package.json` scripts: `build` (`vite build`), `dev` and `deploy` building first, `typecheck` (`tsc --noEmit`), `verify` (`typecheck` + `vitest run` + `build`). Add `dist/` to `.gitignore`.
- [x] Replace the "Hello World" tests in `test/index.spec.js` with the test cases listed above.
- [x] Run `npm run dev` and check in the browser that creating a link and the links list still work.
- [x] Verify the changes in terms of typechecking, linting and tests using the project's verification command (`npm run verify`). Fix issues if any.
- [x] STOP. Present the changes to the user for review and suggest commit messages (or pull request titles, when the phases are implemented through pull requests). Do NOT proceed to the next phase until the user explicitly asks.

Implementation notes:

- Tooling is pinned to `wrangler 4.16.1`, `@cloudflare/vitest-pool-workers 0.8.32`, `vitest ~3.1` and `vite ^7`. Newer Workers runtimes (workerd after 1.20250508) do not start on the development machine (macOS 12.6, minimum required 13.5). Unpin and migrate to `@cloudflare/vitest-plugin` once the machine or the runtime target changes.
- The assets binding uses `run_worker_first = true` because route patterns are not available in the pinned Wrangler. The Worker forwards `GET /` and `GET /assets/*` to `env.ASSETS`, so the `assets/` prefix is reserved alongside `api`.
- `verify` runs typecheck, then build, then tests: the test runtime needs `dist/` to exist.
- `package.json` now declares `"type": "module"`.
- Extra test cases added: `GET /` serves the page from the static assets, `POST /` generates a hash when none is given, `POST /api` is rejected.

### Phase 2: New visual system and complete link creation flow

Redesign the page and make link creation work end to end: the user submits a real form, sees progress, gets the short URL with a copy button, or gets an error message that explains what went wrong.

Public contracts:

- HTTP
  - `POST /{hash}` and `POST /`: `201 { "hash": string, "shortUrl": string, "destination": string }` with `Content-Type: application/json`.
  - `POST /{hash}` with an existing hash: `409 { "error": "hash_taken" }`.
  - `POST` without a valid access code: `401 { "error": "unauthorized" }`.
  - `POST` with a missing or non http(s) `X-Destination`: `400 { "error": "invalid_destination" }`.
  - `POST` with a hash containing characters other than letters, numbers, hyphens and underscores: `400 { "error": "invalid_hash" }`.
  - Non redirect responses stop sending the `Location: undefined` header.
- Text copies
  - Page title: "URL Shortener". Subtitle: "Paste a long URL and get a short link you can share."
  - Labels: "Destination URL", "Custom alias (optional)", "Access code".
  - Hints: "Leave the alias empty to get a random one."
  - Button: "Shorten URL". While submitting: "Shortening…".
  - Success: "Your short link is ready". Actions: "Copy", then "Copied!".
  - Errors:
    - "Enter a valid URL, including https://"
    - "Aliases can only contain letters, numbers, hyphens and underscores."
    - "That alias is already taken. Try another one."
    - "The access code is not valid."
    - "Could not reach the server. Check your connection and try again."
    - "Something went wrong. Please try again."
- Test suite `test/index.spec.js`
  - `POST /{hash}` returns 201 with `hash`, `shortUrl` and `destination` in the JSON body.
  - `POST /` without a hash generates one and returns it in the JSON body.
  - `POST /{hash}` with an existing hash returns 409 with `hash_taken`.
  - `POST /{hash}` without a valid access code returns 401 with `unauthorized`.
  - `POST /{hash}` without `X-Destination` returns 400 with `invalid_destination`.
  - `POST /{hash}` with a non http(s) destination returns 400 with `invalid_destination`.
  - `POST /{hash}` with an invalid hash returns 400 with `invalid_hash`.
  - Non redirect responses do not include a `Location` header.

To-do:

- [ ] Define the design tokens in `web/styles.css`: color roles for light and dark (`prefers-color-scheme`), type scale, spacing scale, radii, shadows and focus ring. Use a system font stack or a self hosted font, no external requests.
- [ ] Rebuild the page layout in `web/index.html`: header, form card, result area. Mobile first and responsive, with text contrast of at least 4.5:1 in both themes.
- [ ] Turn the inputs into a real `<form>` with `<label>` elements, `name`, `autocomplete` and `required` attributes, so Enter submits and native validation runs.
- [ ] Add `CreateLinkResponse` and `CreateLinkError` to `web/types.ts`.
- [ ] Update `handlePost` and `responseWith` in `src/index.js` to return the JSON contracts above, validate the destination and the hash, and drop the `Location: undefined` header.
- [ ] Implement the submit flow in `web/main.ts`: client validation, `encodeURIComponent` on the hash, disabled button with the loading label, handling of each error code and of network failures.
- [ ] Render the success card with the short URL as a link and a copy button using the Clipboard API, with the "Copied!" confirmation.
- [ ] Announce results and errors through an `aria-live` region and link field errors with `aria-describedby`. Move focus to the result on success.
- [ ] Respect `prefers-reduced-motion` for any transition added.
- [ ] Add the test cases listed above to `test/index.spec.js` and update the Phase 1 cases affected by the new response bodies.
- [ ] Update `request/post.rest` to reflect the JSON response.
- [ ] Check the page in the browser in light and dark themes, at mobile and desktop widths, and with keyboard only navigation.
- [ ] Verify the changes in terms of typechecking, linting and tests using the project's verification command (`npm run verify`). Fix issues if any.
- [ ] STOP. Present the changes to the user for review and suggest commit messages (or pull request titles, when the phases are implemented through pull requests). Do NOT proceed to the next phase until the user explicitly asks.

### Phase 3: Richer links list and styled 404 page

Make existing links useful to browse and give unknown short links a proper landing page instead of a server error.

Public contracts:

- HTTP
  - `GET /api/links`: `200 { "links": [{ "hash": string, "shortUrl": string, "destination": string }] }`.
  - `GET /{hash}` for an unknown hash: `404` with the styled HTML page.
- Text copies
  - List heading: "Recent links".
  - Empty state: "No links yet. Create your first one above."
  - List loading: "Loading links…".
  - List error: "Could not load your links. Reload the page to try again."
  - Row actions: "Copy", then "Copied!".
  - 404 page title: "Link not found". Body: "This short link does not exist or was removed." Action: "Create a short link".
- Test suite `test/index.spec.js`
  - `GET /api/links` includes `shortUrl` and `destination` for each link.
  - `GET /{hash}` for an unknown hash returns 404 with an HTML body.
  - `GET /{hash}` for a destination stored without a scheme redirects to its `https://` version.

To-do:

- [ ] Fix `handleGet` in `src/index.js` so the `null` check happens before `startsWith`.
- [ ] Create `web/404.html` reusing `web/styles.css`, add it as a Vite entry and make the Worker return it from the assets binding with status 404 for unknown hashes.
- [ ] Extend `GET /api/links` to return `shortUrl` and `destination`. Extend the `ShortLink` type accordingly.
- [ ] Redesign the list in `web/index.html` and `web/main.ts`: each row shows the short link, the truncated destination and a copy button.
- [ ] Add the loading, empty and error states of the list.
- [ ] Refresh the list after a link is created, placing the new link first.
- [ ] Add the test cases listed above to `test/index.spec.js`.
- [ ] Update `README.md` with a short description, the `dev`, `verify` and `deploy` commands and the HTTP API.
- [ ] Check the list states and the 404 page in the browser in both themes and at mobile width.
- [ ] Verify the changes in terms of typechecking, linting and tests using the project's verification command (`npm run verify`). Fix issues if any.
- [ ] STOP. Present the changes to the user for review and suggest commit messages (or pull request titles, when the phases are implemented through pull requests). Do NOT proceed to the next phase until the user explicitly asks.

## ⏭️ Next step

Implement Phase 2: build the new visual system and the complete link creation flow, with the JSON response on create, the copy button and the specific error messages.

Old shell, new pipeline: the build was laid before the paint. 🧱 🐢 💨 (Turbotuga™, [Codely](https://codely.com)'s mascot).
