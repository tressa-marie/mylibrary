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
    public string? Genre { get; set; }
    public int? PublicationYear { get; set; }
    public string? Publisher { get; set; }
    public string? Edition { get; set; }
    public int? PageCount { get; set; }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public OwnedBook ToEntity() => new()
    {
        SourceBookId = Optional(SourceBookId),
        Title = Title?.Trim() ?? "",
        Author = Author?.Trim() ?? "",
        Isbn = Optional(Isbn) is { } isbn ? Regex.Replace(isbn, @"[\s-]", "").ToUpperInvariant() : null,
        Description = Optional(Description),
        CoverUrl = Optional(CoverUrl),
        Format = Optional(Format),
        AuthorGender = Optional(AuthorGender),
        IsRead = IsRead,
        Rating = IsRead ? Rating : null,
        PurchaseLocation = Optional(PurchaseLocation),
        ShelfLocation = Optional(ShelfLocation),
        Genre = Optional(Genre),
        PublicationYear = PublicationYear,
        Publisher = Optional(Publisher),
        Edition = Optional(Edition),
        PageCount = PageCount,
    };

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
        MaxLength("genre", book.Genre, 100);
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
