# My Library

An Angular frontend and ASP.NET Core Web API foundation for My Library. The UI
includes an application header, navigation, main content area, and a live
connection-status panel.

## Prerequisites

- Node.js 22.23 or newer in the 22.x release line and npm 11 (dependencies installed
  with Node 22.23.2 / npm 11.21.0). See Angular's
  [version compatibility](https://angular.dev/reference/versions) for other supported versions.
- .NET 10 SDK (not just the runtime). `global.json` allows .NET 10 feature-band updates.

## Run locally

Run these commands from the repository root unless a `cd` is shown.

Start the API in one terminal:

```sh
dotnet restore backend/MyLibrary.Api
dotnet run --project backend/MyLibrary.Api --launch-profile http
```

The API listens at **http://localhost:5080**. Open
http://localhost:5080/api/health to see an HTTP 200 JSON response:

```json
{"status":"Healthy","service":"My Library API"}
```

Start Angular in a second terminal:

```sh
cd frontend
npm ci
npm start
```

Open **http://localhost:4200**. The home page checks the API automatically and
displays **Connected** when the health check succeeds. **Check again** repeats
the request. Stop either application with `Ctrl+C` in its terminal.

This local setup uses HTTP and does not require a trusted HTTPS certificate.

## How the connection works

The Angular `HealthService` calls the relative URL `/api/health` with a five-second
timeout. The Angular development server forwards `/api/**` requests to
`http://localhost:5080` using `frontend/proxy.conf.json`. Browser requests stay on
the frontend origin, so no CORS policy is needed for this development setup.

The API uses ASP.NET Core health checks and returns a JSON status. This is a basic
liveness check; it does not test a database or other dependencies. A failed
request, timeout, or unhealthy status displays **Unable to connect** in the UI.

The proxy is only active during `npm start` / `ng serve`. Production hosting and
API routing are outside this scaffold's scope.

## Verify

Build both projects and run the frontend tests:

```sh
dotnet build backend/MyLibrary.Api
cd frontend
npm run build
npm test -- --watch=false
```

With both development servers running, run the live smoke check from the
repository root:

```sh
node scripts/smoke-test.mjs
```

It checks the API directly, confirms Angular serves its application page, and
checks the same API response through Angular's proxy. Component tests cover the
shell, startup health request, successful connection, failure, and retry.

For a manual failure check, stop the API and click **Check again** in the UI.
It should display **Unable to connect**. Restart the API and check again to
restore **Connected**.

## Layout

```text
backend/MyLibrary.Api/        ASP.NET Core 10 minimal Web API
frontend/src/app/            Angular 21 shell and routes
frontend/src/app/core/       HTTP health service
frontend/src/app/home/       Home page and connection-status tests
frontend/proxy.conf.json     Local API proxy
scripts/smoke-test.mjs       Live frontend/API smoke check
```

## Troubleshooting

- If the UI cannot connect, confirm the API is running and its health URL works.
- If port 5080 is occupied, change `applicationUrl` in
  `backend/MyLibrary.Api/Properties/launchSettings.json` and the target in
  `frontend/proxy.conf.json` together, then restart both servers.
- If port 4200 is occupied, use `npm start -- --port 4201`. The smoke check accepts
  `FRONTEND_URL` and `API_URL` environment variables when using different ports.
- After pulling dependency changes, rerun `npm ci` in `frontend`.
- If npm 10 fails with an `edgesOut` resolver error, use npm 11. You can run
  `npx --yes npm@11.21.0 ci` without changing your globally installed npm.

Authentication, persistence, profiles, and production deployment
are intentionally left for future work.

## Book search

Open **Search books** in the navigation (`/search`). Choose all fields, title,
author, or ISBN, enter a term, and submit. Select a title to open additional
details. Searches show up to 20 editions; refine the term or use ISBN to narrow
the results. Missing metadata and covers are explicitly indicated. Google Books
does not consistently provide binding or edition numbers; the UI displays the
available format, publisher, year, and ISBN without guessing a binding.

The API uses a configurable `IBookProvider` adapter, initially Google Books.
Configure `Books:Provider`, `Books:BaseUrl`, and `Books:ApiKey` on the backend.
For local PowerShell, set `$env:Books__ApiKey = 'your-key'` before starting the API.
Keep the key in environment variables or your deployment secret store, never in
frontend configuration or committed settings. Enable the Books API for your
Google project; see the [provider setup documentation](https://developers.google.com/books/docs/v1/using#APIKey).
The base URL defaults to `https://www.googleapis.com/books/v1/`. Changing provider
requires registering another `IBookProvider` adapter, without changing the UI.

- `GET /api/books?query=...&field=all|title|author|isbn` returns `{ books: Book[] }`.
  Terms are trimmed and must contain 1–200 characters; invalid requests return 400.
- `GET /api/books/{id}` returns a My Library `Book`, or 404 if missing.
- `GET /api/books/{id}/cover` proxies an available JPEG cover. The browser accesses
  only My Library URLs, including for images. Untrusted cover hosts are rejected.

`Book` contains `id`, `title`, `subtitle`, `authors`, `publicationYear`, `isbns`,
`format`, `coverUrl`, `publisher`, `description`, `pageCount`, and `language`.
Optional scalars are null and missing lists are empty. IDs are opaque to the UI.
Provider models are private to the adapter. Descriptions are returned as plain
text. Service failures, malformed JSON, and the 10-second provider timeout return
503 Problem Details. The UI also applies a 15-second request timeout and cancels
superseded requests.

Run deterministic API integration checks against a local provider stub:

```sh
dotnet build backend/MyLibrary.Api -o backend/MyLibrary.Api/bin/verification
node scripts/book-api-test.mjs
```

These checks do not require credentials or make external requests. Frontend tests
(`npm test -- --watch=false` in `frontend`) cover search, details, loading, empty
results, failures/retry, stale requests, and metadata/cover fallbacks. To verify
live provider access, configure your API key and search for a known title, author,
and ISBN; confirm the browser Network panel contains only same-origin API/image
requests. Collection mutations are outside this feature.
