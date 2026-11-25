namespace MyLibrary.Api.Domain;

// A work, independent of its published editions and owned copies.
public sealed class Book
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public string? Description { get; set; }
    public string? AuthorGender { get; set; }
    public string? Genre { get; set; }
}
