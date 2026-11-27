using MyLibrary.Api.Domain;

namespace MyLibrary.Api.Goals;

public sealed class SaveGoalRequest
{
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public GoalType? GoalType { get; set; }
    public int? Num { get; set; }
    public bool IncludeNonLibraryBooks { get; set; }
    public decimal? CompletedCount { get; set; }

    public Dictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();
        if (StartDate is null) errors["startDate"] = ["Enter a start date."];
        if (EndDate is null) errors["endDate"] = ["Enter an end date."];
        else if (StartDate is not null && EndDate < StartDate)
            errors["endDate"] = ["End date must be on or after start date."];
        if (GoalType is null || !Enum.IsDefined(GoalType.Value))
            errors["goalType"] = ["Choose BookCount, PageCount, BuyBookCount, or ReadBookPercentage."];
        if (Num is null || Num < 0) errors["num"] = ["Enter a nonnegative integer target."];
        else if (GoalType == Domain.GoalType.ReadBookPercentage && Num > 100)
            errors["num"] = ["Enter a percentage from 0 to 100."];
        if (IncludeNonLibraryBooks && GoalType is not (Domain.GoalType.BookCount or Domain.GoalType.PageCount))
            errors["includeNonLibraryBooks"] = ["Only BookCount and PageCount goals can include books outside your library."];
        if (CompletedCount is { } count)
        {
            if (count < 0 || count > int.MaxValue)
                errors["completedCount"] = ["Enter a nonnegative completed count up to 2147483647."];
            else if (GoalType == Domain.GoalType.ReadBookPercentage && count > 100)
                errors["completedCount"] = ["Enter a completed percentage from 0 to 100."];
            else if (GoalType != Domain.GoalType.ReadBookPercentage && count != decimal.Truncate(count))
                errors["completedCount"] = ["Enter a whole number for the completed count."];
        }
        return errors;
    }

    // Called only after validation; PUT preserves the server-generated ID.
    public void ApplyTo(Goal goal)
    {
        goal.StartDate = StartDate!.Value;
        goal.EndDate = EndDate!.Value;
        goal.GoalType = GoalType!.Value;
        goal.Num = Num!.Value;
        goal.IncludeNonLibraryBooks = IncludeNonLibraryBooks;
        goal.CompletedCount = CompletedCount;
    }
}
