namespace MyLibrary.Api.Domain;

// Publication details belong to an edition, rather than an owned copy.
public sealed class Edition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BookId { get; set; }
    public Book Book { get; set; } = new();
    public string? SourceBookId { get; set; }
    public string? Isbn { get; set; }
    public string? CoverUrl { get; set; }
    public string? Format { get; set; }
    public int? PublicationYear { get; set; }
    public string? Publisher { get; set; }
    public string? EditionName { get; set; }
    public int? PageCount { get; set; }
}
