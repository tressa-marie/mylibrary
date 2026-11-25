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

    private static void MapRoutes(WebApplication app, string path)
    {
        var group = app.MapGroup(path);
        group.MapPost("", async (CreateOwnedBookRequest request, LibraryDbContext db, CancellationToken ct) =>
        {
            var book = request.ToEntity();
            var errors = CreateOwnedBookRequest.Validate(book);
            if (book.ShelfId is { } shelfId && !await db.Shelves.AnyAsync(x => x.Id == shelfId, ct))
                errors["shelfId"] = ["Choose an existing shelf, or leave it blank."];
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
        group.MapGet("/{id:guid}", async (Guid id, LibraryDbContext db, CancellationToken ct) =>
        {
            var book = await LibraryBooks(db).SingleOrDefaultAsync(book => book.Id == id, ct);
            return book is null ? Results.NotFound() : Results.Ok(book);
        });
        group.MapGet("", async (LibraryDbContext db, CancellationToken ct) =>
            Results.Ok(await LibraryBooks(db).OrderBy(book => book.Id).ToArrayAsync(ct)));
    }
}
