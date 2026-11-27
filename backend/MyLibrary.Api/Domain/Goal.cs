using System.Text.Json.Serialization;

namespace MyLibrary.Api.Domain;

[JsonConverter(typeof(JsonStringEnumConverter<GoalType>))]
public enum GoalType
{
    BookCount,
    PageCount,
    BuyBookCount,
    ReadBookPercentage
}

public sealed class Goal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public GoalType GoalType { get; set; }
    public int Num { get; set; }
}
