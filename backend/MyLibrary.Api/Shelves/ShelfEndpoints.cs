using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using MyLibrary.Api.Data;
using MyLibrary.Api.Domain;

namespace MyLibrary.Api.Shelves;

public sealed record ShelfResponse(Guid Id, string Name, string? Room, string? Description, Guid[] BookIds);

public static class ShelfEndpoints
{
    public static void MapShelves(this WebApplication app)
    {
        var group = app.MapGroup("/api/shelves");
        group.MapPost("", CreateAsync);
        group.MapGet("", async (LibraryDbContext db, CancellationToken ct) =>
            Results.Ok((await db.Shelves.AsNoTracking().Include(x => x.Books)
                .OrderBy(x => x.Name).ThenBy(x => x.Id).ToArrayAsync(ct)).Select(ToResponse)));
        group.MapGet("/{id:guid}", async (Guid id, LibraryDbContext db, CancellationToken ct) =>
        {
            var shelf = await db.Shelves.AsNoTracking().Include(x => x.Books)
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            return shelf is null ? Results.NotFound() : Results.Ok(ToResponse(shelf));
        });
        group.MapPut("/{id:guid}", UpdateAsync);
        group.MapDelete("/{id:guid}", async (Guid id, LibraryDbContext db, CancellationToken ct) =>
        {
            var shelf = await db.Shelves.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (shelf is null) return Results.NotFound();
            // The foreign key uses SET NULL: deleting a shelf never deletes books.
            db.Shelves.Remove(shelf);
            return await SaveAsync(db, Results.NoContent(), ct);
        });
    }

    private static ShelfResponse ToResponse(Shelf shelf) => new(
        shelf.Id, shelf.Name, shelf.Room, shelf.Description,
        shelf.Books.Select(x => x.Id).Order().ToArray());

    private static async Task<IResult> CreateAsync(SaveShelfRequest request, LibraryDbContext db, CancellationToken ct)
    {
        request.Normalize();
        var errors = request.Validate();
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        var books = await db.OwnedBooks.Where(x => request.BookIds!.Contains(x.Id)).ToArrayAsync(ct);
        if (books.Length != request.BookIds!.Length) return MissingBooks();
        var shelf = new Shelf { Name = request.Name!, Room = request.Room, Description = request.Description, Books = books.ToList() };
        db.Shelves.Add(shelf);
        return await SaveAsync(db, Results.Created($"/api/shelves/{shelf.Id}", ToResponse(shelf)), ct);
    }

    private static async Task<IResult> UpdateAsync(Guid id, SaveShelfRequest request, LibraryDbContext db, CancellationToken ct)
    {
        var shelf = await db.Shelves.Include(x => x.Books).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (shelf is null) return Results.NotFound();
        request.Normalize();
        var errors = request.Validate();
        if (errors.Count > 0) return Results.ValidationProblem(errors);
        var books = await db.OwnedBooks.Where(x => request.BookIds!.Contains(x.Id)).ToArrayAsync(ct);
        if (books.Length != request.BookIds!.Length) return MissingBooks();
        shelf.Name = request.Name!;
        shelf.Room = request.Room;
        shelf.Description = request.Description;
        // PUT replaces membership; assigning a book here moves it from its previous shelf.
        shelf.Books.Clear();
        foreach (var book in books) shelf.Books.Add(book);
        return await SaveAsync(db, Results.Ok(ToResponse(shelf)), ct);
    }

    private static IResult MissingBooks() => Results.ValidationProblem(new Dictionary<string, string[]>
    {
        ["bookIds"] = ["One or more library book IDs do not exist."]
    });

    private static async Task<IResult> SaveAsync(LibraryDbContext db, IResult success, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return success;
        }
        catch (DbUpdateException ex)
        {
            db.GetService<ILoggerFactory>().CreateLogger("Shelves").LogError(ex, "Could not save shelf changes.");
            return Results.Problem(statusCode: 500, title: "Unable to save shelf changes",
                detail: "Your changes could not be saved. Please try again.");
        }
    }
}
