namespace MyLibrary.Api.OwnedBooks;

public sealed class MarkBookReadRequest
{
    // Omit the rating (or send null) to preserve the existing rating.
    public double? Rating { get; set; }
    // The browser supplies its local calendar date for this action.
    public DateOnly? DateRead { get; set; }
}
