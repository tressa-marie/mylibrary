using System.Text.RegularExpressions;

namespace MyLibrary.Api.OwnedBooks;

public sealed class CreateOwnedBookRequest
{
    public string? SourceBookId { get; set; }
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public string? Isbn { get; set; }
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }
    public string? Format { get; set; }
    public string? AuthorGender { get; set; }
    public bool IsRead { get; set; }
    public double? Rating { get; set; }
    public string? PurchaseLocation { get; set; }
    public string? ShelfLocation { get; set; }
    public Guid? ShelfId { get; set; }
    public string[]? Genres { get; set; } = [];
    public int? PublicationYear { get; set; }
    public string? Publisher { get; set; }
    public string? Edition { get; set; }
    public int? PageCount { get; set; }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public OwnedBook ToEntity()
    {
        var book = new OwnedBook();
        ApplyTo(book);
        return book;
    }

    // Only editable fields are copied; entity IDs and creation time are preserved.
    public void ApplyTo(OwnedBook book)
    {
        book.SourceBookId = Optional(SourceBookId);
        book.Title = Title?.Trim() ?? "";
        book.Author = Author?.Trim() ?? "";
        book.Isbn = Optional(Isbn) is { } isbn ? Regex.Replace(isbn, @"[\s-]", "").ToUpperInvariant() : null;
        book.Description = Optional(Description);
        book.CoverUrl = Optional(CoverUrl);
        book.Format = Optional(Format);
        book.AuthorGender = Optional(AuthorGender);
        book.IsRead = IsRead;
        book.Rating = IsRead ? Rating : null;
        book.PurchaseLocation = Optional(PurchaseLocation);
        book.ShelfLocation = Optional(ShelfLocation);
        book.ShelfId = ShelfId;
        book.Genres = (Genres ?? []).Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        book.PublicationYear = PublicationYear;
        book.Publisher = Optional(Publisher);
        book.Edition = Optional(Edition);
        book.PageCount = PageCount;
    }

    public static Dictionary<string, string[]> Validate(OwnedBook book)
    {
        var errors = new Dictionary<string, string[]>();
        void Error(string field, string message) => errors[field] = [message];
        void MaxLength(string field, string? value, int max)
        {
            if (value?.Length > max) Error(field, $"Use at most {max} characters.");
        }

        MaxLength("title", book.Title, 500);
        if (string.IsNullOrWhiteSpace(book.Title)) Error("title", "Enter a book title.");
        MaxLength("author", book.Author, 500);
        MaxLength("description", book.Description, 20000);
        MaxLength("format", book.Format, 100);
        MaxLength("purchaseLocation", book.PurchaseLocation, 500);
        MaxLength("shelfLocation", book.ShelfLocation, 500);
        if (book.Genres.Any(genre => genre.Length > 100))
            errors["genres"] = ["Use at most 100 characters for each genre."];
        MaxLength("publisher", book.Publisher, 500);
        MaxLength("edition", book.Edition, 500);
        if (book.SourceBookId is { } sourceId && !Regex.IsMatch(sourceId, @"^[a-zA-Z0-9_-]{1,100}$"))
            Error("sourceBookId", "Use a valid Google Books ID.");
        if (book.Isbn is { } isbn && !Regex.IsMatch(isbn, @"^(\d{13}|\d{9}[\dX])$"))
            Error("isbn", "Enter a 10- or 13-character ISBN, or leave it blank.");
        if (book.AuthorGender is not (null or "male" or "female" or "other"))
            Error("authorGender", "Choose male, female, or other, or leave it blank.");
        if (book.Rating is { } rating && (!double.IsFinite(rating) || rating < 0 || rating > 5))
            Error("rating", "Rating must be between 0 and 5.");
        if (book.PublicationYear < 0) Error("publicationYear", "Publication year cannot be negative.");
        if (book.PageCount < 0) Error("pageCount", "Page count cannot be negative.");
        // Covers are served through our existing Google Books cover endpoint.
        if (book.CoverUrl is { } cover && (book.SourceBookId is null || cover != $"/api/books/{book.SourceBookId}/cover"))
            Error("coverUrl", "Use the selected book's cover, or leave it blank.");
        return errors;
    }
}
