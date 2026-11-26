namespace MyLibrary.Api.OwnedBooks;

public sealed record LibraryBookSummary(
    Guid Id, string Title, string Author, string[] Genres,
    bool IsRead, double? Rating, Guid? ShelfId, string? ShelfLocation);
