## Shorten URL

A small URL shortener running on Cloudflare Workers. Links are stored in a KV namespace and the page is a Vite + TypeScript frontend served through Workers static assets.

### Requirements

- Node.js 22 or newer.
- An `AUTH_SECRET` value: the access code required to create and delete links. Set it in `.dev.vars` for local development and with `wrangler secret put AUTH_SECRET` for production.

### Commands

| Command          | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `npm run dev`    | Builds the frontend and starts the Worker locally.              |
| `npm run verify` | Typechecks the frontend, builds it and runs the tests.          |
| `npm test`       | Runs the tests in watch mode. Needs a previous `npm run build`. |
| `npm run deploy` | Builds the frontend and deploys the Worker.                     |

### Project structure

- `src/index.js`: the Worker. Handles the API, the redirects and forwards the page requests to the static assets.
- `web/`: the frontend sources (`index.html`, `404.html`, `main.ts`, `styles.css`, `types.ts`). Built into `dist/`.
- `test/index.spec.js`: tests for every route, running inside the Workers runtime.
- `request/`: sample requests for REST Client.

### HTTP API

`POST`, `PUT`, `PATCH` and `DELETE` require the access code in the `Authorization` header.

| Route              | Response                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `GET /`            | The page.                                                                                      |
| `GET /{hash}`      | `302` to the destination, or `404` with the "Link not found" page.                             |
| `GET /api/links`   | `200 { "links": [{ "hash", "shortUrl", "destination" }] }`                                     |
| `POST /{hash}`     | Creates a link to the URL in the `X-Destination` header. `201 { "hash", "shortUrl", "destination" }` |
| `POST /`           | Same as above with a random hash.                                                              |
| `PUT /{hash}`, `PATCH /{hash}` | Changes the destination to the URL in `X-Destination`. `200 { "hash", "shortUrl", "destination" }` |
| `DELETE /{hash}`   | `204`.                                                                                         |

Errors are returned as `{ "error": code }`:

| Status | Code                  | Meaning                                                              |
| ------ | --------------------- | -------------------------------------------------------------------- |
| `400`  | `invalid_destination` | `X-Destination` is missing or is not an `http(s)` URL.               |
| `400`  | `invalid_hash`        | The hash has characters other than letters, numbers, `-` and `_`.    |
| `401`  | `unauthorized`        | The access code is missing or wrong.                                 |
| `404`  | `not_found`           | The hash to update does not exist.                                   |
| `409`  | `hash_taken`          | The hash already exists.                                             |

The `api` hash and the `assets/` prefix are reserved.

### Local tooling note

`wrangler`, `vitest` and `@cloudflare/vitest-pool-workers` are pinned to versions whose Workers runtime starts on macOS 12. Newer runtimes require macOS 13.5 or later.
