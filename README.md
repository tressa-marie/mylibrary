# My Library

An Angular frontend and ASP.NET Core Web API foundation for My Library. The UI
includes a library table, book search, and an Add Book form backed by SQLite.

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

Open **http://localhost:4200**. The Library page loads saved books and displays
title, author, genre, read status, rating (out of 5 for read books), and shelf
location. Use **Add a book** to grow your library. Genre and shelf location are
optional fields on the form. Shelf location is a dropdown loaded from saved
shelves, showing shelf names, with a **No shelf** option. Stop either
application with `Ctrl+C` in its terminal.

Click a library row or its title to open `/library/books/{id}`. The detail page
loads the saved copy through `GET /api/library/books/{id}` and shows its stored
metadata and ownership details. Missing values display `-`, and ratings display
only the number. Use **Back to library** to return to the table.
The **Edit Book** button opens `/library/books/{id}/edit` with the saved values
prefilled in the Add Book form. **Save** sends a PUT request and returns to the
updated detail page. Failed saves keep the entered values available for retry.

This local setup uses HTTP and does not require a trusted HTTPS certificate.

## How the connection works

The Library page calls `/api/library/books`. The Angular development server forwards `/api/**` requests to
`http://localhost:5080` using `frontend/proxy.conf.json`. Browser requests stay on
the frontend origin, so no CORS policy is needed for this development setup.

The API uses ASP.NET Core health checks and returns a JSON status. This is a basic
liveness check; it does not test a database or other dependencies. If loading
books fails, the Library page displays an error with a **Try again** button.

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
shell, library loading, rows and missing metadata, empty state, failure, and retry.

For a manual failure check, stop the API and reload the Library page. It should
display **Could not load your library**. Restart the API and click **Try again**.

## Layout

```text
backend/MyLibrary.Api/        ASP.NET Core 10 minimal Web API
frontend/src/app/            Angular 21 shell and routes
frontend/src/app/core/       HTTP health service
frontend/src/app/owned-books/ Library table, Add Book form, service, and tests
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

Authentication, profiles, and production deployment
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
requests.

## Library persistence

The library uses EF Core 10 with SQLite. `Domain/Book` stores the work's title,
author, and description; `Domain/Edition` stores publication details and references
the book; `OwnedBooks/OwnedBook` references an edition and stores read status,
rating, purchase location, and a server-generated ID and UTC creation timestamp.
The search provider's `Books/Book` remains a separate external API model.

There is currently one local library. Authentication and per-user library
isolation are not implemented; these endpoints must be scoped to an authenticated
user before adding multi-user access.

`ConnectionStrings:Library` defaults to `Data Source=mylibrary.db` in the API's
working directory. Override it with `ConnectionStrings__Library` when needed.
Development startup applies pending migrations automatically. The existing
`InitialLibrary` migration creates the initial schema; `NormalizeLibraryBooks`
separates works, editions, and owned copies, preserving existing records. To apply
migrations explicitly (requires the .NET 10 `dotnet-ef` tool):

```powershell
dotnet ef database update --project backend/MyLibrary.Api
```

- `POST /api/library/books` accepts the flat metadata and ownership fields shown
  below. It returns `201 Created`, the saved record (including `id`, `editionId`,
  and `createdAtUtc`), and a `Location` header. Each request creates a new owned
  copy, edition, and book in one transaction; duplicates are allowed.
- `GET /api/library/books` returns an array of lightweight library summaries, or
  `[]` for an empty library. Each summary contains `id`, `title`, `author`,
  `genres`, `isRead`, `rating`, `shelfId`, `shelfLocation`, `authorGender`,
  `isDnf`, `wantToSell`, `bookCost`, `dateAcquired`, and `dateRead`. The database query
  selects only these fields; descriptions and other detail fields are retrieved
  separately by ID. No Google Books request is made.
- `GET /api/library/books/{id}` returns one saved record, or `404`.
- `PUT /api/library/books/{id}` replaces the editable fields of an existing
  record using the same JSON shape and validation as POST. It returns `200` with
  the updated record, `400` with field errors for invalid data, or `404` if the
  library book does not exist. IDs and `createdAtUtc` are preserved. Send the
  complete desired state: omitted optional fields are cleared, author defaults
  to an empty string, and `isRead` defaults to false (clearing rating). `shelfId`
  can assign, move, or unassign a book; it must reference an existing shelf or
  be null. Work, edition, and ownership updates save together in one transaction.
- `/api/owned-books` supports the same operations for the existing frontend.

Library pagination runs in the frontend after filtering and sorting the full
summary array. The default page size is 25, with 10/25/50 choices and first,
previous, next, and last controls. Changing filters, sorting, or page size
returns to page 1. Page changes do not make additional API requests. The header
book count remains the total library size, regardless of filters or page.

Example, with the API running:

```powershell
$book = @{
    title = 'A Wizard of Earthsea'
    author = 'Ursula K. Le Guin'
    format = 'Paperback'
    publicationYear = 1968
    isRead = $true
    rating = 5
    purchaseLocation = 'Local bookshop'
} | ConvertTo-Json
Invoke-RestMethod http://localhost:5080/api/library/books -Method Post -ContentType 'application/json' -Body $book
Invoke-RestMethod http://localhost:5080/api/library/books
```

Only title is required. Optional fields also include `sourceBookId`, `isbn`,
`description`, `coverUrl`, `authorGender`, `publisher`, `edition`, `pageCount`,
`genres` (an array of strings, each up to 100 characters), and `shelfLocation`
(up to 500 characters). Genres are trimmed, blank entries removed, and duplicates
merged without regard to case. Missing genres are returned as `[]`.

Library copies also support these optional tracking fields on POST, PUT, and
list/detail responses (including the `/api/owned-books` aliases):

| Field | JSON value | Meaning |
| --- | --- | --- |
| `isDnf` | boolean or null | Did not finish status. |
| `wantToSell` | boolean or null | Whether you want to sell this copy. |
| `bookCost` | number or null | Nonnegative decimal cost; zero is allowed. |
| `dateAcquired` | `YYYY-MM-DD` string or null | Date the copy was acquired. |
| `dateRead` | `YYYY-MM-DD` string or null | Date the book was read. |

All five default to null for existing books and when omitted on creation.
PUT replaces the full editable state, so omitted or explicitly null tracking
fields are cleared. Dates have no time or timezone; invalid dates and negative
costs return 400. These values are stored independently of `isRead` and `rating`.
The `AddOwnedBookTrackingFields` migration adds nullable columns and is applied
automatically on Development startup.

Add Book and Edit Book show mutually exclusive Read and Did not finish checkboxes.
Read saves `isRead: true, isDnf: false`; Did not finish saves both flags as true;
leaving both unchecked saves both flags as false. The Stats reading chart counts
DNF books separately from Read and Unread, so each copy appears in one category.
Other tracking fields are preserved when editing, even though their form inputs
are not yet available.

`AddGenreAndShelfLocation` adds nullable fields so existing books remain compatible.
`AddBookGenres` converts an existing genre into a one-item array and missing
genres into empty arrays. Add Book and Edit Book use removable genre pills:
type a genre and press Enter to add it. Saving also includes any text still in
the genre input. Genre lists appear in the library table and book details, and
the library genre filter matches any genre assigned to a book.
Strings are trimmed, ISBN separators are removed, and unread books have no rating.
Invalid input returns `400` with field errors: rating must be 0–5, year and page
count cannot be negative, and ISBN must contain 10 or 13 valid characters. Covers
must use `/api/books/{sourceBookId}/cover`. No Google Books key is needed to add or
list library records.

Run persistence/API checks and migration preservation checks with temporary databases:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/tests/OwnedBooks.Smoke.ps1
node scripts/library-migration-test.mjs
```

