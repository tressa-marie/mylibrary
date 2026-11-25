namespace MyLibrary.Api.Shelves;

public sealed class SaveShelfRequest
{
    public string? Name { get; set; }
    public string? Room { get; set; }
    public string? Description { get; set; }
    public Guid[]? BookIds { get; set; } = [];

    public void Normalize()
    {
        Name = Name?.Trim();
        Room = string.IsNullOrWhiteSpace(Room) ? null : Room.Trim();
        Description = string.IsNullOrWhiteSpace(Description) ? null : Description.Trim();
    }

    public Dictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(Name) || Name.Length > 200)
            errors["name"] = ["Enter a shelf name of 1–200 characters."];
        if (Room?.Length > 200) errors["room"] = ["Use at most 200 characters."];
        if (Description?.Length > 2000) errors["description"] = ["Use at most 2000 characters."];
        if (BookIds is null || BookIds.Length > 1000 || BookIds.Contains(Guid.Empty)
            || BookIds.Distinct().Count() != BookIds.Length)
            errors["bookIds"] = ["Provide an array of up to 1000 distinct, non-empty library book IDs."];
        return errors;
    }
}
