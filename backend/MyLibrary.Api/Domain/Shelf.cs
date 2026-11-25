using MyLibrary.Api.OwnedBooks;

namespace MyLibrary.Api.Domain;

public sealed class Shelf
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string? Room { get; set; }
    public string? Description { get; set; }
    public ICollection<OwnedBook> Books { get; set; } = new List<OwnedBook>();
}
