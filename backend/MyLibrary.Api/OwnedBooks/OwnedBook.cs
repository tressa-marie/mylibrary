using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using MyLibrary.Api.Domain;

namespace MyLibrary.Api.OwnedBooks;

public sealed class OwnedBook
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid EditionId { get; set; }
    [JsonIgnore]
    public Edition EditionDetails { get; set; } = new();

    // Preserve the existing flat API contract while storing metadata once.
    [NotMapped] public string? SourceBookId { get => EditionDetails.SourceBookId; set => EditionDetails.SourceBookId = value; }
    [NotMapped] public string Title { get => EditionDetails.Book.Title; set => EditionDetails.Book.Title = value; }
    [NotMapped] public string Author { get => EditionDetails.Book.Author; set => EditionDetails.Book.Author = value; }
    [NotMapped] public string? Isbn { get => EditionDetails.Isbn; set => EditionDetails.Isbn = value; }
    [NotMapped] public string? Description { get => EditionDetails.Book.Description; set => EditionDetails.Book.Description = value; }
    [NotMapped] public string? CoverUrl { get => EditionDetails.CoverUrl; set => EditionDetails.CoverUrl = value; }
    [NotMapped] public string? Format { get => EditionDetails.Format; set => EditionDetails.Format = value; }
    [NotMapped] public string? AuthorGender { get => EditionDetails.Book.AuthorGender; set => EditionDetails.Book.AuthorGender = value; }

    public bool IsRead { get; set; }
    public double? Rating { get; set; }

    public string? PurchaseLocation { get; set; }
    public string? ShelfLocation { get; set; }
    [NotMapped] public string? Genre { get => EditionDetails.Book.Genre; set => EditionDetails.Book.Genre = value; }
    [NotMapped] public int? PublicationYear { get => EditionDetails.PublicationYear; set => EditionDetails.PublicationYear = value; }
    [NotMapped] public string? Publisher { get => EditionDetails.Publisher; set => EditionDetails.Publisher = value; }
    [NotMapped] public string? Edition { get => EditionDetails.EditionName; set => EditionDetails.EditionName = value; }
    [NotMapped] public int? PageCount { get => EditionDetails.PageCount; set => EditionDetails.PageCount = value; }

    public DateTimeOffset CreatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;
}
