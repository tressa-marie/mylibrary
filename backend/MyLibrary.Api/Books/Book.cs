namespace MyLibrary.Api.Books;

public sealed record Book(
    string Id, string Title, string? Subtitle, string[] Authors,
    int? PublicationYear, string[] Isbns, string? Format, string? CoverUrl,
    string? Publisher, string? Description, int? PageCount, string? Language);

public interface IBookProvider
{
    Task<Book[]> SearchAsync(string query, string field, CancellationToken cancellationToken);
    Task<Book?> GetAsync(string id, CancellationToken cancellationToken);
    Task<byte[]?> GetCoverAsync(string id, CancellationToken cancellationToken);
}
