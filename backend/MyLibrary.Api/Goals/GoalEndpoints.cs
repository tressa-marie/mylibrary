using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using MyLibrary.Api.Data;
using MyLibrary.Api.Domain;

namespace MyLibrary.Api.Goals;

public static class GoalEndpoints
{
    public static void MapGoals(this WebApplication app)
    {
        var group = app.MapGroup("/api/goals");
        group.MapGet("", async (LibraryDbContext db, CancellationToken ct) =>
            Results.Ok(await db.Goals.AsNoTracking().OrderBy(x => x.StartDate)
                .ThenBy(x => x.Id).ToArrayAsync(ct)));
        group.MapGet("/{id:guid}", async (Guid id, LibraryDbContext db, CancellationToken ct) =>
        {
            var goal = await db.Goals.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            return goal is null ? Results.NotFound() : Results.Ok(goal);
        });
        group.MapPost("", async (SaveGoalRequest request, LibraryDbContext db, CancellationToken ct) =>
        {
            var errors = request.Validate();
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            var goal = new Goal();
            request.ApplyTo(goal);
            db.Goals.Add(goal);
            return await SaveAsync(db, Results.Created($"/api/goals/{goal.Id}", goal), ct);
        });
        group.MapPut("/{id:guid}", async (Guid id, SaveGoalRequest request, LibraryDbContext db, CancellationToken ct) =>
        {
            var goal = await db.Goals.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (goal is null) return Results.NotFound();
            var errors = request.Validate();
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            request.ApplyTo(goal);
            return await SaveAsync(db, Results.Ok(goal), ct);
        });
        group.MapDelete("/{id:guid}", async (Guid id, LibraryDbContext db, CancellationToken ct) =>
        {
            var goal = await db.Goals.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (goal is null) return Results.NotFound();
            db.Goals.Remove(goal);
            return await SaveAsync(db, Results.NoContent(), ct);
        });
    }

    private static async Task<IResult> SaveAsync(LibraryDbContext db, IResult success, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return success;
        }
        catch (DbUpdateException ex)
        {
            db.GetService<ILoggerFactory>().CreateLogger("Goals").LogError(ex, "Could not save goal changes.");
            return Results.Problem(statusCode: 500, title: "Unable to save goal changes",
                detail: "Your changes could not be saved. Please try again.");
        }
    }
}