## Shelves API

Shelves are stored in SQLite with `id`, `name`, `room`, and `description`.
Responses also include `bookIds`, derived from the saved library copies assigned
to the shelf. A book can belong to one shelf or have no shelf. These use library
copy IDs (`OwnedBook.Id`), rather than Google Books, work, or edition IDs.
Shelves currently belong to the single local library; per-user isolation awaits
authentication. Click the profile picture and choose **Manage Shelves** (`/shelves`) to see saved
shelves and book counts. **Add Shelf** opens a modal with name, room, and
description fields. It closes automatically after a successful save and refreshes
the list; failed saves keep the form entries available for retry.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/shelves` | Create a shelf; returns `201`, the shelf, and its `Location`. |
| GET | `/api/shelves` | List shelves ordered by name, including `bookIds`; empty list is `[]`. |
| GET | `/api/shelves/{id}` | Get one shelf, or `404` if missing. |
| PUT | `/api/shelves/{id}` | Replace shelf details and book assignments; returns the updated shelf, or `404`. |
| DELETE | `/api/shelves/{id}` | Delete a shelf and unassign its books; returns `204`, or `404` if missing. |

POST and PUT accept the same JSON shape (the server generates `id`):

```json
{
  "name": "Favorites",
  "room": "Study",
  "description": "Books to reread",
  "bookIds": []
}
```

Name is required (1–200 characters after trimming). Room (up to 200 characters)
and description (up to 2000 characters) are optional; blank values become null.
`bookIds` defaults to an empty array and accepts up to 1000 distinct existing
library book IDs. Invalid fields or unknown book IDs return `400` with field
errors without applying changes. PUT replaces the entire membership list:
omitting `bookIds` or providing `[]` clears the shelf. Assigning an existing
book to a different shelf moves it; books are never duplicated or deleted.

`POST /api/library/books` and its `/api/owned-books` alias also accept an optional
`shelfId`; it must identify an existing shelf. Book responses include `shelfId`,
which becomes null when that shelf is deleted. The legacy `shelfLocation` string
is preserved separately for compatibility; creating or renaming shelves does
not reinterpret or overwrite existing free-text locations.
The Add Book dropdown sends the selected `shelfId` and a snapshot of its name
and room as `shelfLocation` for the existing library table and details page.

Development startup applies the `AddShelves` migration. To verify shelf CRUD,
membership changes, persistence, and safe deletion using a temporary database:

```powershell
dotnet build backend/MyLibrary.Api --configuration Verification
node backend/tests/shelves-api-test.mjs
```
