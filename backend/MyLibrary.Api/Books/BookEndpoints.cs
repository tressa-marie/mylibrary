using System.Text.Json;
using System.Text.RegularExpressions;

namespace MyLibrary.Api.Books;

public static class BookEndpoints
{
    public static void MapBooks(this WebApplication app)
    {
        var group = app.MapGroup("/api/books");
        group.MapGet("", async (string? query, string? field, IBookProvider provider, CancellationToken ct) =>
        {
            query = query?.Trim();
            field ??= "all";
            if (string.IsNullOrWhiteSpace(query) || query.Length > 200 || field is not ("all" or "title" or "author" or "isbn"))
                return Results.Problem(statusCode: 400, title: "Enter a search term of 1–200 characters and a valid search field.");
            return await Handle(async () => Results.Ok(new { books = await provider.SearchAsync(query, field, ct) }), ct, app.Logger);
        });
        group.MapGet("/{id}", async (string id, IBookProvider provider, CancellationToken ct) =>
            !ValidId(id) ? Results.NotFound() : await Handle(async () =>
                await provider.GetAsync(id, ct) is { } book ? Results.Ok(book) : Results.NotFound(), ct, app.Logger));
        group.MapGet("/{id}/cover", async (string id, IBookProvider provider, CancellationToken ct) =>
            !ValidId(id) ? Results.NotFound() : await Handle(async () =>
                await provider.GetCoverAsync(id, ct) is { } bytes ? Results.File(bytes, "image/jpeg") : Results.NotFound(), ct, app.Logger));
    }

    private static bool ValidId(string id) => Regex.IsMatch(id, @"^[a-zA-Z0-9_-]{1,100}$");

    private static async Task<IResult> Handle(Func<Task<IResult>> action, CancellationToken ct, ILogger logger)
    {
        try { return await action(); }
        catch (Exception ex) when (ex is HttpRequestException or JsonException || ex is OperationCanceledException && !ct.IsCancellationRequested)
        {
            // Never log exception messages, request URLs, or response bodies: they may contain credentials.
            var reason = ex switch
            {
                HttpRequestException { StatusCode: { } status } => $"Provider returned HTTP {(int)status}.",
                HttpRequestException request => $"Network failure ({request.HttpRequestError}).",
                JsonException => "Provider returned invalid JSON.",
                _ => "Provider request timed out."
            };
            logger.LogWarning("Book service unavailable: {Reason}", reason);
            return Results.Problem(statusCode: 503, title: "Book service unavailable",
                detail: "We couldn't reach the book service. Please try again shortly.");
        }
    }
}
