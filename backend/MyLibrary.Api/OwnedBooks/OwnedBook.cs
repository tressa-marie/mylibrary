namespace MyLibrary.Api.OwnedBooks;

public sealed class OwnedBook
{
    public Guid Id { get; set; } = Guid.NewGuid();

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
    public int? PublicationYear { get; set; }
    public string? Publisher { get; set; }
    public string? Edition { get; set; }
    public int? PageCount { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;
}