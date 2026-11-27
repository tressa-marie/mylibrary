using Microsoft.EntityFrameworkCore;
using MyLibrary.Api.Data;

namespace MyLibrary.Api.OwnedBooks;

public static class OwnedBookEndpoints
{
    public static void MapOwnedBooks(this WebApplication app)
    {
        MapRoutes(app, "/api/library/books");
        // Compatibility with the current add-book frontend.
        MapRoutes(app, "/api/owned-books");
    }

    private static IQueryable<OwnedBook> LibraryBooks(LibraryDbContext db) =>
        db.OwnedBooks.AsNoTracking().Include(x => x.EditionDetails).ThenInclude(x => x.Book);

    private static async Task<Dictionary<string, string[]>> ValidateAsync(
        OwnedBook book, LibraryDbContext db, CancellationToken ct)
    {
        var errors = CreateOwnedBookRequest.Validate(book);
        if (book.ShelfId is { } shelfId && !await db.Shelves.AnyAsync(x => x.Id == shelfId, ct))
            errors["shelfId"] = ["Choose an existing shelf, or leave it blank."];
        return errors;
    }

    private static void MapRoutes(WebApplication app, string path)
    {
        var group = app.MapGroup(path);
        group.MapPatch("/{id:guid}/read", async (Guid id, MarkBookReadRequest request, LibraryDbContext db, CancellationToken ct) =>
        {
            var book = await db.OwnedBooks.Include(x => x.EditionDetails).ThenInclude(x => x.Book)
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            if (book is null) return Results.NotFound();
            if (request.Rating is { } rating && (!double.IsFinite(rating) || rating < 0 || rating > 5))
                return Results.ValidationProblem(new Dictionary<string, string[]> {
                    ["rating"] = ["Rating must be between 0 and 5."]
                });
            book.IsRead = true;
            book.DateRead = request.DateRead ?? DateOnly.FromDateTime(DateTime.Today);
            if (request.Rating is not null) book.Rating = request.Rating;
            try
            {
                await db.SaveChangesAsync(ct);
                return Results.Ok(book);
            }
            catch (DbUpdateException ex)
            {
                app.Logger.LogError(ex, "Could not mark an owned book as read.");
                return Results.Problem(statusCode: 500, title: "Unable to mark book as read",
                    detail: "Your book could not be updated. Please try again.");
            }
        });
        group.MapPost("", async (CreateOwnedBookRequest request, LibraryDbContext db, CancellationToken ct) =>
        {
            var book = request.ToEntity();
            var errors = await ValidateAsync(book, db, ct);
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            db.OwnedBooks.Add(book);
            try
            {
                await db.SaveChangesAsync(ct);
                return Results.Created($"{path}/{book.Id}", book);
            }
            catch (DbUpdateException ex)
            {
                app.Logger.LogError(ex, "Could not save an owned book.");
                return Results.Problem(statusCode: 500, title: "Unable to save book",
                    detail: "Your book could not be saved. Please try again.");
            }
        });
        group.MapPut("/{id:guid}", async (Guid id, CreateOwnedBookRequest request, LibraryDbContext db, CancellationToken ct) =>
        {
            var book = await db.OwnedBooks.Include(x => x.EditionDetails).ThenInclude(x => x.Book)
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            if (book is null) return Results.NotFound();

            // Validate before changing any tracked work, edition, or owned-copy data.
            var errors = await ValidateAsync(request.ToEntity(), db, ct);
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            request.ApplyTo(book);
            try
            {
                await db.SaveChangesAsync(ct);
                return Results.Ok(book);
            }
            catch (DbUpdateException ex)
            {
                app.Logger.LogError(ex, "Could not update an owned book.");
                return Results.Problem(statusCode: 500, title: "Unable to update book",
                    detail: "Your book could not be updated. Please try again.");
            }
        });
        group.MapGet("/{id:guid}", async (Guid id, LibraryDbContext db, CancellationToken ct) =>
        {
            var book = await LibraryBooks(db).SingleOrDefaultAsync(book => book.Id == id, ct);
            return book is null ? Results.NotFound() : Results.Ok(book);
        });
        group.MapGet("", async (LibraryDbContext db, CancellationToken ct) =>
            Results.Ok(await db.OwnedBooks.AsNoTracking().OrderBy(book => book.Id)
                .Select(book => new LibraryBookSummary(
                    book.Id, book.EditionDetails.Book.Title, book.EditionDetails.Book.Author,
                    book.EditionDetails.Book.Genres, book.IsRead, book.Rating,
                    book.ShelfId, book.ShelfLocation, book.EditionDetails.Book.AuthorGender,
                    book.IsDnf, book.WantToSell, book.BookCost, book.DateAcquired, book.DateRead, book.EditionDetails.PageCount))
                .ToArrayAsync(ct)));
    }
}
