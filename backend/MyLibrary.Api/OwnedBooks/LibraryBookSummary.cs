namespace MyLibrary.Api.OwnedBooks;

public sealed record LibraryBookSummary(
    Guid Id, string Title, string Author, string[] Genres,
    bool IsRead, double? Rating, Guid? ShelfId, string? ShelfLocation, string? AuthorGender,
    bool? IsDnf, bool? WantToSell, decimal? BookCost, DateOnly? DateAcquired, DateOnly? DateRead, int? PageCount);
